"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  cartItemId: string;
  menuItemId: string;
  menuVariantId: string | null;
  name: string;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
  notes: string | null;
  customizationKey: string | null;
};

type AddCartItemInput = Omit<CartItem, "cartItemId" | "quantity"> & {
  quantity?: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: AddCartItemInput) => void;
  decrementItem: (cartItemId: string) => void;
  removeItem: (cartItemId: string) => void;
  updateNotes: (cartItemId: string, notes: string) => void;
  clear: () => void;
};

function buildCartItemId(
  menuItemId: string,
  menuVariantId: string | null,
  customizationKey: string | null,
) {
  return `${menuItemId}:${menuVariantId ?? "base"}:${customizationKey ?? "default"}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const cartItemId = buildCartItemId(
            item.menuItemId,
            item.menuVariantId,
            item.customizationKey,
          );
          const existing = state.items.find(
            (current) => current.cartItemId === cartItemId,
          );

          if (existing) {
            return {
              items: state.items.map((current) =>
                current.cartItemId === cartItemId
                  ? {
                      ...current,
                      quantity: Math.min(
                        99,
                        current.quantity + (item.quantity ?? 1),
                      ),
                    }
                  : current,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                ...item,
                cartItemId,
                quantity: item.quantity ?? 1,
                notes: item.notes,
                customizationKey: item.customizationKey,
              },
            ],
          };
        }),
      decrementItem: (cartItemId) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.cartItemId === cartItemId
                ? { ...item, quantity: item.quantity - 1 }
                : item,
            )
            .filter((item) => item.quantity > 0),
        })),
      removeItem: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.cartItemId !== cartItemId),
        })),
      updateNotes: (cartItemId, notes) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.cartItemId === cartItemId
              ? { ...item, notes: notes.trim() || null }
              : item,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: "foodtag-cart",
    },
  ),
);

export function getCartTotals(items: CartItem[]) {
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );

  return { count, subtotalCents };
}
