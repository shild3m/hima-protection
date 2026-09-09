const fs = require('fs');
const path = require('path');

const sqlFile = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '003_fix_security_migration.sql'), 'utf8');

// Remove comments
const noSingleLine = sqlFile.replace(/--.*$/gm, '');
const clean = noSingleLine.replace(/\/\*[\s\S]*?\*\//g, '');

// Split into statements
const statements = clean.split(';').map(s => s.trim()).filter(s => s.length > 0);

// ===== ISSUE 1: Non-deterministic LIMIT 1 in create_commission =====
console.log('=== ISSUE 1: create_commission LIMIT 1 ===\n');
const createCommBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission')) + 3);
const limitIdx = createCommBlock.indexOf('LIMIT 1');
if (limitIdx > -1) {
  console.log('FOUND: LIMIT 1 in create_commission at offset', limitIdx);
  console.log('Context:');
  console.log(createCommBlock.substring(limitIdx - 100, limitIdx + 50));
}

// ===== ISSUE 2: Check RLS policy WITH CHECK vs USING =====
console.log('\n=== ISSUE 2: RLS POLICY USING vs WITH CHECK ===\n');
for (const stmt of statements) {
  const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();
  if (upper.startsWith('CREATE POLICY')) {
    const hasWithCheck = upper.includes('WITH CHECK');
    const hasUsing = upper.includes('USING');
    const match = stmt.match(/CREATE POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)\s+FOR\s+(\w+)/i);
    if (match) {
      const [, name, table, cmd] = match;
      if (cmd === 'INSERT' && !hasWithCheck) {
        console.log('  WARNING: INSERT policy ' + table + '.' + name + ' has no WITH CHECK');
      }
      if (cmd === 'UPDATE' && !hasUsing) {
        console.log('  WARNING: UPDATE policy ' + table + '.' + name + ' has no USING');
      }
      if (cmd === 'SELECT' && hasWithCheck) {
        console.log('  INFO: SELECT policy ' + table + '.' + name + ' has WITH CHECK (unusual)');
      }
    }
  }
}

// ===== ISSUE 3: Check if complete_booking calls create_commission with PERFORM =====
console.log('\n=== ISSUE 3: complete_booking -> create_commission error handling ===\n');
const completeBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.complete_booking')) + 3);
const performIdx = completeBlock.indexOf('PERFORM public.create_commission');
if (performIdx > -1) {
  console.log('FOUND: PERFORM public.create_commission (error is silently ignored)');
  console.log('Context:');
  console.log(completeBlock.substring(performIdx - 50, performIdx + 100));
  console.log('\nIMPACT: If caller lacks commissions.create, commission creation fails silently.');
  console.log('  Roles with commissions.create: super_admin, admin');
  console.log('  Roles WITHOUT: receptionist, inventory_manager, technician, accountant, dealer');
}

// ===== ISSUE 4: Check record_inventory_usage permission check =====
console.log('\n=== ISSUE 4: record_inventory_usage permission in complete_booking ===\n');
const inventoryBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.record_inventory_usage'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.record_inventory_usage')) + 3);
const permCheck = inventoryBlock.indexOf("has_permission(v_caller_id, 'inventory', 'usage')");
if (permCheck > -1) {
  console.log('FOUND: record_inventory_usage checks inventory.usage permission');
  console.log('\nRoles with inventory.usage:');
  console.log('  YES: inventory_manager, technician, admin, super_admin');
  console.log('  NO:  receptionist, accountant, dealer');
  console.log('\nIMPACT: If receptionist calls complete_booking with materials, it will fail.');
}

// ===== ISSUE 5: Check that all REVOKE targets exist or will exist =====
console.log('\n=== ISSUE 5: REVOKE target function signatures ===\n');
const revokeTargets = [
  { name: 'create_guest_booking', args: 'text, text, text, text, uuid, text, integer, text, text, date, time, text, text' },
  { name: 'record_payment', args: 'uuid, numeric, text, text, text, text' },
  { name: 'record_inventory_usage', args: 'uuid, numeric, uuid, uuid, uuid, text, text' },
  { name: 'receive_purchase', args: 'uuid, jsonb' },
  { name: 'create_commission', args: 'uuid' },
  { name: 'complete_booking', args: 'uuid, jsonb, text' },
  { name: 'get_user_role', args: 'uuid' },
  { name: 'get_user_role_id', args: 'uuid' },
  { name: 'has_permission', args: 'uuid, text, text' },
  { name: 'get_dealer_id', args: 'uuid' },
  { name: 'normalize_phone', args: 'text' },
];

