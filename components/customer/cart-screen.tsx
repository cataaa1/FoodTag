"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getCartTotals, useCartStore } from "@/components/customer/cart-store";
import { PhoneShell, PrimaryPhoneButton, StatusBar } from "@/components/customer/phone-shell";
import type { CustomerOrder } from "@/lib/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { fetchJson } from "@/lib/utils/http";

type Customer = { id: string; name: string; phone: string };

const TIP_OPTIONS = [0, 5, 10, 15] as const;

export function CartScreen() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const updateNotes = useCartStore((state) => state.updateNotes);
  const clearCart = useCartStore((state) => state.clear);
  const [tipPercent, setTipPercent] = useState<(typeof TIP_OPTIONS)[number]>(10);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const totals = getCartTotals(items);
  const tipCents = Math.round((totals.subtotalCents * tipPercent) / 100);
  const totalCents = totals.subtotalCents + tipCents;

  const sessionQuery = useQuery({
    queryKey: ["customer-session"],
    queryFn: () => fetchJson<{ customer: Customer | null }>("/api/customer/session"),
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ order: CustomerOrder }>("/api/customer/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipCents,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            menuVariantId: item.menuVariantId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        }),
      }),
    onSuccess: (data) => {
      clearCart();
      router.push(`/ticket/${data.order.id}`);
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : "No pudimos crear el pedido");
    },
  });

  const customer = sessionQuery.data?.customer ?? null;
  const canSubmit = Boolean(customer) && items.length > 0 && !createOrderMutation.isPending;

  if (items.length === 0) {
    return (
      <PhoneShell>
        <StatusBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-10 text-center">
          <div className="text-[64px]">🛒</div>
          <h1 className="text-lg font-bold">El carrito está vacío</h1>
          <p className="text-sm text-[#9a7560]">Agregá algo del menú y volvé acá.</p>
          <PrimaryPhoneButton className="mt-2" onClick={() => router.push("/menu")} type="button">
            ← Ir al menú
          </PrimaryPhoneButton>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <StatusBar />
      <header className="flex shrink-0 items-center gap-3 border-b border-[#f0ddd0] px-5 pb-3 pt-2">
        <button
          className="flex size-9 items-center justify-center rounded-[10px] bg-[#f0ddd0] text-lg font-black"
          onClick={() => router.push("/menu")}
          type="button"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-black">Tu pedido</h1>
          <p className="text-xs font-medium text-[#9a7560]">
            {customer ? customer.name : "Completá tus datos en el menú"}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 pb-56 [scrollbar-width:none]">
        {items.map((item) => (
          <article
            className="mb-2.5 rounded-[14px] bg-white p-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
            key={item.cartItemId}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[#1c1009]">{item.name}</h2>
                {item.variantName ? (
                  <p className="mt-0.5 text-xs text-[#9a7560]">Opción: {item.variantName}</p>
                ) : null}
                {item.notes ? (
                  <p className="mt-0.5 text-xs text-[#9a7560]">{item.notes}</p>
                ) : null}
              </div>
              <p className="text-[15px] font-black text-[#f97316]">
                {formatCurrency(item.unitPriceCents * item.quantity)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  className="flex size-[30px] items-center justify-center rounded-lg bg-[#f0ddd0] text-base font-black text-[#6b4e35]"
                  onClick={() => decrementItem(item.cartItemId)}
                  type="button"
                >
                  −
                </button>
                <span className="min-w-5 text-center text-base font-bold">
                  {item.quantity}
                </span>
                <button
                  className="flex size-[30px] items-center justify-center rounded-lg bg-[#f97316] text-base font-black text-white"
                  onClick={() =>
                    addItem({
                      menuItemId: item.menuItemId,
                      menuVariantId: item.menuVariantId,
                      name: item.name,
                      variantName: item.variantName,
                      unitPriceCents: item.unitPriceCents,
                      notes: item.notes,
                      customizationKey: item.customizationKey,
                    })
                  }
                  type="button"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-[#9a7560]">{formatCurrency(item.unitPriceCents)} c/u</p>
            </div>
            <input
              className="mt-3 w-full rounded-[10px] border border-[#f0ddd0] bg-[#fffbf7] px-3 py-2 text-xs font-medium outline-none focus:border-[#f97316]"
              onChange={(event) => updateNotes(item.cartItemId, event.target.value)}
              placeholder="Nota opcional, ej: sin cebolla"
              value={item.notes ?? ""}
            />
          </article>
        ))}

        <section className="mt-1.5 rounded-[14px] bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <h2 className="mb-3 text-sm font-bold">¿Le dejás propina al equipo? 🙌</h2>
          <div className="flex gap-2">
            {TIP_OPTIONS.map((option) => (
              <button
                className={
                  tipPercent === option
                    ? "min-w-14 flex-1 rounded-[10px] bg-[#f97316] px-1.5 py-2.5 text-[13px] font-bold text-white"
                    : "min-w-14 flex-1 rounded-[10px] bg-[#f0ddd0] px-1.5 py-2.5 text-[13px] font-bold text-[#6b4e35]"
                }
                key={option}
                onClick={() => setTipPercent(option)}
                type="button"
              >
                {option === 0 ? "Sin propina" : `${option}%`}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-2.5 rounded-[14px] bg-white p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
          <div className="mb-1.5 flex justify-between text-sm text-[#6b4e35]">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotalCents)}</span>
          </div>
          <div className="mb-2.5 flex justify-between text-sm text-[#6b4e35]">
            <span>Propina</span>
            <span>{formatCurrency(tipCents)}</span>
          </div>
          <div className="mb-2.5 h-px bg-[#f0ddd0]" />
          <div className="flex justify-between text-lg font-black">
            <span>Total</span>
            <span>{formatCurrency(totalCents)}</span>
          </div>
        </section>

        {submitError ? (
          <p className="mt-3 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-sm font-semibold text-[#ef4444]">
            {submitError}
          </p>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,white_70%,transparent)] px-5 pb-7 pt-3">
        <PrimaryPhoneButton
          disabled={!canSubmit}
          onClick={() => createOrderMutation.mutate()}
          type="button"
        >
          {createOrderMutation.isPending
            ? "Creando ticket..."
            : `Pagar con Mercado Pago · ${formatCurrency(totalCents)}`}
        </PrimaryPhoneButton>
      </div>
    </PhoneShell>
  );
}
