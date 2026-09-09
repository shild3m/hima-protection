const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    
    // Check what roles exist
    console.log('--- ROLES IN DATABASE ---');
    const roles = await client.query(`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role', 'public') ORDER BY rolname
    `);
    for (const r of roles.rows) console.log('  ' + r.rolname);
    
    // Check if anon is a member of public
    console.log('\n--- ANON ROLE MEMBERSHIPS ---');
    const members = await client.query(`
      SELECT r.rolname as role, m.rolname as member
      FROM pg_auth_members am
      JOIN pg_roles r ON r.oid = am.roleid
      JOIN pg_roles m ON m.oid = am.member
      WHERE m.rolname IN ('anon', 'authenticated', 'service_role')
    `);
    for (const m of members.rows) console.log('  ' + m.member + ' is member of ' + m.role);
    
    // Check specific function grants to anon
    console.log('\n--- FUNCTION GRANTS TO ANON ---');
    const sensitiveFuncs = ['create_guest_booking', 'create_commission', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking'];
    for (const fn of sensitiveFuncs) {
      const grants = await client.query(`
        SELECT grantee, privilege_type
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'anon'
      `, [fn]);
      if (grants.rows.length > 0) {
        console.log('  ' + fn + ': ' + grants.rows.map(r => r.grantee + ' ' + r.privilege_type).join(', '));
      } else {
        console.log('  ' + fn + ': NO GRANTS TO ANON');
      }
    }
    
    // Try to revoke from anon
    console.log('\n--- TESTING REVOKE FROM ANON ---');
    for (const fn of sensitiveFuncs) {
      try {
        const funcSig = await client.query(`
          SELECT pg_get_function_identity_arguments(oid) as args
          FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace
        `, [fn]);
        if (funcSig.rows.length > 0) {
          const args = funcSig.rows[0].args;
          const sql = `REVOKE ALL ON FUNCTION public.${fn}(${args}) FROM anon`;
          console.log('  ' + sql);
          await client.query(sql);
          console.log('    -> SUCCESS');
        }
      } catch (e) {
        console.log('    -> ERROR: ' + e.message.substring(0, 100));
      }
    }
    
    // Verify revocation worked
    console.log('\n--- VERIFY REVOKE ---');
    for (const fn of sensitiveFuncs) {
      const grants = await client.query(`
        SELECT grantee, privilege_type
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'anon'
      `, [fn]);
      if (grants.rows.length > 0) {
        console.log('  ' + fn + ': STILL HAS GRANTS (PROBLEM)');
      } else {
        console.log('  ' + fn + ': REVOKED OK');
      }
    }
    
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
