const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('=== SAFETY CHECKPOINT ===\n');
    
    // 1. Capture current table list
    const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log('Tables (' + tables.rows.length + '):');
    for (const t of tables.rows) console.log('  ' + t.tablename);
    
    // 2. Capture current functions
    const funcs = await client.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p 
      WHERE p.pronamespace = 'public'::regnamespace 
      ORDER BY p.proname
    `);
    console.log('\nExisting functions (' + funcs.rows.length + '):');
    for (const f of funcs.rows) console.log('  ' + f.proname + '(' + f.args + ')');
    
    // 3. Capture current RLS policies
    const policies = await client.query(`
      SELECT tablename, policyname FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname
    `);
    console.log('\nExisting RLS policies (' + policies.rows.length + '):');
    for (const p of policies.rows) console.log('  ' + p.tablename + '.' + p.policyname);
    
    // 4. Capture current indexes
    const indexes = await client.query(`
      SELECT indexname, tablename FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname
    `);
    console.log('\nExisting indexes (' + indexes.rows.length + '):');
    for (const i of indexes.rows) console.log('  ' + i.tablename + '.' + i.indexname);
    
    // 5. Capture current columns on key tables
    console.log('\nKey table columns:');
    for (const tbl of ['referral_services', 'staff', 'commissions']) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public' 
        ORDER BY ordinal_position
      `, [tbl]);
      console.log('\n  ' + tbl + ':');
      for (const c of cols.rows) {
        console.log('    ' + c.column_name + ' ' + c.data_type + 
          (c.is_nullable === 'NO' ? ' NOT NULL' : '') + 
          (c.column_default ? ' DEFAULT ' + c.column_default.substring(0, 50) : ''));
      }
    }
    
    // 6. Capture current REVOKE/GRANT on functions
    console.log('\nCurrent function permissions:');
    const perms = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public'
      ORDER BY routine_name
    `);
    for (const p of perms.rows) {
      console.log('  ' + p.routine_name + ' (' + p.routine_type + ')');
    }
    
    // 7. Count referral_services rows
    const rsCount = await client.query('SELECT count(*) as total FROM public.referral_services');
    console.log('\nreferral_services rows: ' + rsCount.rows[0].total);
    
    // 8. Count staff rows
    const staffCount = await client.query('SELECT count(*) as total FROM public.staff');
    console.log('staff rows: ' + staffCount.rows[0].total);
    
    // Save checkpoint to file
    const checkpoint = {
      timestamp: new Date().toISOString(),
      tables: tables.rows.map(r => r.tablename),
      functions: funcs.rows.map(r => r.proname + '(' + r.args + ')'),
      policies: policies.rows.map(r => r.tablename + '.' + r.policyname),
      referral_services_count: parseInt(rsCount.rows[0].total),
      staff_count: parseInt(staffCount.rows[0].total),
    };
    
    fs.writeFileSync(path.join(__dirname, 'migration-checkpoint-pre-003.json'), JSON.stringify(checkpoint, null, 2));
    console.log('\nCheckpoint saved to migration-checkpoint-pre-003.json');
    console.log('=== CHECKPOINT COMPLETE ===');
    
  } catch (e) {
    console.error('CHECKPOINT ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
