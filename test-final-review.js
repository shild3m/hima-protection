const fs = require('fs');
const path = require('path');

const sqlFile = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '003_fix_security_migration.sql'), 'utf8');
const noSingleLine = sqlFile.replace(/--.*$/gm, '');
const clean = noSingleLine.replace(/\/\*[\s\S]*?\*\//g, '');
const statements = clean.split(';').map(s => s.trim()).filter(s => s.length > 0);

let allPass = true;
function check(label, condition, detail) {
  if (condition) {
    console.log('  PASS: ' + label);
  } else {
    console.log('  FAIL: ' + label + (detail ? ' -- ' + detail : ''));
    allPass = false;
  }
}

// 1. CREATE/DROP counts
console.log('=== 1. POLICY COUNTS ===');
const createPolicies = [];
const dropPolicies = [];
for (const stmt of statements) {
  const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();
  if (upper.startsWith('CREATE POLICY')) {
    const match = stmt.match(/CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)/i);
    if (match) createPolicies.push(match[2] + '.' + match[1]);
  }
  if (upper.startsWith('DROP POLICY')) {
    const match = stmt.match(/DROP POLICY\s+IF\s+EXISTS\s+"([^"]+)"\s+ON\s+public\.(\w+)/i);
    if (match) dropPolicies.push(match[2] + '.' + match[1]);
  }
}
check('CREATE POLICY count = 51', createPolicies.length === 51, 'got ' + createPolicies.length);
check('DROP POLICY IF EXISTS count = 51', dropPolicies.length === 51, 'got ' + dropPolicies.length);
const createSet = new Set(createPolicies);
const dropSet = new Set(dropPolicies);
const onlyCreate = createPolicies.filter(p => !dropSet.has(p));
const onlyDrop = dropPolicies.filter(p => !createSet.has(p));
check('Every CREATE has matching DROP', onlyCreate.length === 0 && onlyDrop.length === 0,
  onlyCreate.length > 0 ? 'Unmatched CREATE: ' + onlyCreate.join(', ') : onlyDrop.length > 0 ? 'Unmatched DROP: ' + onlyDrop.join(', ') : '');

// 2. GRANT/REVOKE verification
console.log('\n=== 2. GRANT/REVOKE ===');

// Extract all REVOKE lines
const revokeLines = sqlFile.match(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.\w+\([^)]*\)\s+FROM\s+\w+/gi) || [];
const grantLines = sqlFile.match(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.\w+\([^)]*\)\s+TO\s+[\w,\s]+/gi) || [];

