"use client";

import { downloadQr, printQr, useTruckQr } from "@/components/shared/truck-qr";

/**
 * Cartel imprimible del truck. Vive dentro de Configuracion, al lado del campo
 * que define el slug, para que se vea al instante como queda la URL al cambiarlo.
 */
export function QrPanel({
  slug,
  truckName,
  disabled,
}: {
  slug: string;
  truckName: string;
  /** true mientras el slug del formulario todavia no es valido */
  disabled?: boolean;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = slug && !disabled ? `${origin}/t/${slug}` : null;
  const dataUrl = useTruckQr(url);

  return (
    <div className="grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
      <div className="flex items-center justify-center rounded-[16px] border border-[#e8e8e8] bg-white p-3 dark:border-[#2e2e2e]">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`Código QR de ${truckName}`} className="w-full" src={dataUrl} />
        ) : (
          <p className="px-3 py-10 text-center text-[12px] leading-4 text-[#999]">
            {disabled
              ? "Corregí el identificador para generar el QR"
              : "Generando el código..."}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.8px] text-[#999]">
          Link del menú
        </p>
        <p className="mt-1.5 break-all rounded-[10px] bg-[#f2f2f2] px-3 py-2 font-mono text-[12px] text-[#555] dark:bg-[#242424] dark:text-[#b4b4b4]">
          {url ?? "—"}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="admin-primary-button disabled:opacity-50"
            disabled={!dataUrl}
            onClick={() => dataUrl && printQr(dataUrl, truckName, url ?? "")}
            type="button"
          >
            Imprimir cartel
          </button>
          <button
            className="admin-muted-button disabled:opacity-50"
            disabled={!dataUrl}
            onClick={() => dataUrl && downloadQr(dataUrl, slug)}
            type="button"
          >
            Descargar PNG
          </button>
          <button
            className="admin-muted-button disabled:opacity-50"
            disabled={!url}
            onClick={() => url && void navigator.clipboard?.writeText(url)}
            type="button"
          >
            Copiar link
          </button>
        </div>

        <p className="mt-4 text-[12px] leading-[1.5] text-[#999]">
          Pegá este QR en el mostrador. Quien lo escanee entra directo a{" "}
          <strong className="font-bold">tu</strong> menú, aunque haya otros
          foodtrucks en el sistema. Si cambiás el identificador de arriba, el QR
          viejo deja de funcionar y hay que reimprimirlo.
        </p>
      </div>
    </div>
  );
}
