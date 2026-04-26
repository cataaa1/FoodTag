"use client";

import { useEffect, useRef, useState } from "react";

type InstallState =
  | "unsupported"   // SW/Push no disponible
  | "idle"          // soportado, sin prompt aún
  | "prompt-ready"  // Android: beforeinstallprompt capturado
  | "ios"           // iOS Safari: instrucciones manuales
  | "installed"     // corriendo como standalone
  | "dismissed";    // usuario cerró el banner

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function usePwaInstall() {
  const [state, setState] = useState<InstallState>("idle");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Standalone primero: si ya está instalada, no mostrar nada
    if (isStandalone()) {
      setState("installed");
      return;
    }

    // iOS antes de chequear push: en Safari no-standalone PushManager no existe,
    // pero igual queremos mostrar las instrucciones de instalación
    if (isIos()) {
      setState("ios");
      return;
    }

    // Para Android/Desktop: si el browser no soporta push, no tiene sentido el banner
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }

    // Android/Desktop: capturar el prompt de instalación si el browser lo ofrece.
    // Si no lo ofrece (criterios no cumplidos), el estado queda "idle" y el banner
    // igual aparece para pedir solo el permiso de notificaciones.
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setState("prompt-ready");
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    if (outcome === "accepted") {
      setState("installed");
    }
  }

  function dismiss() {
    setState("dismissed");
  }

  return { state, triggerInstall, dismiss };
}
