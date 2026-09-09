import { getPublicServices } from "@/lib/services";
import BookingForm from "@/components/BookingForm";

export default async function BookingPage() {
  const services = await getPublicServices();
  return <BookingForm services={services} />;
}
