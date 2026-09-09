const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  const sqlFile = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '003_fix_security_migration.sql'), 'utf8');

  try {
    await client.connect();

    // ===== 1. Parse SQL statements, ignore comments =====
    console.log('=== 1. CREATE/DROP POLICY COUNTS (parsed, comments ignored) ===\n');

    // Remove single-line comments
    const noComments = sqlFile.replace(/--.*$/gm, '');
    // Remove block comments
    const clean = noComments.replace(/\/\*[\s\S]*?\*\//g, '');

    // Split on ; and find CREATE POLICY / DROP POLICY statements
    const statements = clean.split(';').map(s => s.trim()).filter(s => s.length > 0);

    const createPolicies = [];
    const dropPolicies = [];

    for (const stmt of statements) {
      const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();
      if (upper.startsWith('CREATE POLICY')) {
        const match = stmt.match(/CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)/i);
        if (match) createPolicies.push({ name: match[1], table: match[2] });
      }
      if (upper.startsWith('DROP POLICY')) {
        const match = stmt.match(/DROP POLICY\s+IF\s+EXISTS\s+"([^"]+)"\s+ON\s+public\.(\w+)/i);
        if (match) dropPolicies.push({ name: match[1], table: match[2] });
      }
    }

    console.log('CREATE POLICY count:', createPolicies.length);
    console.log('DROP POLICY IF EXISTS count:', dropPolicies.length);

    // Match them
    const dropMap = new Map();
    for (const d of dropPolicies) {
      const key = d.table + '.' + d.name;
      dropMap.set(key, (dropMap.get(key) || 0) + 1);
    }

    const createMap = new Map();
    for (const c of createPolicies) {
      const key = c.table + '.' + c.name;
      createMap.set(key, (createMap.get(key) || 0) + 1);
    }

    let mismatch = false;
    for (const [key, count] of createMap) {
      const dropCount = dropMap.get(key) || 0;
      if (count !== dropCount) {
        console.log('  MISMATCH: ' + key + ' has ' + count + ' CREATE but ' + dropCount + ' DROP');
        mismatch = true;
      }
    }
    for (const [key, count] of dropMap) {
      if (!createMap.has(key)) {
        console.log('  ORPHAN DROP: ' + key + ' has DROP but no CREATE');
        mismatch = true;
      }
    }
    if (!mismatch) {
      console.log('  ALL MATCHED: Every CREATE has a matching DROP');
    }

    // Show all pairs
    console.log('\n  All CREATE POLICY statements:');
    for (const c of createPolicies) console.log('    ' + c.table + '.' + c.name);

    // ===== 2. UPDATE statement analysis =====
    console.log('\n=== 2. DATA MODIFICATION STATEMENTS ===\n');
    const updateMatches = clean.match(/UPDATE\s+public\.\w+[\s\S]*?(?=;|$)/gi) || [];
    for (const u of updateMatches) {
      console.log('  UPDATE: ' + u.replace(/\s+/g, ' ').substring(0, 200));
    }

    // ===== 3. Check referral_services table =====
    console.log('\n=== 3. REFERRAL_SERVICES ANALYSIS ===\n');
    const rsCheck = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='referral_services' AND table_schema='public' ORDER BY ordinal_position"
    );
    console.log('referral_services columns:', rsCheck.rows.map(r => r.column_name).join(', '));

    // Check if any referral has multiple services
    const multiService = await client.query(
      "SELECT referral_id, count(*) as svc_count FROM public.referral_services GROUP BY referral_id HAVING count(*) > 1"
    );
    console.log('Referrals with multiple services:', multiService.rows.length);
    for (const r of multiService.rows) {
      console.log('  referral_id=' + r.referral_id + ' services=' + r.svc_count);
    }

    // Check if referral_services has any ordering column (sort_order, display_order, is_primary, etc.)
    const rsCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='referral_services' AND table_schema='public'"
    );
    console.log('All referral_services columns:', rsCols.rows.map(r => r.column_name).join(', '));

    // ===== 4. SECURITY DEFINER function audit =====
    console.log('\n=== 4. SECURITY DEFINER FUNCTION AUDIT ===\n');
    const secDefs = await client.query(`
      SELECT p.proname, 
        pg_get_function_arguments(p.oid) as args,
        pg_get_function_result(p.oid) as rettype,
        p.prosecdef as is_secdef,
        p.proconfig as config
      FROM pg_proc p 
      WHERE p.pronamespace = 'public'::regnamespace 
        AND p.prosecdef = true
      ORDER BY p.proname
    `);
    for (const f of secDefs.rows) {
      console.log('  ' + f.proname + '(' + f.args + ') -> ' + f.rettype);
    }

    // Check REVOKE/GRANT in SQL
    console.log('\n  REVOKE statements in migration:');
    const revokeMatches = clean.match(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.\w+\([^)]*\)\s+FROM\s+\w+/gi) || [];
    for (const r of revokeMatches) console.log('    ' + r.replace(/\s+/g, ' '));

    console.log('\n  GRANT statements in migration:');
    const grantMatches = clean.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.\w+\([^)]*\)\s+TO\s+\w+/gi) || [];
    for (const g of grantMatches) console.log('    ' + g.replace(/\s+/g, ' '));

    // ===== 5. CHECK constraints on all referenced tables =====
    console.log('\n=== 5. ALL CHECK CONSTRAINTS ===\n');
    const allChecks = await client.query(`
      SELECT conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, conname
    `);
    for (const c of allChecks.rows) {
      console.log('  ' + c.table_name + ': ' + c.conname);
      console.log('    ' + c.def);
    }

    // ===== 6. FK constraints that functions depend on =====
    console.log('\n=== 6. KEY FOREIGN KEYS ===\n');
    const fks = await client.query(`
      SELECT 
        conrelid::regclass as from_table,
        a1.attname as from_col,
        confrelid::regclass as to_table,
        a2.attname as to_col,
        confdeltype as on_delete
      FROM pg_constraint c
      JOIN pg_attribute a1 ON a1.attrelid = conrelid AND a1.attnum = ANY(conkey)
      JOIN pg_attribute a2 ON a2.attrelid = confrelid AND a2.attnum = ANY(confkey)
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      ORDER BY from_table::text, from_col
    `);
    for (const fk of fks.rows) {
      console.log('  ' + fk.from_table + '.' + fk.from_col + ' -> ' + fk.to_table + '.' + fk.to_col + ' (ON DELETE ' + fk.on_delete + ')');
    }

    // ===== 7. Check if any function references tables/columns that don't exist =====
    console.log('\n=== 7. SCHEMA REFERENCED BY FUNCTIONS ===\n');
    const funcBodies = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p 
      WHERE p.pronamespace = 'public'::regnamespace 
        AND p.prosecdef = true
      ORDER BY p.proname
    `);
    for (const f of funcBodies.rows) {
      console.log('  Function: ' + f.proname);
      // Check for table references
      const tableRefs = f.def.match(/public\.(\w+)/g) || [];
      const uniqueTables = [...new Set(tableRefs.map(t => t.replace('public.', '')))];
      console.log('    Tables referenced: ' + uniqueTables.join(', '));
    }

    // ===== 8. Check for orphaned grants (GRANT on functions not yet created) =====
    console.log('\n=== 8. GRANT TARGET VALIDATION ===\n');
    const existingFuncs = await client.query(
      "SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname"
    );
    console.log('Existing functions before migration:');
    for (const f of existingFuncs.rows) console.log('  ' + f.proname + '(' + f.args + ')');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
