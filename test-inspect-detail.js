const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();

    // Check staff columns
    console.log('--- STAFF COLUMNS ---');
    const cols = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'staff' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    for (const r of cols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ', nullable=' + r.is_nullable + ')');

    // Check existing staff data
    console.log('\n--- STAFF DATA ---');
    const staff = await client.query("SELECT id, user_id, email, role, is_active FROM public.staff LIMIT 5");
    for (const r of staff.rows) console.log('  ' + r.id + ' | ' + r.email + ' | role=' + r.role + ' | active=' + r.is_active);

    // Check existing RLS policies  
    console.log('\n--- ALL RLS POLICIES ---');
    const policies = await client.query(
      "SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname"
    );
    for (const r of policies.rows) {
      console.log('  ' + r.tablename + '.' + r.policyname + ' [' + r.cmd + ']');
      if (r.qual) console.log('    USING: ' + r.qual.substring(0, 100));
    }

    // Check bookings columns
    console.log('\n--- BOOKINGS COLUMNS ---');
    const bCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings' AND table_schema = 'public' ORDER BY ordinal_position"
    );
    for (const r of bCols.rows) console.log('  ' + r.column_name);

    // Check if any tables have NO policies
    console.log('\n--- TABLES WITHOUT SELECT POLICIES ---');
    const allTables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    const tablesWithSelect = await client.query(
      "SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public' AND cmd = 'SELECT'"
    );
    const withSelect = new Set(tablesWithSelect.rows.map(r => r.tablename));
    for (const r of allTables.rows) {
      if (!withSelect.has(r.tablename)) {
        console.log('  NO SELECT POLICY: ' + r.tablename);
      }
    }

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
