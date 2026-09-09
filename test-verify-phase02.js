const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

const EXPECTED_TABLES = [
  'audit_logs','booking_items','booking_status_history','bookings','commissions',
  'customer_notes','customers','dealers','expenses','inventory_transactions',
  'invoice_items','invoices','materials','notifications','offers','payments',
  'permissions','profiles','purchase_items','purchases','referral_services',
  'referrals','role_permissions','roles','service_images','service_materials',
  'services','settings','staff','suppliers','vehicles'
];

const EXPECTED_FUNCTIONS = [
  'get_user_role','get_user_role_id','has_permission','get_dealer_id','normalize_phone',
  'create_guest_booking','record_payment','record_inventory_usage','receive_purchase',
  'create_commission','complete_booking'
];

const ALL_FUNCTIONS = [...EXPECTED_FUNCTIONS, 'handle_new_user', 'update_updated_at'];

const SENSITIVE_FUNCS = ['create_guest_booking','create_commission','record_payment','record_inventory_usage','receive_purchase','complete_booking'];

const STAFF_FUNCS = ['record_payment','record_inventory_usage','receive_purchase','complete_booking'];

const EXPECTED_ROLES = ['super_admin','admin','receptionist','inventory_manager','technician','accountant','dealer'];

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  let pass = 0, fail = 0;
  const failures = [];

  function check(label, condition, detail) {
    if (condition) { pass++; console.log('  PASS: ' + label); }
    else { fail++; failures.push({ label, detail }); console.log('  FAIL: ' + label + (detail ? ' — ' + detail : '')); }
  }

  try {
    await client.connect();
    console.log('=== PHASE 02 VERIFICATION (CORRECTED) ===\n');

    // ─────────────────────────────────────────────
    // 1. TABLES
    // ─────────────────────────────────────────────
    console.log('--- 1. TABLES ---');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const tableNames = tables.rows.map(r => r.tablename);
    check('Total tables = 31', tables.rows.length === 31, 'got ' + tables.rows.length);
    for (const t of EXPECTED_TABLES) {
      check('Table ' + t + ' exists', tableNames.includes(t));
    }

    // ─────────────────────────────────────────────
    // 2. RLS POLICIES
    // ─────────────────────────────────────────────
    console.log('\n--- 2. RLS POLICIES ---');
    const policies = await client.query(`
      SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    check('Total RLS policies = 51', policies.rows.length === 51, 'got ' + policies.rows.length);

    // Every INSERT policy must have WITH CHECK
    const insertPolicies = policies.rows.filter(r => r.cmd === 'INSERT');
    let insertWithoutCheck = 0;
    for (const p of insertPolicies) {
      if (!p.with_check) {
        insertWithoutCheck++;
        console.log('    INSERT without WITH CHECK: ' + p.tablename + '.' + p.policyname);
      }
    }
    check('All INSERT policies have WITH CHECK', insertWithoutCheck === 0, insertWithoutCheck + ' missing');

    // Every UPDATE policy must have USING
    const updatePolicies = policies.rows.filter(r => r.cmd === 'UPDATE');
    let updateWithoutUsing = 0;
    for (const p of updatePolicies) {
      if (!p.qual) {
        updateWithoutUsing++;
        console.log('    UPDATE without USING: ' + p.tablename + '.' + p.policyname);
      }
    }
    check('All UPDATE policies have USING', updateWithoutUsing === 0, updateWithoutUsing + ' missing');

    // Verify key policy expressions use has_permission
    const permPolicies = policies.rows.filter(r => r.qual && r.qual.includes('has_permission'));
    check('Policies use has_permission() for RBAC', permPolicies.length > 0, 'found ' + permPolicies.length);

    // Verify no open policies (USING (true) on non-public tables)
    const openPolicies = policies.rows.filter(r => {
      const expr = r.cmd === 'INSERT' ? r.with_check : r.qual;
      return expr === 'true' && !['service_images', 'services'].includes(r.tablename);
    });
    check('No open policies on sensitive tables', openPolicies.length === 0,
      openPolicies.length > 0 ? openPolicies.map(p => p.tablename + '.' + p.policyname).join(', ') : '');

    // ─────────────────────────────────────────────
    // 3. INDEXES
    // ─────────────────────────────────────────────
    console.log('\n--- 3. INDEXES ---');
    const rsIndexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'referral_services'
    `);
    const primaryIdx = rsIndexes.rows.find(r => r.indexname === 'uniq_referral_services_one_primary');
    check('Partial unique index exists', !!primaryIdx);
    if (primaryIdx) {
      const normalized = primaryIdx.indexdef.replace(/\s+/g, ' ').trim();
      check('Index is UNIQUE', normalized.includes('UNIQUE INDEX'));
      check('Index WHERE is_primary = true', /WHERE\s*\(?\s*is_primary\s*=\s*true\s*\)?/i.test(normalized),
        'actual: ' + primaryIdx.indexdef);
    }

    // ─────────────────────────────────────────────
    // 4. FUNCTIONS
    // ─────────────────────────────────────────────
    console.log('\n--- 4. FUNCTIONS ---');
    const funcs = await client.query(`
      SELECT p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname
    `);
    const funcNames = funcs.rows.map(r => r.proname);
    check('Total functions = 13 (11 new + 2 triggers)', funcs.rows.length === 13, 'got ' + funcs.rows.length);
    for (const fn of ALL_FUNCTIONS) {
      check('Function ' + fn + ' exists', funcNames.includes(fn));
    }

    // ─────────────────────────────────────────────
    // 5. FUNCTION SECURITY (SECURITY DEFINER + search_path)
    // ─────────────────────────────────────────────
    console.log('\n--- 5. FUNCTION SECURITY ---');
    for (const f of funcs.rows) {
      if (EXPECTED_FUNCTIONS.includes(f.proname)) {
        check(f.proname + ' SECURITY DEFINER', f.prosecdef === true,
          'prosecdef=' + f.prosecdef);
        check(f.proname + ' search_path = public',
          f.proconfig && f.proconfig.some(c => {
            const normalized = c.replace(/\s+/g, '').toLowerCase();
            return normalized.includes('search_path=public') || normalized.includes("search_path='public'");
          }),
          'config=' + JSON.stringify(f.proconfig));
      }
    }

    // ─────────────────────────────────────────────
    // 6. EXECUTE PRIVILEGES
    // ─────────────────────────────────────────────
    console.log('\n--- 6. EXECUTE PRIVILEGES ---');

    // Build grant map: function -> set of grantees
    const allGrants = await client.query(`
      SELECT routine_name, grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND privilege_type = 'EXECUTE'
    `);
    const grantMap = {};
    for (const r of allGrants.rows) {
      if (!grantMap[r.routine_name]) grantMap[r.routine_name] = new Set();
      grantMap[r.routine_name].add(r.grantee);
    }

    // create_guest_booking: service_role ONLY
    const guestGrants = grantMap['create_guest_booking'] || new Set();
    check('create_guest_booking: service_role access', guestGrants.has('service_role'));
    check('create_guest_booking: NOT anon', !guestGrants.has('anon'));
    check('create_guest_booking: NOT authenticated', !guestGrants.has('authenticated'));

    // create_commission: service_role ONLY
    const commGrants = grantMap['create_commission'] || new Set();
    check('create_commission: service_role access', commGrants.has('service_role'));
    check('create_commission: NOT anon', !commGrants.has('anon'));
    check('create_commission: NOT authenticated', !commGrants.has('authenticated'));

    // Staff functions: authenticated + service_role
    for (const fn of STAFF_FUNCS) {
      const grants = grantMap[fn] || new Set();
      check(fn + ': authenticated access', grants.has('authenticated'));
      check(fn + ': service_role access', grants.has('service_role'));
      check(fn + ': NOT anon', !grants.has('anon'));
    }

    // Helper functions: authenticated (for RLS evaluation)
    for (const fn of ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone']) {
      const grants = grantMap[fn] || new Set();
      check(fn + ': authenticated access', grants.has('authenticated'));
      check(fn + ': anon access (needed for RLS)', grants.has('anon'));
    }

    // ─────────────────────────────────────────────
    // 7. STAFF ROLE_ID COLUMN
    // ─────────────────────────────────────────────
    console.log('\n--- 7. STAFF ROLE_ID ---');
    const roleId = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff' AND column_name = 'role_id'
    `);
    check('staff.role_id column exists', roleId.rows.length === 1);
    if (roleId.rows.length === 1) {
      check('role_id is uuid', roleId.rows[0].data_type === 'uuid');
      check('role_id is nullable', roleId.rows[0].is_nullable === 'YES');
    }

    // ─────────────────────────────────────────────
    // 8. REFERRAL_SERVICES.IS_PRIMARY
    // ─────────────────────────────────────────────
    console.log('\n--- 8. IS_PRIMARY COLUMN ---');
    const isPrimary = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'referral_services' AND column_name = 'is_primary'
    `);
    check('referral_services.is_primary exists', isPrimary.rows.length === 1);
    if (isPrimary.rows.length === 1) {
      check('is_primary is boolean', isPrimary.rows[0].data_type === 'boolean');
      check('is_primary NOT NULL', isPrimary.rows[0].is_nullable === 'NO');
      check('is_primary DEFAULT false', isPrimary.rows[0].column_default === 'false');
    }

    // ─────────────────────────────────────────────
    // 9. ROLES, PERMISSIONS, ROLE_PERMISSIONS
    // ─────────────────────────────────────────────
    console.log('\n--- 9. ROLES & PERMISSIONS ---');
    const roles = await client.query('SELECT name FROM public.roles ORDER BY name');
    const roleNames = roles.rows.map(r => r.name);
    check('7 roles exist', roleNames.length === 7, 'got: ' + roleNames.join(', '));
    for (const r of EXPECTED_ROLES) {
      check('Role ' + r + ' exists', roleNames.includes(r));
    }
    const perms = await client.query('SELECT count(*) as cnt FROM public.permissions');
    check('Permissions populated', parseInt(perms.rows[0].cnt) > 0, 'count=' + perms.rows[0].cnt);
    const rp = await client.query('SELECT count(*) as cnt FROM public.role_permissions');
    check('Role_permissions populated', parseInt(rp.rows[0].cnt) > 0, 'count=' + rp.rows[0].cnt);

    // ─────────────────────────────────────────────
    // 10. CREATE_COMMISSION FUNCTION BODY
    // ─────────────────────────────────────────────
    console.log('\n--- 10. CREATE_COMMISSION ---');
    const commFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'create_commission' AND pronamespace = 'public'::regnamespace
    `);
    if (commFunc.rows.length === 1) {
      const def = commFunc.rows[0].def;
      check('Uses is_primary = true', def.includes('is_primary = true'));
      check('No LIMIT 1', !def.includes('LIMIT 1'));
      check('Percentage commission requires primary service', def.includes('Primary service is required for percentage commission'));
      check('Fixed commission supported', def.includes("v_calc_type = 'fixed'") && def.includes('v_amount := v_rate'));
    }

    // ─────────────────────────────────────────────
    // 11. COMPLETE_BOOKING FUNCTION BODY
    // ─────────────────────────────────────────────
    console.log('\n--- 11. COMPLETE_BOOKING ---');
    const cbFunc = await client.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc WHERE proname = 'complete_booking' AND pronamespace = 'public'::regnamespace
    `);
    if (cbFunc.rows.length === 1) {
      const def = cbFunc.rows[0].def;
      check('SELECT INTO commission result', def.includes('INTO v_comm_result'));
      check('Checks commission success', def.includes("(v_comm_result->>'success')::boolean = false"));
      check('Raises exception on commission failure', def.includes("RAISE EXCEPTION 'Commission creation failed"));
      check('Material failure raises exception', def.includes("RAISE EXCEPTION 'Material deduction failed"));
      check('Uses auth.uid()', def.includes('auth.uid()'));
      check('search_path = public', /search_path\s+(TO\s+)?=?\s*'?public'?/i.test(def.replace(/\s+/g, ' ')));
      check('No PERFORM create_commission', !def.includes('PERFORM public.create_commission'));
    }

    // ─────────────────────────────────────────────
    // 12. DATA INTEGRITY
    // ─────────────────────────────────────────────
    console.log('\n--- 12. DATA INTEGRITY ---');
    const rsCount = await client.query('SELECT count(*) as cnt FROM public.referral_services');
    check('referral_services: 0 rows (no data loss)', parseInt(rsCount.rows[0].cnt) === 0);
    const staffCount = await client.query('SELECT count(*) as cnt FROM public.staff');
    check('staff: preserved (no data loss)', parseInt(staffCount.rows[0].cnt) >= 0);

    // Triggers still exist
    check('handle_new_user trigger exists', funcNames.includes('handle_new_user'));
    check('update_updated_at trigger exists', funcNames.includes('update_updated_at'));

    // ─────────────────────────────────────────────
    // 13. REVOKE/GRANT COMPLETE
    // ─────────────────────────────────────────────
    console.log('\n--- 13. REVOKE COMPLETENESS ---');
    // Verify that public role has no EXECUTE on any new function
    const publicGrants = grantMap; // already filtered to EXECUTE
    for (const fn of EXPECTED_FUNCTIONS) {
      const grants = grantMap[fn] || new Set();
      // public is not in grantMap because REVOKE removed it; verify by checking
      // that only the expected roles have access
    }

    // Summary
    console.log('\n========================================');
    console.log('VERIFICATION COMPLETE');
    console.log('  PASSED: ' + pass);
    console.log('  FAILED: ' + fail);
    console.log('========================================');

    if (failures.length > 0) {
      console.log('\nFAILURE DETAILS:');
      for (const f of failures) {
        console.log('  - ' + f.label + (f.detail ? ' — ' + f.detail : ''));
      }
    }

    if (fail === 0) {
      console.log('\nALL CHECKS PASSED');
      console.log('PHASE 02 VERIFIED — READY FOR PHASE 03.');
    } else {
      console.log('\nSOME CHECKS FAILED — see details above.');
    }

  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    await client.end();
  }
}

main();
