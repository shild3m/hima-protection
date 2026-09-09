const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    
    // 1. Check create_guest_booking grants
    console.log('--- create_guest_booking GRANTS ---');
    const grants = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'create_guest_booking'
    `);
    for (const r of grants.rows) console.log('  ' + r.grantee + ': ' + r.privilege_type);
    
    // 2. Check complete_booking search_path
    console.log('\n--- complete_booking DEFINITION ---');
    const def = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'complete_booking' AND pronamespace = 'public'::regnamespace
    `);
    if (def.rows.length === 1) {
      // Show lines with search_path
      const lines = def.rows[0].def.split('\n');
      for (const l of lines) {
        if (l.toLowerCase().includes('search_path') || l.toLowerCase().includes('set')) {
          console.log('  LINE: "' + l + '"');
        }
      }
      // Show raw substring around search_path
      const raw = def.rows[0].def;
      const idx = raw.indexOf('search_path');
      if (idx > -1) {
        console.log('  RAW: "' + raw.substring(idx - 5, idx + 30) + '"');
      }
    }
    
    // 3. Try to revoke create_guest_booking from authenticated
    console.log('\n--- REVOKE create_guest_booking FROM authenticated ---');
    try {
      await client.query('REVOKE ALL ON FUNCTION public.create_guest_booking(text, text, text, text, uuid, text, integer, text, text, date, time, text, text) FROM authenticated');
      console.log('  SUCCESS');
    } catch (e) {
      console.log('  ERROR: ' + e.message);
    }
    
    // 4. Verify
    console.log('\n--- VERIFY ---');
    const grants2 = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'create_guest_booking'
    `);
    for (const r of grants2.rows) console.log('  ' + r.grantee + ': ' + r.privilege_type);
    
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
