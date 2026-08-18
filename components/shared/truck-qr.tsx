"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * QR del menu publico de un foodtruck.
 *
 * Se genera en el navegador y no en el servidor a proposito: el contenido es
 * una URL publica, no hay nada que proteger, y asi no hace falta un endpoint
 * ni preocuparse por cachearlo. Cuando cambia el slug, cambia la URL y el QR
 * se regenera solo.
 */
export function useTruckQr(url: string | null, size = 512) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1009", light: "#ffffff" },
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return dataUrl;
}

export function downloadQr(dataUrl: string, slug: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `qr-${slug || "foodtruck"}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Abre una ventana con solo el cartel para imprimir. Se usa una ventana aparte
 * en vez de reglas @media print sobre el panel porque el cartel tiene que
 * quedar centrado y grande en la hoja, sin nada del admin alrededor.
 */
export function printQr(dataUrl: string, truckName: string, url: string) {
  const win = window.open("", "_blank", "width=720,height=900");

  if (!win) {
    window.alert(
      "El navegador bloqueó la ventana de impresión. Habilitá las ventanas emergentes para este sitio o descargá el QR.",
    );
    return;
  }

  win.document.write(`<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <title>QR · ${escapeHtml(truckName)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        color: #1c1009;
      }
      .card { text-align: center; padding: 32px; max-width: 460px; }
      h1 { font-size: 30px; margin: 0 0 4px; letter-spacing: -0.5px; }
      .lead { font-size: 17px; margin: 0 0 24px; color: #6b4e35; }
      img { width: 340px; height: 340px; display: block; margin: 0 auto; }
      .url { margin-top: 18px; font-size: 14px; color: #6b4e35; word-break: break-all; }
      .hint { margin-top: 22px; font-size: 15px; font-weight: 700; }
      @media print { body { min-height: auto; } .card { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(truckName)}</h1>
      <p class="lead">Escaneá y pedí desde tu celular</p>
      <img alt="Código QR del menú" src="${dataUrl}" />
      <p class="url">${escapeHtml(url)}</p>
      <p class="hint">Te avisamos en la pantalla cuando esté listo 🔔</p>
    </div>
  </body>
</html>`);
  win.document.close();
  win.focus();

  // Damos un instante a que la imagen quede pintada antes de abrir el dialogo.
  win.setTimeout(() => win.print(), 350);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
