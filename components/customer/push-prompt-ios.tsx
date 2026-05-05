"use client";

import { useEffect, useState } from "react";

import { subscribePush } from "@/lib/push/subscribe-client";

const SUBSCRIBED_KEY = (orderId: string) => `pwa-push-subscribed-${orderId}`;
const DISMISSED_KEY = (orderId: string) => `ios-push-prompt-dismissed-${orderId}`;

function shouldShow(orderId: string): boolean {
  if (typeof window === "undefined") return false;

  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const hasApi = "Notification" in window && "PushManager" in window;
  const permission = hasApi ? Notification.permission : "denied";
  const subscribed = !!localStorage.getItem(SUBSCRIBED_KEY(orderId));
  const dismissed = !!localStorage.getItem(DISMISSED_KEY(orderId));

  if (!isStandalone) return false;
  if (!isIos) return false;
  if (!hasApi) return false;
  if (permission === "denied") return false;
  if (subscribed) return false;
  if (dismissed) return false;
  return true;
}

type Props = {
  orderId: string;
  vapidPublicKey: string;
  accentColor: string;
};

export function PushPromptIos({ orderId, vapidPublicKey, accentColor }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"idle" | "requesting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (shouldShow(orderId)) setVisible(true);
  }, [orderId]);

  if (!visible) return null;

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY(orderId), "1"); } catch { /* ignorar */ }
    setVisible(false);
  }

  async function handleActivate() {
    setStep("requesting");
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        handleDismiss();
        return;
      }
      await subscribePush(orderId, vapidPublicKey);
      try { localStorage.setItem(SUBSCRIBED_KEY(orderId), "1"); } catch { /* ignorar */ }
      setStep("done");
      window.setTimeout(() => setVisible(false), 3_000);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setErrorMsg(`No pudimos activar las notificaciones: ${detail}`);
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
      aria-label="Activar notificaciones"
    >
      <button
        aria-label="Cerrar"
        className="absolute right-3 top-3 rounded-full p-1 text-[#9a7560] hover:bg-[#f4e8dc]"
        onClick={handleDismiss}
        type="button"
      >
        ✕
      </button>
      <p className="mb-1 text-sm font-black text-[#2b1b12]">
        Activá el aviso cuando tu pedido esté listo
      </p>
      <p className="mb-3 text-xs leading-5 text-[#6b4e35]">
        Tu teléfono va a sonar aunque tengas la app cerrada.
      </p>
      {step === "error" && errorMsg ? (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500">
          {errorMsg}
        </p>
      ) : null}
      {step === "requesting" ? (
        <p className="mb-2 text-xs font-bold text-[#9a7560]">Activando notificaciones…</p>
      ) : null}
      <button
        className="w-full rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-50"
        disabled={step === "requesting"}
        onClick={() => void handleActivate()}
        style={{ backgroundColor: accentColor }}
        type="button"
      >
        Activar notificaciones
      </button>
    </div>
  );
}
