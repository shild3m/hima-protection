import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nzspowfxwntxfievmmxq.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3Bvd2Z4d250eGZpZXZtbXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzY4MjAyNywiZXhwIjoyMTAzMjU4MDI3fQ.lsVTc9abotzJx6hF8F2CifY_sUEic22awdnOn-9Ritg";
const EMAIL = "reception@hima.com";
const PASS = process.env.TEST_PASSWORD || "Aa123456";

const admin = createClient(URL, SERVICE_KEY);

async function main() {
  // 1. Check if user already exists in auth
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === EMAIL);

  let userId;
  if (existing) {
    console.log(`User ${EMAIL} already exists: ${existing.id}`);
    userId = existing.id;
  } else {
    // Create auth user with auto-confirm
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASS,
      email_confirm: true,
    });
    if (error) { console.error("Create user error:", error.message); process.exit(1); }
    userId = data.user.id;
    console.log(`Created auth user: ${userId}`);
  }

  // 2. Get receptionist role_id
  const { data: role } = await admin
    .from("roles")
    .select("id")
    .eq("name", "receptionist")
    .single();

  if (!role) { console.error("receptionist role not found!"); process.exit(1); }
  console.log(`Receptionist role_id: ${role.id}`);

  // 3. Check if staff record already exists
  const { data: existingStaff } = await admin
    .from("staff")
    .select("id, user_id, role, role_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingStaff) {
    console.log(`Staff record already exists: ${existingStaff.id}`);
    // Update role_id if null
    if (!existingStaff.role_id) {
      await admin.from("staff").update({ role_id: role.id }).eq("id", existingStaff.id);
      console.log("Updated role_id");
    }
  } else {
    // Create staff record
    const { data: staff, error: staffError } = await admin
      .from("staff")
      .insert({
        user_id: userId,
        email: EMAIL,
        full_name: "Test Receptionist",
        role: "receptionist",
        role_id: role.id,
        is_active: true,
      })
      .select()
      .single();

    if (staffError) { console.error("Staff insert error:", staffError.message); process.exit(1); }
    console.log(`Created staff record: ${staff.id}`);
  }

  // 4. Verify has_permission at DB level
  const { data: permCreate } = await admin.rpc("has_permission", {
    p_user_id: userId,
    p_resource: "materials",
    p_action: "create",
  });
  console.log(`has_permission(materials, create) = ${permCreate}`);

  const { data: permAdjust } = await admin.rpc("has_permission", {
    p_user_id: userId,
    p_resource: "inventory",
    p_action: "adjust",
  });
  console.log(`has_permission(inventory, adjust) = ${permAdjust}`);

  const { data: permUsage } = await admin.rpc("has_permission", {
    p_user_id: userId,
    p_resource: "inventory",
    p_action: "usage",
  });
  console.log(`has_permission(inventory, usage) = ${permUsage}`);

  console.log("\nDone! Receptionist user is ready.");
}

main().catch(e => { console.error(e); process.exit(1); });
