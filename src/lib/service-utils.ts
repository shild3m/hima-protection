export interface Service {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  base_price: number | null;
  duration_minutes: number | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export function formatPrice(price: number | null): string | null {
  if (price === null || price === undefined) return null;
  return `${price.toLocaleString("en-GB")} ر.س`;
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes === undefined) return null;

  if (minutes < 60) {
    return `${minutes} دقيقة`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? "ساعة واحدة" : `${hours} ساعات`;
  }

  return `${hours} ساعة ${remainingMinutes} دقيقة`;
}
