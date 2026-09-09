const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('=== INVESTIGATING FAILURES ===\n');
    
    // 1. Table count
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log('Tables (' + tables.rows.length + '):');
    for (const t of tables.rows) console.log('  ' + t.tablename);
    
    // 2. Policy breakdown
    console.log('\n--- POLICY BREAKDOWN BY CMD ---');
    const policies = await client.query(`
      SELECT cmd, count(*) as cnt
      FROM pg_policies WHERE schemaname = 'public'
      GROUP BY cmd ORDER BY cmd
    `);
    for (const p of policies.rows) console.log('  ' + p.cmd + ': ' + p.cnt);
    
    // List ALL policies
    console.log('\n--- ALL POLICIES ---');
    const allPolicies = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    for (const p of allPolicies.rows) console.log('  ' + p.tablename + '.' + p.policyname + ' [' + p.cmd + ']');
    
    // 3. Check anon grants
    console.log('\n--- ANON GRANTS ---');
    const anonGrants = await client.query(`
      SELECT routine_name, grantee
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
      ORDER BY grantee, routine_name
    `);
    const byGrantee = {};
    for (const r of anonGrants.rows) {
      if (!byGrantee[r.grantee]) byGrantee[r.grantee] = [];
      byGrantee[r.grantee].push(r.routine_name);
    }
    for (const [grantee, funcs] of Object.entries(byGrantee)) {
      console.log('  ' + grantee + ': ' + funcs.join(', '));
    }
    
    // 4. Check search_path for complete_booking
    console.log('\n--- COMPLETE_BOOKING SEARCH_PATH ---');
    const cbFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'complete_booking' AND pronamespace = 'public'::regnamespace
    `);
    if (cbFunc.rows.length === 1) {
      const lines = cbFunc.rows[0].def.split('\n');
      for (const l of lines) {
        if (l.includes('search_path') || l.includes('SECURITY') || l.includes('LANGUAGE') || l.includes('RETURNS')) {
          console.log('  ' + l.trim());
        }
      }
    }
    
    // 5. Check if role_permissions was created by migration
    console.log('\n--- ROLE_PERMISSIONS TABLE ---');
    const rpCols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'role_permissions' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('  Columns: ' + rpCols.rows.map(r => r.column_name + ' (' + r.data_type + ')').join(', '));
    
    // 6. Check indexes on referral_services
    console.log('\n--- REFERRAL_SERVICES INDEXES ---');
    const rsIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'referral_services'
    `);
    for (const i of rsIndexes.rows) {
      console.log('  ' + i.indexname + ': ' + i.indexdef);
    }
    
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
