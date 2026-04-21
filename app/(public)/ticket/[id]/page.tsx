import { TicketScreen } from "@/components/customer/ticket-screen";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TicketScreen orderId={id} />;
}
