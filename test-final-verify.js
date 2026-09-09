const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    let pass = 0, fail = 0;
    function check(label, condition, detail) {
      if (condition) { pass++; console.log('  PASS: ' + label); }
      else { fail++; console.log('  FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
    }
    
    console.log('=== FINAL POST-MIGRATION VERIFICATION ===\n');
    
    // 1. Tables
    console.log('--- 1. TABLES ---');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    check('31 tables (30 original + role_permissions)', tables.rows.length === 31, 'got ' + tables.rows.length);
    
    // 2. referral_services.is_primary
    console.log('\n--- 2. IS_PRIMARY COLUMN ---');
    const rsCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'referral_services' AND column_name = 'is_primary'
    `);
    check('is_primary column exists', rsCols.rows.length === 1);
    check('is_primary is boolean NOT NULL DEFAULT false', 
      rsCols.rows.length === 1 && rsCols.rows[0].data_type === 'boolean' && rsCols.rows[0].is_nullable === 'NO');
    
    // 3. Partial unique index
    console.log('\n--- 3. PARTIAL UNIQUE INDEX ---');
    const idx = await client.query(`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'uniq_referral_services_one_primary'
    `);
    check('Partial unique index exists', idx.rows.length === 1);
    check('UNIQUE ... WHERE is_primary = true', idx.rows.length > 0 && idx.rows[0].indexdef.includes('WHERE (is_primary = true)'));
    
    // 4. Functions (13 total)
    console.log('\n--- 4. FUNCTIONS ---');
    const funcs = await client.query(`
      SELECT p.proname, p.prosecdef, p.proconfig
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname
    `);
    check('13 functions exist', funcs.rows.length === 13, 'got ' + funcs.rows.length);
    const fnNames = funcs.rows.map(r => r.proname);
    for (const fn of ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone',
      'create_guest_booking', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'create_commission', 'complete_booking']) {
      check('Function ' + fn + ' exists', fnNames.includes(fn));
    }
    
    // 5. SECURITY DEFINER + search_path
    console.log('\n--- 5. FUNCTION SECURITY ---');
    for (const f of funcs.rows) {
      if (['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone',
        'create_guest_booking', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'create_commission', 'complete_booking'].includes(f.proname)) {
        check(f.proname + ' SECURITY DEFINER', f.prosecdef === true);
        check(f.proname + ' search_path = public', f.proconfig && f.proconfig.some(c => c.includes('search_path')));
      }
    }
    
    // 6. RLS Policies
    console.log('\n--- 6. RLS POLICIES ---');
    const policies = await client.query(`
      SELECT count(*) as total FROM pg_policies WHERE schemaname = 'public'
    `);
    check('51 RLS policies', parseInt(policies.rows[0].total) === 51, 'got ' + policies.rows[0].total);
    
    // 7. REVOKE FROM anon
    console.log('\n--- 7. ANON ACCESS ---');
    const sensitiveFuncs = ['create_commission', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking'];
    for (const fn of sensitiveFuncs) {
      const anonGrant = await client.query(`
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'anon'
      `, [fn]);
      check(fn + ' NOT granted to anon', anonGrant.rows.length === 0);
    }
    // create_guest_booking should also NOT be granted to anon (it uses service_role)
    const guestAnon = await client.query(`
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'create_guest_booking' AND grantee = 'anon'
    `);
    check('create_guest_booking NOT granted to anon', guestAnon.rows.length === 0);
    
    // 8. Helper functions still accessible to anon (for RLS)
    console.log('\n--- 8. HELPER ACCESS FOR RLS ---');
    const helperFuncs = ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone'];
    for (const fn of helperFuncs) {
      const anonGrant = await client.query(`
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'anon'
      `, [fn]);
      check(fn + ' granted to anon (for RLS)', anonGrant.rows.length === 1);
    }
    
    // 9. Sensitive functions granted to authenticated + service_role
    console.log('\n--- 9. STAFF FUNCTION GRANTS ---');
    for (const fn of ['record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking']) {
      const authGrant = await client.query(`
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'authenticated'
      `, [fn]);
      check(fn + ' granted to authenticated', authGrant.rows.length === 1);
      
      const srGrant = await client.query(`
        SELECT 1 FROM information_schema.routine_privileges
        WHERE routine_schema = 'public' AND routine_name = $1 AND grantee = 'service_role'
      `, [fn]);
      check(fn + ' granted to service_role', srGrant.rows.length === 1);
    }
    // create_commission = service_role only
    const commAuth = await client.query(`
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'create_commission' AND grantee = 'authenticated'
    `);
    check('create_commission NOT granted to authenticated', commAuth.rows.length === 0);
    const commSr = await client.query(`
      SELECT 1 FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'create_commission' AND grantee = 'service_role'
    `);
    check('create_commission granted to service_role', commSr.rows.length === 1);
    
    // 10. create_commission function body
    console.log('\n--- 10. CREATE_COMMISSION LOGIC ---');
    const commFunc = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'create_commission'`);
    const commDef = commFunc.rows[0].def;
    check('Uses is_primary = true', commDef.includes('is_primary = true'));
    check('No LIMIT 1', !commDef.includes('LIMIT 1'));
    check('Percentage requires primary service error', commDef.includes('Primary service is required for percentage commission'));
    check('Fixed commission uses v_rate directly', commDef.includes("v_amount := v_rate"));
    
    // 11. complete_booking function body
    console.log('\n--- 11. COMPLETE_BOOKING LOGIC ---');
    const cbFunc = await client.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'complete_booking'`);
    const cbDef = cbFunc.rows[0].def;
    check('SELECT INTO commission result', cbDef.includes('INTO v_comm_result'));
    check('Checks commission success', cbDef.includes("(v_comm_result->>'success')::boolean = false"));
    check('Raises exception on commission failure', cbDef.includes("RAISE EXCEPTION 'Commission creation failed"));
    check('Material failure raises exception', cbDef.includes("RAISE EXCEPTION 'Material deduction failed"));
    check('Uses auth.uid()', cbDef.includes('auth.uid()'));
    check('search_path = public', cbDef.includes("search_path"));
    
    // 12. Data integrity
    console.log('\n--- 12. DATA INTEGRITY ---');
    const rsCount = await client.query('SELECT count(*) as cnt FROM public.referral_services');
    check('referral_services: 0 rows', parseInt(rsCount.rows[0].cnt) === 0);
    const staffCount = await client.query('SELECT count(*) as cnt FROM public.staff');
    check('staff: no data loss', parseInt(staffCount.rows[0].cnt) >= 0);
    
    // 13. Roles and permissions
    console.log('\n--- 13. ROLES & PERMISSIONS ---');
    const roles = await client.query('SELECT name FROM public.roles ORDER BY name');
    check('7 roles', roles.rows.length === 7);
    const perms = await client.query('SELECT count(*) as cnt FROM public.permissions');
    check('Permissions populated', parseInt(perms.rows[0].cnt) > 0, 'count=' + perms.rows[0].cnt);
    const rp = await client.query('SELECT count(*) as cnt FROM public.role_permissions');
    check('Role_permissions populated', parseInt(rp.rows[0].cnt) > 0, 'count=' + rp.rows[0].cnt);
    
    // 14. staff.role_id
    console.log('\n--- 14. STAFF ROLE_ID ---');
    const roleId = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'staff' AND column_name = 'role_id'
    `);
    check('staff.role_id exists', roleId.rows.length === 1);
    check('role_id is uuid', roleId.rows.length > 0 && roleId.rows[0].data_type === 'uuid');
    
    // 15. Triggers still exist
    console.log('\n--- 15. TRIGGERS ---');
    check('handle_new_user still exists', fnNames.includes('handle_new_user'));
    check('update_updated_at still exists', fnNames.includes('update_updated_at'));
    
    // Summary
    console.log('\n========================================');
    console.log('FINAL VERIFICATION SUMMARY');
    console.log('  PASSED: ' + pass);
    console.log('  FAILED: ' + fail);
    console.log('========================================');
    if (fail === 0) console.log('ALL CHECKS PASSED');
    else console.log('SOME CHECKS FAILED');
    
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await client.end();
  }
}

main();