// Parse grants per function
const grantMap = {};
for (const g of grantLines) {
  const funcMatch = g.match(/FUNCTION\s+public\.(\w+)\(/);
  const toMatch = g.match(/TO\s+(.+)/);
  if (funcMatch && toMatch) {
    const fn = funcMatch[1];
    const targets = toMatch[1].trim();
    grantMap[fn] = targets;
  }
}

// Staff functions must be granted to authenticated
const staffFuncs = ['record_payment', 'record_inventory_usage', 'receive_purchase', 'complete_booking'];
for (const fn of staffFuncs) {
  const targets = grantMap[fn] || 'NONE';
  check(fn + ' granted to authenticated', targets.includes('authenticated'), 'grants: ' + targets);
}

// create_guest_booking must be service_role only
check('create_guest_booking granted to service_role only', 
  grantMap['create_guest_booking'] === 'service_role', 
  'grants: ' + (grantMap['create_guest_booking'] || 'NONE'));

// create_commission must be service_role only
check('create_commission granted to service_role only',
  grantMap['create_commission'] === 'service_role',
  'grants: ' + (grantMap['create_commission'] || 'NONE'));

// Helpers must be authenticated
const helperFuncs = ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone'];
for (const fn of helperFuncs) {
  const targets = grantMap[fn] || 'NONE';
  check(fn + ' granted to authenticated', targets.includes('authenticated'), 'grants: ' + targets);
}

// 3. complete_booking commission check
console.log('\n=== 3. COMPLETE_BOOKING COMMISSION CHECK ===');
const completeBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking')) + 3);
check('No PERFORM create_commission', !completeBlock.includes('PERFORM public.create_commission'), 'PERFORM still exists');
check('Uses SELECT INTO for commission result', completeBlock.includes("SELECT public.create_commission(v_booking.referral_id) INTO v_comm_result"), '');
check('Checks commission success', completeBlock.includes("(v_comm_result->>'success')::boolean = false"), '');
check('Raises exception on commission failure', completeBlock.includes("RAISE EXCEPTION 'Commission creation failed"), '');

// 4. complete_booking variable declaration
console.log('\n=== 4. COMPLETE_BOOKING VARIABLES ===');
check('v_comm_result declared', completeBlock.includes('v_comm_result'), '');

// 5. create_commission: primary service logic
console.log('\n=== 5. CREATE_COMMISSION PRIMARY SERVICE ===');
const commBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission')) + 3);
check('No LIMIT 1 in create_commission', !commBlock.includes('LIMIT 1'), 'LIMIT 1 still present');
check('Uses is_primary = true', commBlock.includes("rs.is_primary = true"), '');
check('Percentage commission requires primary service', commBlock.includes('Primary service is required for percentage commission'), '');
check('Fixed commission ignores service', commBlock.includes("v_calc_type = 'fixed'") && commBlock.includes('v_amount := v_rate'), '');

// 5b. is_primary column and index
console.log('\n=== 5b. IS_PRIMARY SCHEMA ===');
check('ALTER TABLE referral_services ADD COLUMN is_primary', sqlFile.includes('ALTER TABLE public.referral_services ADD COLUMN IF NOT EXISTS is_primary'), '');
check('Partial unique index for is_primary', sqlFile.includes('uniq_referral_services_one_primary'), '');
check('Index WHERE is_primary = true', sqlFile.includes('WHERE is_primary = true'), '');

// 6. SECURITY DEFINER + SET search_path = public
console.log('\n=== 6. FUNCTION SECURITY ===');
const funcNames = ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone',
  'create_guest_booking', 'record_payment', 'record_inventory_usage', 'receive_purchase', 'create_commission', 'complete_booking'];
for (const fn of funcNames) {
  const block = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn)) + 3);
  check(fn + ' SECURITY DEFINER', block.includes('SECURITY DEFINER'), '');
  check(fn + ' SET search_path = public', block.includes("SET search_path = public"), '');
}

// 7. All REVOKE FROM public
console.log('\n=== 7. REVOKE ALL FROM PUBLIC ===');
const revokes = [];
for (const r of revokeLines) {
  const fnMatch = r.match(/FUNCTION\s+public\.(\w+)/);
  if (fnMatch) revokes.push(fnMatch[1]);
}
for (const fn of funcNames) {
  check(fn + ' has REVOKE ALL FROM public', revokes.includes(fn), '');
}

// 8. RLS: INSERT policies have WITH CHECK
console.log('\n=== 8. RLS POLICY STRUCTURE ===');
let rlsIssues = 0;
for (const stmt of statements) {
  const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();
  if (upper.startsWith('CREATE POLICY')) {
    const match = stmt.match(/CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)\s+FOR\s+(\w+)/i);
    if (match) {
      const [, name, table, cmd] = match;
      if (cmd === 'INSERT' && !upper.includes('WITH CHECK')) {
        console.log('  WARN: INSERT policy ' + table + '.' + name + ' missing WITH CHECK');
        rlsIssues++;
      }
      if (cmd === 'UPDATE' && !upper.includes('USING')) {
        console.log('  WARN: UPDATE policy ' + table + '.' + name + ' missing USING');
        rlsIssues++;
      }
    }
  }
}
check('All INSERT policies have WITH CHECK', rlsIssues === 0, rlsIssues + ' issues found');

// 9. create_guest_booking auth.uid() check
console.log('\n=== 9. CREATE_GUEST_BOOKING AUTH ===');
const guestBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_guest_booking'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_guest_booking')) + 3);
check('create_guest_booking does NOT use auth.uid()', !guestBlock.includes('auth.uid()'), '');

