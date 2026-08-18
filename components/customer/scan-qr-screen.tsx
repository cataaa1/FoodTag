import { PhoneShell } from "@/components/customer/phone-shell";

/**
 * Se muestra cuando entran a /menu sin haber escaneado ningun QR y hay mas de
 * un foodtruck cargado. Adivinar cual es seria peor que no mostrar nada: el
 * cliente terminaria pidiendo de un menu que no es el que tiene adelante.
 */
export function ScanQrScreen() {
  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
        <span className="text-[56px]">📷</span>
        <h1 className="text-[22px] font-black tracking-[-0.3px] text-[#1c1009]">
          Escaneá el QR del truck
        </h1>
        <p className="text-[14px] leading-[1.5] text-[#6b4e35]">
          Cada foodtruck tiene su propio menú. Escaneá el código que está en el
          mostrador para pedir del que tenés adelante.
        </p>
      </div>
    </PhoneShell>
  );
}
