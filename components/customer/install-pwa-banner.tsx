"use client";

import { useEffect, useState } from "react";

import { usePwaInstall } from "@/hooks/use-pwa-install";
import { fetchJson } from "@/lib/utils/http";

const DISMISSED_KEY = (orderId: string) => `pwa-banner-dismissed-${orderId}`;
const SUBSCRIBED_KEY = (orderId: string) => `pwa-push-subscribed-${orderId}`;

async function subscribePush(orderId: string, vapidPublicKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  }));

  const json = sub.toJSON();
  if (!json.keys) throw new Error("PushSubscription sin keys");

  const ua = navigator.userAgent;
  const platform = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "desktop";

  await fetchJson("/api/customer/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: ua.slice(0, 500),
      platform,
    }),
  });
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    arr[i] = rawData.charCodeAt(i);
  }
  return arr.buffer as ArrayBuffer;
}

type Props = {
  orderId: string;
  vapidPublicKey: string;
  accentColor: string;
};

export function InstallPwaBanner({ orderId, vapidPublicKey, accentColor }: Props) {
  const { state, triggerInstall, dismiss } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"install" | "permission" | "done" | "error">("install");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY(orderId))) return;
    if (localStorage.getItem(SUBSCRIBED_KEY(orderId))) return;

    const timer = window.setTimeout(() => {
      if (state !== "unsupported" && state !== "installed" && state !== "dismissed") {
        setVisible(true);
      }
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [orderId, state]);

  if (!visible || state === "unsupported" || state === "installed" || state === "dismissed") {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY(orderId), "1");
    setVisible(false);
    dismiss();
  }

  async function handleInstallAndSubscribe() {
    try {
      if (state === "prompt-ready") {
        await triggerInstall();
      }
      // After install (or on iOS where we skip install step), ask for push permission
      setStep("permission");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        handleDismiss();
        return;
      }
      await subscribePush(orderId, vapidPublicKey);
      localStorage.setItem(SUBSCRIBED_KEY(orderId), "1");
      setStep("done");
      window.setTimeout(() => setVisible(false), 3000);
    } catch {
      setErrorMsg("No pudimos activar las notificaciones. Intentá de nuevo.");
      setStep("error");
    }
  }

  if (step === "done") {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl bg-green-500 px-4 py-3 text-center text-sm font-bold text-white shadow-lg">
        ✅ Notificaciones activadas
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-[#f0ddd0] bg-white px-4 py-4 shadow-xl"
      role="dialog"
      aria-label="Instalar FoodTag"
    >
      <button
        aria-label="Cerrar"
        className="absolute right-3 top-3 rounded-full p-1 text-[#9a7560] hover:bg-[#f4e8dc]"
        onClick={handleDismiss}
        type="button"
      >
        ✕
      </button>

      {state === "ios" ? (
        <>
          <p className="mb-1 text-sm font-black text-[#2b1b12]">
            Recibí el aviso aunque cierres la pestaña
          </p>
          <p className="mb-3 text-xs leading-5 text-[#6b4e35]">
            Tocá el botón compartir <strong>⎋</strong> de Safari y elegí{" "}
            <strong>"Agregar a pantalla de inicio"</strong>. Luego abrí la app y aceptá las notificaciones.
          </p>
          <button
            className="w-full rounded-xl py-2.5 text-sm font-black text-white"
            onClick={handleDismiss}
            style={{ backgroundColor: accentColor }}
            type="button"
          >
            Entendido
          </button>
        </>
      ) : (
        <>
          <p className="mb-1 text-sm font-black text-[#2b1b12]">
            Recibí el aviso aunque cierres la pestaña
          </p>
          <p className="mb-3 text-xs leading-5 text-[#6b4e35]">
            Instalá FoodTag como app y activá las notificaciones para que tu teléfono suene aunque no tengas la pantalla abierta.
          </p>
          {step === "error" && errorMsg ? (
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500">
              {errorMsg}
            </p>
          ) : null}
          {step === "permission" ? (
            <p className="mb-2 text-xs font-bold text-[#9a7560]">Activando notificaciones…</p>
          ) : null}
          <button
            className="w-full rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-50"
            disabled={step === "permission"}
            onClick={() => void handleInstallAndSubscribe()}
            style={{ backgroundColor: accentColor }}
            type="button"
          >
            Sí, instalar y activar
          </button>
        </>
      )}
    </div>
  );
}
