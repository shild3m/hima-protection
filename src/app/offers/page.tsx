import { createClient } from "@/lib/supabase/server";
import { OfferWithService } from "@/lib/types";
import OffersContent from "@/components/OffersContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "العروض الحصرية | عنوان الحماية",
  description: "استمتع بعروضنا الحصرية على خدمات حماية السيارات وتظليل النوافذ من عنوان الحماية",
  openGraph: {
    title: "العروض الحصرية | عنوان الحماية",
    description: "استمتع بعروضنا الحصرية على خدمات حماية السيارات",
  },
};

async function getOffers(): Promise<OfferWithService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers" as never)
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((offer: Record<string, unknown>) => ({
    ...offer,
    service: null,
  })) as unknown as OfferWithService[];
}

export default async function OffersPage() {
  const offers = await getOffers();
  return <OffersContent offers={offers} />;
}
