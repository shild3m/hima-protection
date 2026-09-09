const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  let pass = 0, fail = 0;
  
  function check(label, condition, detail) {
    if (condition) { pass++; console.log('  PASS: ' + label); }
    else { fail++; console.log('  FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
  }
  
  try {
    await client.connect();
    console.log('=== POST-MIGRATION VERIFICATION ===\n');
    
    // 1. Tables
    console.log('--- 1. TABLES ---');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    check('Tables exist (30)', tables.rows.length === 30, 'got ' + tables.rows.length);
    
    // 2. New tables
    console.log('\n--- 2. NEW TABLES (Phase 02) ---');
    const tableNames = tables.rows.map(r => r.tablename);
    check('roles table exists', tableNames.includes('roles'));
    check('permissions table exists', tableNames.includes('permissions'));
    check('role_permissions table exists', tableNames.includes('role_permissions'));
    
    // 3. Permissions data
    console.log('\n--- 3. PERMISSIONS DATA ---');
    const perms = await client.query('SELECT count(*) as cnt FROM public.permissions');
    check('Permissions rows > 0', parseInt(perms.rows[0].cnt) > 0, 'count=' + perms.rows[0].cnt);
    
    const rp = await client.query('SELECT count(*) as cnt FROM public.role_permissions');
    check('Role_permissions rows > 0', parseInt(rp.rows[0].cnt) > 0, 'count=' + rp.rows[0].cnt);
    
    // 4. Roles
    console.log('\n--- 4. ROLES ---');
    const roles = await client.query('SELECT name FROM public.roles ORDER BY name');
    const roleNames = roles.rows.map(r => r.name);
    check('7 roles exist', roleNames.length === 7, 'got: ' + roleNames.join(', '));
    check('Has super_admin', roleNames.includes('super_admin'));
    check('Has admin', roleNames.includes('admin'));
    check('Has receptionist', roleNames.includes('receptionist'));
    check('Has inventory_manager', roleNames.includes('inventory_manager'));
    check('Has technician', roleNames.includes('technician'));
    check('Has accountant', roleNames.includes('accountant'));
    check('Has dealer', roleNames.includes('dealer'));
    
    // 5. Staff role_id column
    console.log('\n--- 5. STAFF ROLE_ID ---');
    const staffCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff' AND table_schema = 'public' AND column_name = 'role_id'
    `);
    check('staff.role_id column exists', staffCols.rows.length === 1);
    if (staffCols.rows.length === 1) {
      check('role_id is uuid', staffCols.rows[0].data_type === 'uuid');
      check('role_id is nullable', staffCols.rows[0].is_nullable === 'YES');
    }
    
    // 6. referral_services.is_primary
    console.log('\n--- 6. REFERRAL_SERVICES IS_PRIMARY ---');
    const rsCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'referral_services' AND table_schema = 'public' AND column_name = 'is_primary'
    `);
    check('referral_services.is_primary exists', rsCols.rows.length === 1);
    if (rsCols.rows.length === 1) {
      check('is_primary is boolean', rsCols.rows[0].data_type === 'boolean');
      check('is_primary NOT NULL', rsCols.rows[0].is_nullable === 'NO');
      check('is_primary DEFAULT false', rsCols.rows[0].column_default === 'false');
    }
    
    // 7. Partial unique index
    console.log('\n--- 7. PARTIAL UNIQUE INDEX ---');
    const idx = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'referral_services' AND indexname = 'uniq_referral_services_one_primary'
    `);
    check('Partial unique index exists', idx.rows.length === 1);
    if (idx.rows.length === 1) {
      check('Index is UNIQUE', idx.rows[0].indexdef.includes('UNIQUE'));
      check('Index WHERE is_primary = true', idx.rows[0].indexdef.includes('WHERE is_primary = true'));
      console.log('    Index def: ' + idx.rows[0].indexdef);
    }
    
    // 8. Functions
    console.log('\n--- 8. FUNCTIONS ---');
    const funcs = await client.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args,
        p.prosecdef as is_secdef, p.proconfig as config
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
      ORDER BY p.proname
    `);
    const funcNames = funcs.rows.map(r => r.proname);
    check('13 functions exist (11 new + 2 trigger)', funcs.rows.length === 13, 'got ' + funcs.rows.length);
    
    const expectedFuncs = ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone',
      'create_guest_booking', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'create_commission', 'complete_booking'];
    for (const fn of expectedFuncs) {
      check('Function ' + fn + ' exists', funcNames.includes(fn));
    }
    
    // 9. SECURITY DEFINER + search_path
    console.log('\n--- 9. FUNCTION SECURITY ---');
    for (const fn of funcs.rows) {
      if (expectedFuncs.includes(fn.proname)) {
        check(fn.proname + ' SECURITY DEFINER', fn.is_secdef === true);
        const hasSearchPath = fn.config && fn.config.some(c => c.startsWith('search_path='));
        check(fn.proname + ' SET search_path = public', hasSearchPath);
      }
    }
    
    // 10. RLS Policies
    console.log('\n--- 10. RLS POLICIES ---');
    const policies = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    check('51 RLS policies exist', policies.rows.length === 51, 'got ' + policies.rows.length);
    
    // Count by type
    const selectCount = policies.rows.filter(r => r.cmd === 'SELECT').length;
    const insertCount = policies.rows.filter(r => r.cmd === 'INSERT').length;
    const updateCount = policies.rows.filter(r => r.cmd === 'UPDATE').length;
    check('SELECT policies: 21', selectCount === 21, 'got ' + selectCount);
    check('INSERT policies: 12', insertCount === 12, 'got ' + insertCount);
    check('UPDATE policies: 18', updateCount === 18, 'got ' + updateCount);
    
    // 11. REVOKE/GRANT
    console.log('\n--- 11. REVOKE/GRANT ---');
    // Check that staff functions are granted to authenticated
    const authGrants = await client.query(`
      SELECT routine_name, grantee
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND grantee = 'authenticated'
      ORDER BY routine_name
    `);
    const authGrantFuncs = authGrants.rows.map(r => r.routine_name);
    for (const fn of ['record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking']) {
      check(fn + ' granted to authenticated', authGrantFuncs.includes(fn));
    }
    for (const fn of ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone']) {
      check(fn + ' granted to authenticated', authGrantFuncs.includes(fn));
    }
    
    // Check service_role grants
    const srGrants = await client.query(`
      SELECT routine_name, grantee
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND grantee = 'service_role'
      ORDER BY routine_name
    `);
    const srGrantFuncs = srGrants.rows.map(r => r.routine_name);
    for (const fn of ['create_guest_booking', 'create_commission', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking']) {
      check(fn + ' granted to service_role', srGrantFuncs.includes(fn));
    }
    
    // Check anonymous does NOT have access to sensitive functions
    const anonGrants = await client.query(`
      SELECT routine_name, grantee
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND grantee = 'anon'
      ORDER BY routine_name
    `);
    const anonGrantFuncs = anonGrants.rows.map(r => r.routine_name);
    for (const fn of ['create_guest_booking', 'create_commission', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking']) {
      check(fn + ' NOT granted to anon', !anonGrantFuncs.includes(fn));
    }
    
    // 12. create_commission uses is_primary
    console.log('\n--- 12. CREATE_COMMISSION FUNCTION BODY ---');
    const commFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'create_commission' AND pronamespace = 'public'::regnamespace
    `);
    if (commFunc.rows.length === 1) {
      const def = commFunc.rows[0].def;
      check('Uses is_primary = true', def.includes('is_primary = true'));
      check('No LIMIT 1', !def.includes('LIMIT 1'));
      check('Percentage commission error message', def.includes('Primary service is required for percentage commission'));
      check('Fixed commission uses v_rate', def.includes('v_amount := v_rate'));
    }
    
    // 13. complete_booking checks commission result
    console.log('\n--- 13. COMPLETE_BOOKING FUNCTION BODY ---');
    const cbFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'complete_booking' AND pronamespace = 'public'::regnamespace
    `);
    if (cbFunc.rows.length === 1) {
      const def = cbFunc.rows[0].def;
      check('SELECT INTO commission result', def.includes("SELECT public.create_commission(v_booking.referral_id) INTO v_comm_result"));
      check('Checks commission success', def.includes("(v_comm_result->>'success')::boolean = false"));
      check('Raises exception on failure', def.includes("RAISE EXCEPTION 'Commission creation failed"));
      check('No PERFORM create_commission', !def.includes('PERFORM public.create_commission'));
      check('Material failure raises exception', def.includes("RAISE EXCEPTION 'Material deduction failed"));
      check('Uses auth.uid()', def.includes('auth.uid()'));
      check('SET search_path = public', def.includes('SET search_path = public'));
    }
    
    // 14. Data integrity
    console.log('\n--- 14. DATA INTEGRITY ---');
    const rsCount = await client.query('SELECT count(*) as cnt FROM public.referral_services');
    check('referral_services has 0 rows (no data loss)', parseInt(rsCount.rows[0].cnt) === 0);
    const staffCount = await client.query('SELECT count(*) as cnt FROM public.staff');
    check('staff has 0 rows (no data loss)', parseInt(staffCount.rows[0].cnt) === 0);
    
    // 15. No destructive changes
    console.log('\n--- 15. NO DESTRUCTIVE CHANGES ---');
    check('No DROP SCHEMA executed (30 tables exist)', tables.rows.length === 30);
    check('handle_new_user trigger still exists', funcNames.includes('handle_new_user'));
    check('update_updated_at trigger still exists', funcNames.includes('update_updated_at'));
    
    // 16. RLS INSERT policies have WITH CHECK
    console.log('\n--- 16. INSERT POLICY STRUCTURE ---');
    const insertPolicies = policies.rows.filter(r => r.cmd === 'INSERT');
    // These should all have WITH CHECK (we verify by checking the policy definition)
    const insertPolicyDefs = await client.query(`
      SELECT policyname, tablename, qual, with_check
      FROM pg_policies WHERE schemaname = 'public' AND cmd = 'INSERT'
      ORDER BY tablename, policyname
    `);
    let insertIssues = 0;
    for (const p of insertPolicyDefs.rows) {
      if (!p.with_check) {
        console.log('  WARN: ' + p.tablename + '.' + p.policyname + ' missing WITH CHECK');
        insertIssues++;
      }
    }
    check('All INSERT policies have WITH CHECK', insertIssues === 0, insertIssues + ' issues');
    
    // 17. Table counts
    console.log('\n--- 17. TABLE COUNTS ---');
    const tableCounts = await client.query(`
      SELECT schemaname, tablename, 
        (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') as policy_count
      FROM pg_tables t
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    let totalPolicies = 0;
    for (const t of tableCounts.rows) {
      totalPolicies += parseInt(t.policy_count);
    }
    check('Total policies across all tables: 51', totalPolicies === 51, 'got ' + totalPolicies);
    
    // Summary
    console.log('\n========================================');
    console.log('VERIFICATION SUMMARY');
    console.log('  PASSED: ' + pass);
    console.log('  FAILED: ' + fail);
    console.log('========================================');
    
    if (fail === 0) {
      console.log('ALL CHECKS PASSED');
    } else {
      console.log('SOME CHECKS FAILED');
    }
    
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await client.end();
  }
}

main();
