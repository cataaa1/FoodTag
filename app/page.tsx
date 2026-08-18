import { redirect } from "next/navigation";

export default function Home() {
  // La raiz siempre entra al menu. No redirigimos al ticket activo: un pedido
  // con el pago abandonado queda "activo" para siempre y dejaba al cliente
  // encerrado en un ticket viejo esperando un pago que nunca llega.
  redirect("/menu");
}
