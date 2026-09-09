const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('=== CURRENT DATABASE STATE ===\n');

    // 1. Tables
    console.log('--- TABLES ---');
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );
    for (const r of tables.rows) console.log('  ' + r.table_name);

    // 2. Functions
    console.log('\n--- FUNCTIONS ---');
    const funcs = await client.query(
      "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name"
    );
    for (const r of funcs.rows) console.log('  ' + r.routine_name);

    // 3. RLS Policies
    console.log('\n--- RLS POLICIES ---');
    const policies = await client.query(
      "SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname"
    );
    for (const r of policies.rows) console.log('  ' + r.tablename + '.' + r.policyname + ' [' + r.cmd + ']');

    // 4. RLS enabled tables
    console.log('\n--- RLS ENABLED TABLES ---');
    const rls = await client.query(
      "SELECT tablename, relname FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename WHERE t.schemaname = 'public' AND c.relrowsecurity = true ORDER BY tablename"
    );
    for (const r of rls.rows) console.log('  ' + r.tablename);

    // 5. Roles table
    console.log('\n--- ROLES TABLE ---');
    try {
      const roles = await client.query("SELECT * FROM public.roles ORDER BY name");
      for (const r of roles.rows) console.log('  ' + r.id + ' | ' + r.name + ' | ' + r.description);
    } catch (e) { console.log('  NOT FOUND: ' + e.message); }

    // 6. Permissions table
    console.log('\n--- PERMISSIONS TABLE ---');
    try {
      const perms = await client.query("SELECT * FROM public.permissions ORDER BY resource, action");
      console.log('  Count: ' + perms.rows.length);
      for (const r of perms.rows) console.log('  ' + r.resource + ':' + r.action);
    } catch (e) { console.log('  NOT FOUND: ' + e.message); }

    // 7. Role_permissions table
    console.log('\n--- ROLE_PERMISSIONS TABLE ---');
    try {
      const rp = await client.query("SELECT count(*) as cnt FROM public.role_permissions");
      console.log('  Count: ' + rp.rows[0].cnt);
    } catch (e) { console.log('  NOT FOUND: ' + e.message); }

    // 8. Staff table columns
    console.log('\n--- STAFF TABLE COLUMNS ---');
    const staffCols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    for (const r of staffCols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

    // 9. Check which 002 functions exist
    console.log('\n--- 002 FUNCTIONS EXISTENCE CHECK ---');
    const fn002 = [
      'get_user_role', 'get_user_role_id', 'has_permission',
      'get_dealer_id', 'normalize_phone',
      'create_guest_booking', 'record_payment', 'record_inventory_usage',
      'receive_purchase', 'create_commission', 'complete_booking'
    ];
    for (const fn of fn002) {
      try {
        const r = await client.query(
          "SELECT proname, proargtypes::regtype[] as arg_types FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace",
          [fn]
        );
        if (r.rows.length > 0) {
          console.log('  ' + fn + ': EXISTS (args: ' + JSON.stringify(r.rows[0].arg_types) + ')');
        } else {
          console.log('  ' + fn + ': NOT FOUND');
        }
      } catch (e) {
        console.log('  ' + fn + ': ERROR - ' + e.message);
      }
    }

    // 10. Check triggers
    console.log('\n--- TRIGGERS ---');
    const triggers = await client.query(
      "SELECT trigger_name, event_object_table, action_timing FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table"
    );
    for (const r of triggers.rows) console.log('  ' + r.event_object_table + '.' + r.trigger_name + ' [' + r.action_timing + ']');

    // 11. Check indexes
    console.log('\n--- INDEXES (sample) ---');
    const indexes = await client.query(
      "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY tablename, indexname"
    );
    for (const r of indexes.rows) console.log('  ' + r.tablename + ': ' + r.indexname);

    console.log('\n=== END INSPECTION ===');
    
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
