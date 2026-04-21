"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PhoneShell, PrimaryPhoneButton, StatusBar } from "@/components/customer/phone-shell";
import type { CustomerOrder } from "@/lib/types/domain";
import { fetchJson } from "@/lib/utils/http";

function playBeeper() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, audio.currentTime);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.45);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.48);
    oscillator.onended = () => audio.close();
  } catch {
    // Audio can be blocked until the first user gesture; the visual alert remains.
  }
}

export function TicketScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState(0);
  const lastSignalRef = useRef<string | null>(null);
  const orderQuery = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => fetchJson<{ order: CustomerOrder }>(`/api/customer/order/${orderId}`),
    refetchInterval: 5_000,
  });
  const order = orderQuery.data?.order ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!order) return;
    const signal =
      order.status === "ready" ? order.pulseAt ?? order.readyAt ?? "ready" : order.pulseAt;

    if (!signal || lastSignalRef.current === signal) return;

    lastSignalRef.current = signal;
    navigator.vibrate?.([180, 80, 180]);
    playBeeper();
  }, [order]);

  if (orderQuery.isError) {
    return (
      <PhoneShell>
        <StatusBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <h1 className="text-3xl font-black tracking-[-1px]">No encontramos ese ticket</h1>
          <p className="text-sm leading-6 text-[#6b4e35]">
            Puede que la sesión haya vencido o que el pedido no exista.
          </p>
          <PrimaryPhoneButton onClick={() => router.push("/menu")} type="button">
            Volver al menú
          </PrimaryPhoneButton>
        </div>
      </PhoneShell>
    );
  }

  if (order?.status === "ready") {
    return <ReadyTicket order={order} onDone={() => router.push("/menu")} />;
  }

  const ticketNumber = order?.ticketNumber ?? 0;
  const preparing = order?.status === "preparing";
  const steps = [
    { icon: "✅", label: "Pagado", done: true, active: false },
    { icon: "⏳", label: "En cola", done: true, active: order?.status === "pending" },
    { icon: "🔥", label: "Preparando", done: preparing, active: preparing },
    { icon: "🔔", label: "Listo", done: false, active: false },
  ];

  return (
    <PhoneShell>
      <StatusBar />
      <div className="flex flex-1 flex-col items-center justify-center px-7 py-6 text-center">
        <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-[#9a7560]">
          Tu número de ticket
        </p>
        <h1 className="ticket-font mb-1.5 text-[96px] font-black leading-none tracking-[-4px]">
          #{String(ticketNumber).padStart(3, "0")}
        </h1>
        <p className="mb-8 text-sm font-medium text-[#9a7560]">
          Tiempo estimado: <strong className="text-[#f97316]">~ 10 min</strong>
        </p>

        <div className="mb-8 flex w-full max-w-[300px]">
          {steps.map((step, index) => (
            <div className="relative flex flex-1 flex-col items-center" key={step.label}>
              {index < steps.length - 1 ? (
                <div
                  className={
                    step.done
                      ? "absolute left-1/2 top-[17px] z-0 h-0.5 w-full bg-[#f97316]"
                      : "absolute left-1/2 top-[17px] z-0 h-0.5 w-full bg-[#f0ddd0]"
                  }
                />
              ) : null}
              <div
                className={
                  step.done
                    ? "z-10 mb-1.5 flex size-[34px] items-center justify-center rounded-full bg-[#f97316] text-base shadow-[0_0_0_4px_rgba(249,115,22,0.18)]"
                    : "z-10 mb-1.5 flex size-[34px] items-center justify-center rounded-full bg-[#f0ddd0] text-base"
                }
              >
                {step.icon}
              </div>
              <p
                className={
                  step.done
                    ? "text-center text-[10px] font-bold text-[#f97316]"
                    : "text-center text-[10px] font-medium text-[#9a7560]"
                }
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-4 w-full rounded-[14px] bg-[#fff1e6] px-[18px] py-3.5 text-center">
          <p className="text-[13px] leading-6 text-[#6b4e35]">
            🔒 <strong>No cierres esta pantalla.</strong>
            <br />
            Te vamos a avisar acá cuando esté listo.
          </p>
        </div>

        <button
          className="mt-2 bg-transparent text-xs text-[#9a7560] underline"
          onClick={() => {
            navigator.vibrate?.([180, 80, 180]);
            playBeeper();
          }}
          type="button"
        >
          [dev] probar beeper
        </button>

        <p className="mt-5 text-xs text-[#9a7560]">
          Actualizando cada 5 segundos · {elapsed}s
        </p>
        <button className="mt-auto bg-transparent text-[13px] text-[#ef4444]" type="button">
          Cancelar pedido
        </button>
      </div>
    </PhoneShell>
  );
}

function ReadyTicket({
  onDone,
  order,
}: {
  onDone: () => void;
  order: CustomerOrder;
}) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPulse((value) => value + 1), 800);
    return () => window.clearInterval(timer);
  }, []);

  const colors = ["#ff6b00", "#ff8c00", "#ffa500", "#ff6b00"];

  return (
    <main className="min-h-screen bg-[#e8e0d8] px-3 py-5 md:flex md:items-center md:justify-center md:px-6">
      <section
        className="relative mx-auto flex h-[812px] w-full max-w-[375px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[40px] px-7 text-center shadow-[0_30px_80px_rgba(0,0,0,0.30),0_0_0_1px_rgba(0,0,0,0.10)] transition-colors duration-500"
        style={{ background: colors[pulse % colors.length] }}
      >
        <div className="animate-bounce text-[72px]">🔔</div>
        <h1 className="text-[64px] font-black leading-none tracking-[-2px] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          ¡LISTO!
        </h1>
        <p className="ticket-font text-[88px] font-black leading-none tracking-[-4px] text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.30)]">
          #{String(order.ticketNumber).padStart(3, "0")}
        </p>
        <p className="mt-1 text-[22px] font-bold tracking-[-0.3px] text-white/90">
          Pasá a retirar
        </p>
        <div className="mt-2 flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <span className="text-2xl" key={index}>
              ⭐
            </span>
          ))}
        </div>
        <button
          className="mt-4 rounded-2xl border-2 border-white/40 bg-white/25 px-10 py-4 text-[17px] font-black tracking-[-0.2px] text-white shadow-[0_4px_20px_rgba(0,0,0,0.20)] backdrop-blur"
          onClick={onDone}
          type="button"
        >
          OK, ya lo vi ✓
        </button>
      </section>
    </main>
  );
}