// 10. $$ markers
console.log('\n=== 10. SYNTAX ===');
const dollarCount = (sqlFile.match(/\$\$/g) || []).length;
check('Even number of $$ markers (' + dollarCount + ')', dollarCount % 2 === 0, '');

// 11. Schema references in all functions
console.log('\n=== 11. SCHEMA REFERENCES ===');
// Verify key tables exist in function bodies
const keyTableRefs = {
  'get_user_role': ['public.staff', 'public.roles', 'public.dealers'],
  'has_permission': ['public.role_permissions', 'public.permissions'],
  'create_guest_booking': ['public.services', 'public.customers', 'public.vehicles', 'public.bookings', 'public.booking_status_history'],
  'record_payment': ['public.invoices', 'public.payments', 'public.audit_logs'],
  'record_inventory_usage': ['public.materials', 'public.inventory_transactions', 'public.notifications', 'public.staff', 'public.roles'],
  'receive_purchase': ['public.purchases', 'public.purchase_items', 'public.inventory_transactions', 'public.materials', 'public.audit_logs'],
  'create_commission': ['public.referrals', 'public.dealers', 'public.referral_services', 'public.services', 'public.commissions', 'public.audit_logs'],
  'complete_booking': ['public.bookings', 'public.booking_status_history', 'public.referrals', 'public.audit_logs'],
};
for (const [fn, tables] of Object.entries(keyTableRefs)) {
  const block = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn)) + 3);
  for (const t of tables) {
    check(fn + ' references ' + t, block.includes(t), '');
  }
}
// complete_booking delegates to create_commission
const completeBlockForCheck = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking')) + 3);
check('complete_booking delegates to create_commission', completeBlockForCheck.includes('public.create_commission'), '');

// 12. UPDATE staff statement (data modification)
console.log('\n=== 12. DATA MODIFICATION IN MIGRATION ===');
check('UPDATE public.staff SET role_id exists', sqlFile.includes("UPDATE public.staff s"), '');
check('UPDATE targets role_id IS NULL rows', sqlFile.includes("s.role_id IS NULL"), '');

// 13. complete_booking inventory failure rollback
console.log('\n=== 13. COMPLETE_BOOKING INVENTORY ROLLBACK ===');
check('RAISE EXCEPTION on material failure', completeBlock.includes("RAISE EXCEPTION 'Material deduction failed"), '');

// 14. complete_booking transaction: booking update after inventory
console.log('\n=== 14. COMPLETE_BOOKING TRANSACTION ORDER ===');
const inventoryLoop = completeBlock.indexOf('v_usage_result := public.record_inventory_usage');
const bookingUpdate = completeBlock.indexOf("SET status = 'completed'");
const commissionCall = completeBlock.indexOf('SELECT public.create_commission');
check('Inventory deducted before booking status update', inventoryLoop < bookingUpdate, '');
check('Booking status update before commission creation', bookingUpdate < commissionCall, '');

// 15. INSERT policies: anonymous should NOT be able to insert sensitive tables
console.log('\n=== 15. INSERT POLICY PERMISSIONS ===');
// These tables should NOT have a policy allowing anonymous INSERT
const sensitiveInsertPolicies = [
  { table: 'bookings', policy: 'staff_insert_bookings', resource: 'bookings', action: 'create' },
  { table: 'customers', policy: 'staff_insert_customers', resource: 'customers', action: 'create' },
  { table: 'vehicles', policy: 'staff_insert_vehicles', resource: 'vehicles', action: 'create' },
];
for (const p of sensitiveInsertPolicies) {
  const policyBlock = sqlFile.substring(
    sqlFile.indexOf('"' + p.policy + '"'),
    sqlFile.indexOf('$$;', sqlFile.indexOf('"' + p.policy + '"'))
  );
  check(p.policy + ' uses has_permission (not open)', policyBlock.includes('has_permission'), '');
}

console.log('\n========================================');
if (allPass) {
  console.log('ALL CHECKS PASSED');
} else {
  console.log('SOME CHECKS FAILED - review above');
}