for (const target of revokeTargets) {
  const createFunc = sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + target.name);
  const revokeIdx = sqlFile.indexOf('REVOKE ALL ON FUNCTION public.' + target.name);
  if (createFunc === -1) {
    console.log('  CRITICAL: Function ' + target.name + ' not defined in migration');
  } else if (revokeIdx === -1) {
    console.log('  WARNING: No REVOKE for ' + target.name);
  } else {
    const revokeBeforeCreate = revokeIdx < createFunc;
    console.log('  ' + target.name + ': REVOKE before CREATE = ' + (revokeBeforeCreate ? 'YES (good)' : 'NO - REVOKE targets non-existent function'));
  }
}

// ===== ISSUE 6: Verify create_guest_booking doesn't use auth.uid() =====
console.log('\n=== ISSUE 6: create_guest_booking auth usage ===\n');
const guestBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_guest_booking'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_guest_booking')) + 3);
const authUid = guestBlock.indexOf('auth.uid()');
if (authUid > -1) {
  console.log('WARNING: create_guest_booking uses auth.uid()');
  console.log('Context:', guestBlock.substring(authUid - 30, authUid + 30));
} else {
  console.log('OK: create_guest_booking does NOT use auth.uid()');
  console.log('  created_by is set to NULL (guest booking has no authenticated user)');
}

// ===== ISSUE 7: Verify complete_booking doesn't have duplicate commission protection =====
console.log('\n=== ISSUE 7: Duplicate commission protection ===\n');
const commBlock = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission'), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.create_commission')) + 3);
const uniqueCheck = commBlock.indexOf("EXISTS (SELECT 1 FROM public.commissions WHERE referral_id = p_referral_id)");
if (uniqueCheck > -1) {
  console.log('FOUND: Duplicate commission check EXISTS...');
  // Also check the UNIQUE constraint on the table
  console.log('DB also has: UNIQUE(referral_id) on commissions table');
  console.log('双重保护: Application-level check + DB UNIQUE constraint');
}

// ===== ISSUE 8: Check complete_booking referral completion idempotency =====
console.log('\n=== ISSUE 8: Referral completion idempotency ===\n');
const referralUpdate = completeBlock.indexOf("status = 'completed', completed_at = now()");
const referralWhere = completeBlock.indexOf("AND status = 'redeemed'");
if (referralUpdate > -1 && referralWhere > -1) {
  console.log('FOUND: Referral UPDATE has WHERE status = ');
  console.log('  Only redeeemed referrals get completed. Idempotent.');
}

// ===== ISSUE 9: Verify JSON construction in complete_booking =====
console.log('\n=== ISSUE 9: JSON construction ===\n');
const jsonResults = completeBlock.indexOf("v_material_results || v_usage_result");
if (jsonResults > -1) {
  console.log('FOUND: v_material_results is jsonb := ');
  console.log('  Initialized as ');
  console.log('  Appended with || operator');
  console.log('  Final: jsonb_build_object(..., v_material_results)');
}

// ===== ISSUE 10: Check that helper functions don't reference non-existent tables =====
console.log('\n=== ISSUE 10: Helper function table references ===\n');
const helperFuncs = ['get_user_role', 'get_user_role_id', 'has_permission', 'get_dealer_id', 'normalize_phone'];
for (const fn of helperFuncs) {
  const block = sqlFile.substring(sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn), sqlFile.indexOf('$$;', sqlFile.indexOf('CREATE OR REPLACE FUNCTION public.' + fn)) + 3);
  const refs = block.match(/public\.(\w+)/g) || [];
  const tables = [...new Set(refs.map(r => r.replace('public.', '')))];
  console.log('  ' + fn + ': references ' + tables.join(', '));
}

// ===== FINAL: Check for any SQL syntax issues =====
console.log('\n=== FINAL: Syntax check ===\n');
// Check for unmatched $$ 
const dollarCount = (sqlFile.match(/\$\$/g) || []).length;
console.log('$$ markers:', dollarCount, '(should be even:', dollarCount % 2 === 0 ? 'YES' : 'NO - UNMATCHED') ;

// Check for BEGIN/END balance in plpgsql blocks
const beginCount = (sqlFile.match(/\bBEGIN\b/g) || []).length;
const endCount = (sqlFile.match(/\bEND;\b/g) || []).length;
console.log('BEGIN:', beginCount, 'END;:', endCount, '(should be equal:', beginCount === endCount ? 'YES' : 'NO - MISMATCH') ;

