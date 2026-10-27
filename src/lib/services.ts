import { getPublicServicesCached } from "@/lib/data-cache";
import type { Service } from "@/lib/service-utils";

export type { Service } from "@/lib/service-utils";

/**
 * Public, read-only service list.
 *
 * Cached in the Data Cache and invalidated from the admin service mutations
 * (`updateTag('public-services')`). Uses the anon key, so RLS still applies.
 */
export async function getPublicServices(): Promise<Service[]> {
  return (await getPublicServicesCached()) as Service[];
}
