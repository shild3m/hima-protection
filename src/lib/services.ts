import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Service } from "@/lib/service-utils";

export type { Service } from "@/lib/service-utils";

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getPublicServices(): Promise<Service[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, icon_key, short_description, description, base_price, duration_minutes, image_url, is_active, display_order, created_at, updated_at"
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Get public services error:", error);
    return [];
  }

  return data || [];
}