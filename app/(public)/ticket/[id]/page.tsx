import { TicketScreen } from "@/components/customer/ticket-screen";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  return <TicketScreen orderId={id} vapidPublicKey={vapidPublicKey} />;
}
