import { redirect } from "next/navigation";

import { TruckPickerScreen } from "@/components/customer/truck-picker-screen";
import { countTrucks } from "@/lib/data/truck-status";

export default async function Home() {
  // La raiz es la puerta de entrada general (el link de la app, la PWA sin
  // ticket): con varios foodtrucks siempre muestra la lista para elegir, aunque
  // haya quedado la cookie de un QR escaneado antes. Entrar directo al menu de
  // un truck es lo que hace /t/<slug>.
  //
  // No redirigimos al ticket activo: un pedido con el pago abandonado queda
  // "activo" para siempre y dejaba al cliente encerrado en un ticket viejo
  // esperando un pago que nunca llega.
  if ((await countTrucks()) > 1) {
    return <TruckPickerScreen />;
  }

  redirect("/menu");
}
