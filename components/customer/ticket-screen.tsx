"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PhoneShell, PrimaryPhoneButton } from "@/components/customer/phone-shell";
import type { CustomerOrder, MenuCategoryWithItems, TruckStatus } from "@/lib/types/domain";
import { fetchJson } from "@/lib/utils/http";

function playBeeper() {
  try {
    const audio = new AudioContext();
    const pattern = [
      { start: 0, frequency: 880 },
      { start: 0.18, frequency: 1320 },
      { start: 0.42, frequency: 880 },
      { start: 0.6, frequency: 1320 },
      { start: 0.95, frequency: 1040 },
      { start: 1.13, frequency: 1560 },
      { start: 1.37, frequency: 1040 },
      { start: 1.55, frequency: 1560 },
    ];

    pattern.forEach((beep) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const startAt = audio.currentTime + beep.start;
      const endAt = startAt + 0.13;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(beep.frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, endAt);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);
    });

    window.setTimeout(() => void audio.close(), 2200);
  } catch {
    // Audio can be blocked until the first user gesture; the visual alert remains.
  }
}

export function TicketScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [paymentReturnError, setPaymentReturnError] = useState<string | null>(null);
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null);
  const [openCustomizeItemId, setOpenCustomizeItemId] = useState<string | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [modificationError, setModificationError] = useState<string | null>(null);
  const lastSignalRef = useRef<string | null>(null);
  const reconciledPaymentRef = useRef<string | null>(null);
  const paymentReturnId =
    searchParams.get("payment_id") ?? searchParams.get("collection_id");
  const orderQuery = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => fetchJson<{ order: CustomerOrder }>(`/api/customer/order/${orderId}`),
    refetchInterval: 5_000,
  });
  const menuQuery = useQuery({
    queryKey: ["menu"],
    queryFn: () => fetchJson<{ categories: MenuCategoryWithItems[] }>("/api/menu"),
  });
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });
  const order = orderQuery.data?.order ?? null;
  const menuItems = menuQuery.data?.categories.flatMap((category) => category.items) ?? [];
  const activeExtraPaymentRequest = order?.modificationRequests.find(
    (request) => request.status === "extra_payment_pending",
  );
  const canRequestModifications =
    Boolean(truckStatusQuery.data?.allowOrderModifications) &&
    order?.status === "pending" &&
    order.paymentStatus === "approved";

  function getMenuItemForOrderItem(orderItem: CustomerOrder["items"][number]) {
    return menuItems.find((item) => item.id === orderItem.menuItemId) ?? null;
  }

  function getCurrentModifierLabels(orderItem: CustomerOrder["items"][number]) {
    const selected = selectedModifiers[orderItem.id];

    if (selected) {
      return selected;
    }

    return (
      getMenuItemForOrderItem(orderItem)?.modifiers
        .filter((modifier) => modifier.defaultChecked)
        .map((modifier) => modifier.label) ?? []
    );
  }

  function toggleModifier(orderItem: CustomerOrder["items"][number], label: string) {
    const current = getCurrentModifierLabels(orderItem);
    const next = current.includes(label)
      ? current.filter((entry) => entry !== label)
      : [...current, label];

    setSelectedModifiers((value) => ({ ...value, [orderItem.id]: next }));
  }

  const modificationMutation = useMutation({
    mutationFn: () =>
      fetchJson(`/api/customer/order/${orderId}/modifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(selectedModifiers).map(([orderItemId, modifierLabels]) => ({
            orderItemId,
            modifierLabels,
          })),
        }),
      }),
    onSuccess: async () => {
      setSelectedModifiers({});
      setOpenCustomizeItemId(null);
      setModificationError(null);
      await queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] });
    },
    onError: (error) => {
      setModificationError(
        error instanceof Error ? error.message : "No pudimos pedir la modificacion",
      );
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!paymentReturnId || reconciledPaymentRef.current === paymentReturnId) return;

    reconciledPaymentRef.current = paymentReturnId;
    setPaymentReturnError(null);

    void fetchJson<{ order: CustomerOrder }>(
      `/api/customer/order/${orderId}/payment-return`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: paymentReturnId }),
      },
    )
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] });
        router.replace(`/ticket/${orderId}`);
      })
      .catch((error) => {
        setPaymentReturnError(
          error instanceof Error
            ? error.message
            : "No pudimos confirmar el pago automaticamente",
        );
      });
  }, [orderId, paymentReturnId, queryClient, router]);

  useEffect(() => {
    if (order?.paymentStatus !== "pending" || !order.mpPreferenceId) return;

    let cancelled = false;

    async function syncPayment() {
      try {
        setPaymentSyncError(null);
        await fetchJson<{ order: CustomerOrder }>(
          `/api/customer/order/${orderId}/payment-sync`,
          { method: "POST" },
        );
        if (!cancelled) {
          await queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] });
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentSyncError(
            error instanceof Error
              ? error.message
              : "No pudimos sincronizar el pago con Mercado Pago",
          );
        }
      }
    }

    void syncPayment();
    const timer = window.setInterval(() => void syncPayment(), 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [order?.mpPreferenceId, order?.paymentStatus, orderId, queryClient]);

  useEffect(() => {
    const requests =
      order?.modificationRequests.filter(
        (request) => request.status === "extra_payment_pending" && request.mpPreferenceId,
      ) ?? [];

    if (!requests.length) return;

    let cancelled = false;

    async function syncModificationPayments() {
      try {
        setPaymentSyncError(null);
        await Promise.all(
          requests.map((request) =>
            fetchJson(
              `/api/customer/order/${orderId}/modifications/${request.id}/payment-sync`,
              { method: "POST" },
            ),
          ),
        );
        if (!cancelled) {
          await queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] });
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentSyncError(
            error instanceof Error
              ? error.message
              : "No pudimos sincronizar el pago adicional",
          );
        }
      }
    }

    void syncModificationPayments();
    const timer = window.setInterval(() => void syncModificationPayments(), 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [order?.modificationRequests, orderId, queryClient]);

  useEffect(() => {
    if (!order) return;
    const signal =
      order.status === "ready" ? order.pulseAt ?? order.readyAt ?? "ready" : order.pulseAt;

    if (!signal || lastSignalRef.current === signal) return;

    lastSignalRef.current = signal;
    navigator.vibrate?.([260, 90, 260, 90, 360]);
    playBeeper();
  }, [order]);

  if (orderQuery.isError) {
    return (
      <PhoneShell>
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

  if (order?.paymentStatus === "pending") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-[64px]">⏳</div>
          <h1 className="text-3xl font-black tracking-[-1px]">Esperando pago</h1>
          <p className="text-sm leading-6 text-[#6b4e35]">
            Si ya pagaste con Mercado Pago, esta pantalla se actualiza sola cuando
            llegue la confirmación.
          </p>
          {paymentReturnId && !paymentReturnError ? (
            <p className="rounded-full bg-[#fff1e6] px-4 py-2 text-xs font-black text-[#f97316]">
              Confirmando pago...
            </p>
          ) : null}
          {paymentReturnError ? (
            <p className="rounded-[12px] border border-[#ffb4a8] bg-[#fff1f0] px-4 py-3 text-xs font-bold text-[#ef4444]">
              {paymentReturnError}
            </p>
          ) : null}
          {paymentSyncError ? (
            <p className="rounded-[12px] border border-[#ffb4a8] bg-[#fff1f0] px-4 py-3 text-xs font-bold text-[#ef4444]">
              {paymentSyncError}
            </p>
          ) : null}
      
        </div>
      </PhoneShell>
    );
  }

  if (order?.paymentStatus === "rejected" || order?.paymentStatus === "cancelled") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-[64px]">💳</div>
          <h1 className="text-3xl font-black tracking-[-1px]">Pago no aprobado</h1>
          <p className="text-sm leading-6 text-[#6b4e35]">
            No pudimos confirmar el pago. Podés volver al menú y crear el pedido de nuevo.
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

  if (order?.status === "cancelled") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-[64px]">😕</div>
          <h1 className="text-3xl font-black tracking-[-1px]">Pedido cancelado</h1>
          <p className="text-sm leading-6 text-[#6b4e35]">
            {order.cancelReason ?? "El staff canceló este pedido."}
          </p>
          <PrimaryPhoneButton onClick={() => router.push("/menu")} type="button">
            Volver al menú
          </PrimaryPhoneButton>
        </div>
      </PhoneShell>
    );
  }

  if (order?.status === "delivered") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-[64px]">✅</div>
          <h1 className="text-3xl font-black tracking-[-1px]">Pedido entregado</h1>
          <p className="text-sm leading-6 text-[#6b4e35]">
            Gracias por pedir en FoodTag.
          </p>
          <PrimaryPhoneButton onClick={() => router.push("/menu")} type="button">
            Hacer otro pedido
          </PrimaryPhoneButton>
        </div>
      </PhoneShell>
    );
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
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-7 py-6 text-center">
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

        <div className="mb-4 w-full rounded-[18px] border border-[#f0ddd0] bg-white px-4 py-4 text-left shadow-[0_10px_30px_rgba(63,43,27,0.08)]">
          <p className="mb-1 text-[13px] font-black text-[#2b1b12]">
            Modificar productos
          </p>
          <p className="mb-3 text-xs leading-5 text-[#9a7560]">
            
          </p>
          {order?.modificationRequests.length ? (
            <div className="mb-3 space-y-2">
              {order.modificationRequests.map((request) => (
                <div
                  className="rounded-[12px] bg-[#fff7ef] px-3 py-2 text-xs text-[#6b4e35]"
                  key={request.id}
                >
                  <p className="font-black text-[#2b1b12]">{request.requestText}</p>
                  <p className="mt-1">
                    {request.status === "pending"
                      ? "En revision del staff"
                      : request.status === "approved"
                        ? "Aprobada"
                        : request.status === "rejected"
                          ? "Denegada. Acercate al cajero para revisar alternativas."
                          : request.status === "extra_payment_rejected"
                            ? "Pago adicional rechazado. Acercate al cajero."
                            : "Aprobada"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {activeExtraPaymentRequest ? (
            <p className="mb-3 rounded-[12px] bg-[#fff1e6] px-3 py-2 text-xs font-black text-[#f97316]">
              Tu solicitud requiere pasar por caja. Acercate al cajero para continuar.
            </p>
          ) : null}
          {!canRequestModifications ? (
            <p className="rounded-[12px] bg-[#f4e8dc] px-3 py-2 text-xs font-bold text-[#9a7560]">
              {truckStatusQuery.data?.allowOrderModifications === false
                ? "Este restaurante no permite cambios despues de pedir."
                : order?.status === "pending"
                  ? "Solo se habilita cuando el pago esta aprobado."
                  : "El pedido esta en preparacion. Ya no se pueden hacer cambios. Acercate al cajero para mas informacion."}
            </p>
          ) : (
            <div className="space-y-2">
              {order?.items.map((item) => {
                const menuItem = getMenuItemForOrderItem(item);
                const modifiers = menuItem?.modifiers ?? [];
                const currentLabels = getCurrentModifierLabels(item);
                const isOpen = openCustomizeItemId === item.id;

                return (
                  <div
                    className="rounded-[14px] border border-[#f0ddd0] bg-[#fffaf6] p-3"
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#2b1b12]">
                          {item.quantity}x {item.nameSnapshot}
                        </p>
                        <p className="text-xs font-bold text-[#9a7560]">
                          {currentLabels.length
                            ? currentLabels.join(", ")
                            : "Sin opciones marcadas"}
                        </p>
                      </div>
                      <button
                        className="rounded-full bg-[#f97316] px-3 py-2 text-xs font-black text-white"
                        onClick={() => setOpenCustomizeItemId(isOpen ? null : item.id)}
                        type="button"
                      >
                        Customizar
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 grid gap-2">
                        {modifiers.length ? (
                          modifiers.map((modifier) => (
                            <button
                              className={
                                currentLabels.includes(modifier.label)
                                  ? "flex items-center justify-between rounded-[12px] border-2 border-[#f97316] bg-[#fff1e6] px-3 py-2 text-left text-sm font-black text-[#2b1b12]"
                                  : "flex items-center justify-between rounded-[12px] border border-[#e8d4c4] bg-white px-3 py-2 text-left text-sm font-black text-[#2b1b12]"
                              }
                              key={modifier.id}
                              onClick={() => toggleModifier(item, modifier.label)}
                              type="button"
                            >
                              <span>{modifier.label}</span>
                              <span>{currentLabels.includes(modifier.label) ? "✓" : "+"}</span>
                            </button>
                          ))
                        ) : (
                          <p className="rounded-[12px] bg-white px-3 py-2 text-xs font-bold text-[#9a7560]">
                            Este item no tiene opciones configurables.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {modificationError ? (
            <p className="mt-2 rounded-[10px] bg-[#fff1f0] px-3 py-2 text-xs font-bold text-[#ef4444]">
              {modificationError}
            </p>
          ) : null}
          {canRequestModifications ? (
            <button
              className="mt-3 w-full rounded-[14px] bg-[#2b1b12] px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              disabled={
                modificationMutation.isPending ||
                Object.keys(selectedModifiers).length === 0
              }
              onClick={() => modificationMutation.mutate()}
              type="button"
            >
              {modificationMutation.isPending ? "Enviando..." : "Enviar cambios de opciones"}
            </button>
          ) : null}
        </div>

        <p className="mt-5 text-xs text-[#9a7560]">
          Actualizando cada 5 segundos · {elapsed}s
        </p>
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
    <main className="min-h-dvh">
      <section
        className="relative flex min-h-dvh w-full flex-col items-center justify-center gap-4 overflow-hidden px-7 pt-[env(safe-area-inset-top)] text-center transition-colors duration-500"
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
            <span
              className="animate-bounce text-2xl drop-shadow-[0_3px_10px_rgba(0,0,0,0.20)]"
              key={index}
              style={{ animationDelay: `${index * 110}ms` }}
            >
              ⭐
            </span>
          ))}
        </div>
        <button
          className="mt-4 rounded-2xl border-2 border-white/40 bg-white/25 px-10 py-4 text-[17px] font-black tracking-[-0.2px] text-white shadow-[0_4px_20px_rgba(0,0,0,0.20)] backdrop-blur"
          onClick={onDone}
          type="button"
        >
          Ya lo retiré ✓
        </button>
      </section>
    </main>
  );
}
