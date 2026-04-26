import { MenuScreen } from "@/components/customer/menu-screen";

type Props = {
  searchParams: Promise<{ handoff?: string }>;
};

export default async function MenuPage({ searchParams }: Props) {
  const { handoff } = await searchParams;
  return <MenuScreen handoffError={handoff} />;
}
