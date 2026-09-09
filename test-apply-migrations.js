const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

function splitSql(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    
    if (ch === '$') {
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        tag += sql[j];
        j++;
      }
      if (j < sql.length) {
        tag += '$';
        if (!inDollarQuote) {
          dollarTag = tag;
          inDollarQuote = true;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
        current += sql.substring(i, j + 1);
        i = j;
        continue;
      }
    }
    
    if (ch === ';' && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  
  const last = current.trim();
  if (last.length > 0) {
    statements.push(last);
  }
  
  return statements;
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('CONNECTED to database');
    
    // Step 1: Drop everything to start clean
    console.log('\n=== CLEANING UP existing objects ===');
    const dropQueries = [
      "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
      "GRANT ALL ON SCHEMA public TO postgres;",
      "GRANT ALL ON SCHEMA public TO anon;",
      "GRANT ALL ON SCHEMA public TO authenticated;",
      "GRANT ALL ON SCHEMA public TO service_role;",
      "GRANT USAGE ON SCHEMA public TO anon;",
      "GRANT USAGE ON SCHEMA public TO authenticated;",
      "GRANT USAGE ON SCHEMA public TO service_role;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;"
    ];
    
    for (const q of dropQueries) {
      try {
        await client.query(q);
      } catch (e) {
        // ignore
      }
    }
    console.log('  Cleaned.');
    
    // Step 2: Apply migrations
    const migrationDir = path.join(__dirname, 'supabase', 'migrations');
    const files = ['001_initial_schema.sql', '002_security_and_integrity.sql'];
    
    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const statements = splitSql(sql);
      console.log(`\n=== ${file}: ${statements.length} statements ===`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        // Skip comment-only statements
        const lines = stmt.split('\n');
        const nonCommentLines = lines.filter(l => !l.trim().startsWith('--'));
        const stripped = nonCommentLines.join(' ').trim();
        if (stripped.length === 0) continue;
        
        try {
          await client.query(stmt);
          successCount++;
        } catch (e) {
          errorCount++;
          if (errorCount <= 10) {
            const preview = stmt.substring(0, 150).replace(/\n/g, ' ');
            console.error(`  ERR [${idx+1}]: ${e.message.substring(0, 200)}`);
            console.error(`  SQL: ${preview}...`);
          }
        }
      }
      
      console.log(`  OK: ${successCount}, ERRORS: ${errorCount}`);
    }
    
    // Step 3: Verify
    console.log('\n=== VERIFICATION ===');
    
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('TABLES (' + tables.rows.length + '):', tables.rows.map(x => x.table_name).join(', '));
    
    const functions = await client.query(
      "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name"
    );
    console.log('FUNCTIONS (' + functions.rows.length + '):', functions.rows.map(x => x.routine_name).join(', '));
    
    const policies = await client.query(
      "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname"
    );
    console.log('POLICIES (' + policies.rows.length + '):');
    for (const row of policies.rows) {
      console.log(`  ${row.tablename}.${row.policyname} [${row.cmd}]`);
    }
    
    const roles = await client.query("SELECT name FROM public.roles ORDER BY name");
    console.log('ROLES:', roles.rows.map(x => x.name).join(', '));
    
    const perms = await client.query("SELECT count(*) as cnt FROM public.permissions");
    console.log('PERMISSIONS:', perms.rows[0].cnt);
    
    const rp = await client.query("SELECT count(*) as cnt FROM public.role_permissions");
    console.log('ROLE_PERMISSIONS:', rp.rows[0].cnt);
    
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await client.end();
  }
}

main();
