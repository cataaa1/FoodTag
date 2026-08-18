import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { MenuScreen } from "@/components/customer/menu-screen";
import { ScanQrScreen } from "@/components/customer/scan-qr-screen";
import { getMenuData } from "@/lib/data/menu";
import { getTruckStatus, isTruckAmbiguous } from "@/lib/data/truck-status";

type Props = {
  searchParams: Promise<{ handoff?: string; truck?: string }>;
};

export default async function MenuPage({ searchParams }: Props) {
  const { handoff, truck } = await searchParams;

  // Sin QR escaneado y con varios foodtrucks, no hay forma de saber de cual
  // quiere comprar: mostrar uno al azar es peor que pedirle que escanee.
  if (await isTruckAmbiguous()) {
    return <ScanQrScreen />;
  }

  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["truck-status"],
      queryFn: getTruckStatus,
    }),
    queryClient.prefetchQuery({
      queryKey: ["public-menu"],
      queryFn: async () => ({ categories: await getMenuData() }),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MenuScreen handoffError={handoff} truckSlug={truck} />
    </HydrationBoundary>
  );
}
