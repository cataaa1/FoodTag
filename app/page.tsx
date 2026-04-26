import { redirect } from "next/navigation";

import { getCustomerSession } from "@/lib/auth/customer-jwt";
import { getActiveOrderForCustomer } from "@/lib/data/orders";

export default async function Home() {
  const session = await getCustomerSession();

  if (session) {
    const activeOrder = getActiveOrderForCustomer(session.customerId);
    if (activeOrder) {
      redirect(`/ticket/${activeOrder.id}`);
    }
  }

  redirect("/menu");
}
