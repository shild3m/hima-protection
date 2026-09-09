const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    // ===== SECTION 1: Verify specific columns =====
    console.log('=== SECTION 1: VERIFYING SPECIFIC COLUMNS ===\n');

    const columnsToCheck = [
      ['bookings', 'idempotency_key'],
      ['bookings', 'created_by'],
      ['bookings', 'customer_notes'],
      ['bookings', 'source'],
      ['bookings', 'referral_id'],
      ['payments', 'idempotency_key'],
      ['payments', 'created_by'],
      ['payments', 'paid_at'],
      ['inventory_transactions', 'idempotency_key'],
      ['inventory_transactions', 'created_by'],
      ['inventory_transactions', 'vehicle_id'],
      ['inventory_transactions', 'booking_id'],
      ['inventory_transactions', 'service_id'],
      ['staff', 'role'],
      ['staff', 'user_id'],
      ['staff', 'is_active'],
      ['staff', 'role_id'],
      ['commissions', 'referral_id'],
      ['commissions', 'dealer_id'],
      ['commissions', 'service_id'],
      ['commissions', 'calculation_type'],
      ['commissions', 'rate_value'],
      ['commissions', 'calculated_amount'],
      ['commissions', 'status'],
      ['customers', 'source'],
      ['customers', 'phone'],
      ['customers', 'referred_by_dealer_id'],
      ['purchases', 'status'],
      ['purchases', 'total_amount'],
      ['purchases', 'received_at'],
      ['materials', 'current_stock'],
      ['materials', 'min_stock'],
      ['materials', 'is_active'],
      ['materials', 'cost_per_unit'],
      ['dealers', 'commission_type'],
      ['dealers', 'commission_value'],
      ['dealers', 'status'],
      ['dealers', 'is_active'],
      ['referrals', 'status'],
      ['referrals', 'dealer_id'],
      ['referrals', 'service_id'],
      ['referrals', 'completed_at'],
    ];

    for (const [table, col] of columnsToCheck) {
      const r = await client.query(
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
        [table, col]
      );
      if (r.rows.length === 0) {
        console.log('  MISSING: ' + table + '.' + col);
      } else {
        const c = r.rows[0];
        console.log('  OK: ' + table + '.' + col + ' (' + c.data_type + ', nullable=' + c.is_nullable + ', default=' + (c.column_default || 'none') + ')');
      }
    }

    // ===== SECTION 2: Check constraints =====
    console.log('\n=== SECTION 2: CHECK CONSTRAINTS ===\n');

    const checkTables = ['bookings', 'payments', 'inventory_transactions', 'staff', 'commissions', 'customers', 'purchases', 'materials', 'dealers', 'referrals'];
    for (const table of checkTables) {
      const r = await client.query(
        "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = ('public.' || $1)::regclass AND contype = 'c' ORDER BY conname",
        [table]
      );
      if (r.rows.length > 0) {
        for (const c of r.rows) {
          console.log('  ' + table + ': ' + c.conname + ' => ' + c.def);
        }
      }
    }

    // ===== SECTION 3: Current RLS policies =====
    console.log('\n=== SECTION 3: CURRENT RLS POLICIES ===\n');

    const policies = await client.query(
      "SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname"
    );
    for (const p of policies.rows) {
      console.log('  ' + p.tablename + '.' + p.policyname + ' [' + p.cmd + '] roles=' + JSON.stringify(p.roles));
      if (p.qual) console.log('    USING: ' + p.qual.substring(0, 120));
      if (p.with_check) console.log('    CHECK: ' + p.with_check.substring(0, 120));
    }

    // ===== SECTION 4: Tables with RLS enabled but no policies =====
    console.log('\n=== SECTION 4: TABLES WITH RLS ENABLED BUT NO SELECT POLICY ===\n');

    const rlsEnabled = await client.query(
      "SELECT c.relname as tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relrowsecurity = true AND c.relkind = 'r' ORDER BY c.relname"
    );
    const withSelect = new Set(
      (await client.query("SELECT DISTINCT tablename FROM pg_policies WHERE schemaname='public' AND cmd='SELECT'")).rows.map(r => r.tablename)
    );
    const withInsert = new Set(
      (await client.query("SELECT DISTINCT tablename FROM pg_policies WHERE schemaname='public' AND cmd='INSERT'")).rows.map(r => r.tablename)
    );
    const withUpdate = new Set(
      (await client.query("SELECT DISTINCT tablename FROM pg_policies WHERE schemaname='public' AND cmd='UPDATE'")).rows.map(r => r.tablename)
    );

    for (const r of rlsEnabled.rows) {
      const t = r.tablename;
      const missing = [];
      if (!withSelect.has(t)) missing.push('SELECT');
      if (!withInsert.has(t)) missing.push('INSERT');
      if (!withUpdate.has(t)) missing.push('UPDATE');
      if (missing.length > 0) {
        console.log('  ' + t + ': MISSING ' + missing.join(', ') + ' policies');
      }
    }

    // ===== SECTION 5: Verify bookings source CHECK constraint =====
    console.log('\n=== SECTION 5: bookings.source CHECK VALUES ===\n');
    const srcCheck = await client.query(
      "SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'public.bookings'::regclass AND conname LIKE '%source%'"
    );
    for (const r of srcCheck.rows) console.log('  ' + r.def);

    // ===== SECTION 6: Verify payments CHECK constraints =====
    console.log('\n=== SECTION 6: payments CHECK VALUES ===\n');
    const payCheck = await client.query(
      "SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'public.payments'::regclass AND contype='c'"
    );
    for (const r of payCheck.rows) console.log('  ' + r.def);

    // ===== SECTION 7: Verify inventory_transactions CHECK constraints =====
    console.log('\n=== SECTION 7: inventory_transactions CHECK VALUES ===\n');
    const invCheck = await client.query(
      "SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'public.inventory_transactions'::regclass AND contype='c'"
    );
    for (const r of invCheck.rows) console.log('  ' + r.def);

    // ===== SECTION 8: Verify commissions CHECK constraints =====
    console.log('\n=== SECTION 8: commissions CHECK VALUES ===\n');
    const comCheck = await client.query(
      "SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'public.commissions'::regclass AND contype='c'"
    );
    for (const r of comCheck.rows) console.log('  ' + r.def);

    // ===== SECTION 9: Check if functions reference non-existent columns =====
    console.log('\n=== SECTION 9: FUNCTIONS THAT EXIST ===\n');
    const funcs = await client.query(
      "SELECT p.proname, pg_get_function_arguments(p.oid) as args FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY p.proname"
    );
    for (const f of funcs.rows) console.log('  ' + f.proname + '(' + f.args + ')');

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
