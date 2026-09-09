import { createClient } from "@supabase/supabase-js";

const URL = "https://nzspowfxwntxfievmmxq.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
const ADMIN_ID = "0c6ef34b-ccf8-46dc-9235-6389ff1e8026";

const sb = createClient(URL, KEY);

async function check() {
  console.log("=== CHECKING MIGRATION 026 STATUS ===\n");

  // Test 1: Try concurrent inserts to detect EXCEPTION handler
  const refId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  console.log("TEST 1: Exception handler (3 concurrent create_notification)...");

  // First clean
  await sb.from("notifications").delete()
    .eq("user_id", ADMIN_ID)
    .eq("reference_id", refId);

  const promises = Array.from({ length: 3 }, (_, i) =>
    sb.rpc("create_notification", {
      p_user_id: ADMIN_ID,
      p_type: "low_stock",
      p_title: "Exception Check",
      p_message: `check ${i}`,
      p_reference_type: "materials",
      p_reference_id: refId,
    })
  );

  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error).length;
  const dupes = results.filter(r => r.data?.duplicate === true).length;
  const inserted = results.filter(r => r.data?.success === true && !r.data?.duplicate).length;

  console.log(`  Inserted: ${inserted}, Duplicates: ${dupes}, Errors: ${errors}`);
  console.log(`  EXCEPTION HANDLER: ${errors === 0 ? "WORKING (no errors leaked)" : "NOT WORKING (errors leaked to client)"}`);

  // Test 2: Check if rows are correctly deduplicated
  const { count: rowCount } = await sb.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ADMIN_ID)
    .eq("reference_id", refId);
  console.log(`\nTEST 2: Duplicate rows in DB: ${rowCount}`);
  console.log(`  PARTIAL UNIQUE INDEX: ${rowCount === 1 ? "WORKING" : "NOT WORKING (multiple rows)"}`);

  // Test 3: Check NULL reference behavior
  const { count: nullCount } = await sb.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ADMIN_ID)
    .eq("type", "low_stock")
    .is("reference_type", null)
    .is("reference_id", null);
  console.log(`\nTEST 3: NULL-reference rows: ${nullCount}`);

  // Cleanup
  await sb.from("notifications").delete()
    .eq("user_id", ADMIN_ID)
    .eq("reference_id", refId);

  console.log("\n=== MIGRATION STATUS ===");
  if (errors === 0 && rowCount === 1) {
    console.log("CORRECTED MIGRATION 026: APPLIED");
  } else {
    console.log("CORRECTED MIGRATION 026: NOT APPLIED (old version or not yet run)");
    console.log(`  Evidence: errors=${errors} rows=${rowCount}`);
  }
}

check().catch(e => console.error("FATAL:", e.message));
