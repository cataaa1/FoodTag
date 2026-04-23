"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCartTotals, useCartStore } from "@/components/customer/cart-store";
import { PhoneShell, PrimaryPhoneButton } from "@/components/customer/phone-shell";
import { formatCurrency } from "@/lib/utils/format";
import { fetchJson } from "@/lib/utils/http";

type TruckStatus = {
  isOpen: boolean;
  nextOpeningLabel: string | null;
  paused: boolean;
  reason: string | null;
  truckName: string;
  address: string;
  heroImageUrl: string | null;
  logoUrl: string | null;
  brandIcon: string;
  publicTagline: string;
  todayHoursLabel: string;
};

type Customer = { id: string; name: string; phone: string };
type MenuVariant = { id: string; name: string; priceCents: number; available: boolean };
type MenuModifier = {
  id: string;
  label: string;
  defaultChecked: boolean;
  position: number;
};
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  photoUrl: string | null;
  available: boolean;
  hasVariants: boolean;
  variants: MenuVariant[];
  modifiers: MenuModifier[];
};
type MenuCategory = { id: string; name: string; items: MenuItem[] };
type SessionDraft = { name: string; phone: string };

const EMPTY_CATEGORIES: MenuCategory[] = [];
const MENU_ENTRY_SESSION_KEY = "foodtag-menu-entered";
const ITEM_EMOJIS = ["🍔", "🍗", "🥓", "🍟", "🧀", "🥤", "💧", "🍫", "🍪"] as const;

function itemEmoji(index: number) {
  return ITEM_EMOJIS[index % ITEM_EMOJIS.length];
}

function readMenuEntrySession() {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(MENU_ENTRY_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberMenuEntrySession() {
  try {
    window.sessionStorage.setItem(MENU_ENTRY_SESSION_KEY, "true");
  } catch {
    // Storage can be unavailable on some mobile browsers; React state still drives the flow.
  }
}

function TruckBrandFallback({
  brandIcon,
  label,
  logoUrl,
}: {
  brandIcon: string;
  label: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={label} className="size-20 rounded-[22px] object-cover shadow-[0_10px_26px_rgba(0,0,0,0.25)]" src={logoUrl} />
    );
  }

  return (
    <span className="text-[52px] drop-shadow-[0_4px_12px_rgba(0,0,0,0.30)]">
      {brandIcon}
    </span>
  );
}

export function MenuScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<SessionDraft>({ name: "", phone: "" });
  const [sessionCustomer, setSessionCustomer] = useState<Customer | null>(null);
  const [hasEnteredMenu, setHasEnteredMenu] = useState(readMenuEntrySession);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const decrementItem = useCartStore((state) => state.decrementItem);
  const cartItems = useCartStore((state) => state.items);
  const cartTotals = getCartTotals(cartItems);

  const statusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });
  const menuQuery = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => fetchJson<{ categories: MenuCategory[] }>("/api/menu"),
  });
  const sessionQuery = useQuery({
    queryKey: ["customer-session"],
    queryFn: () => fetchJson<{ customer: Customer | null }>("/api/customer/session"),
  });

  const sessionMutation = useMutation({
    mutationFn: (payload: SessionDraft) =>
      fetchJson<{ customer: Customer }>("/api/customer/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setFormError(null);
      setDraft({ name: data.customer.name, phone: data.customer.phone });
      setSessionCustomer(data.customer);
      setHasEnteredMenu(true);
      rememberMenuEntrySession();
      void sessionQuery.refetch();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "No pudimos iniciar sesión");
    },
  });

  const categories = menuQuery.data?.categories ?? EMPTY_CATEGORIES;
  const customer = sessionCustomer ?? sessionQuery.data?.customer ?? null;
  const truck = statusQuery.data;
  const showLanding = !customer || !hasEnteredMenu;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleCategories = useMemo(() => {
    if (!normalizedSearchQuery) return categories;

    return categories
      .map((category) => {
        const categoryMatches = category.name.toLowerCase().includes(normalizedSearchQuery);
        const items = categoryMatches
          ? category.items
          : category.items.filter((item) =>
              [
                item.name,
                item.description ?? "",
                ...item.variants.map((variant) => variant.name),
                ...item.modifiers.map((modifier) => modifier.label),
              ]
                .join(" ")
                .toLowerCase()
                .includes(normalizedSearchQuery),
            );

        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedSearchQuery]);
  const activeCategory =
    visibleCategories.find((category) => category.id === activeCategoryId) ??
    visibleCategories[0];

  useEffect(() => {
    if (!activeCategoryId && visibleCategories[0]) {
      setActiveCategoryId(visibleCategories[0].id);
    }
  }, [activeCategoryId, visibleCategories]);

  useEffect(() => {
    if (!customer || draft.name || draft.phone) return;

    setDraft({ name: customer.name, phone: customer.phone });
  }, [customer, draft.name, draft.phone]);

  useEffect(() => {
    if (!sessionQuery.data?.customer || sessionCustomer) return;

    setSessionCustomer(sessionQuery.data.customer);
  }, [sessionCustomer, sessionQuery.data?.customer]);

  const categoryItems = useMemo(() => activeCategory?.items ?? [], [activeCategory]);

  function submitSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sessionMutation.mutate(draft);
  }

  function openConfig(item: MenuItem) {
    if (!item.available) return;
    const availableVariants = item.variants.filter((variant) => variant.available);

    if (item.hasVariants && availableVariants.length === 0) return;

    const modifierDefaults = Object.fromEntries(
      item.modifiers.map((modifier) => [modifier.id, modifier.defaultChecked]),
    );

    if (!item.hasVariants && item.modifiers.length === 0) {
      addMenuItem(item, null, {});
      return;
    }

    setSelectedVariantId(availableVariants[0]?.id ?? null);
    setSelectedModifiers(modifierDefaults);
    setConfigItem(item);
  }

  function buildModifierNote(item: MenuItem, values: Record<string, boolean>) {
    const options = item.modifiers.flatMap((modifier) => {
      const selected = values[modifier.id] ?? modifier.defaultChecked;

      if (selected === modifier.defaultChecked) {
        return [];
      }

      const normalized = modifier.label.replace(/^con\s+/i, "").toLowerCase();
      return selected ? [modifier.label] : [`Sin ${normalized}`];
    });

    return options.join(", ") || null;
  }

  function addMenuItem(
    item: MenuItem,
    variant: MenuVariant | null,
    modifierValues: Record<string, boolean>,
  ) {
    const customizationKey = item.modifiers.length
      ? item.modifiers
          .map((modifier) => `${modifier.id}:${modifierValues[modifier.id] ?? modifier.defaultChecked}`)
          .join("|")
      : null;

    addItem({
      menuItemId: item.id,
      menuVariantId: variant?.id ?? null,
      name: item.name,
      variantName: variant?.name ?? null,
      unitPriceCents: variant?.priceCents ?? item.priceCents,
      notes: buildModifierNote(item, modifierValues),
      customizationKey,
    });
  }

  function confirmConfig() {
    if (!configItem) return;
    const variant =
      configItem.variants.find((entry) => entry.id === selectedVariantId) ?? null;

    if (configItem.hasVariants && !variant) return;

    addMenuItem(configItem, variant, selectedModifiers);
    setConfigItem(null);
  }

  function decrementMenuItem(itemId: string) {
    const currentItem = [...cartItems]
      .reverse()
      .find((entry) => entry.menuItemId === itemId);

    if (currentItem) {
      decrementItem(currentItem.cartItemId);
    }
  }

  if (statusQuery.data && !statusQuery.data.isOpen) {
    return <ClosedScreen status={statusQuery.data} />;
  }

  if (showLanding) {
    return (
      <PhoneShell>
        <div className="relative h-[200px] shrink-0 overflow-hidden bg-[#1c1009]">
          {truck?.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={truck.truckName}
              className="absolute inset-0 size-full object-cover"
              src={truck.heroImageUrl}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#c2410c_0%,#f97316_45%,#fed7aa_100%)]">
              <TruckBrandFallback
                brandIcon={truck?.brandIcon ?? "🚚"}
                label={truck?.truckName ?? "Foodtruck"}
                logoUrl={truck?.logoUrl ?? null}
              />
              <span className="text-[11px] font-bold uppercase tracking-[2px] text-white/60">
                {truck?.logoUrl ? "Logo del truck" : "Icono del truck"}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(to_top,#fff8f1,transparent)]" />
          <div className="absolute inset-x-0 bottom-3 text-center">
            <h1 className="text-[22px] font-black tracking-[-0.5px] text-[#1c1009] drop-shadow-[0_1px_0_rgba(255,255,255,0.5)]">
              {truck?.truckName ?? "FoodTag"}
            </h1>
            <p className="text-xs font-medium text-[#9a7560]">
              {truck?.publicTagline ?? "Food Truck · Av. Corrientes 1500"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-[100px] pt-6 [scrollbar-width:none]">
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-[#fff1e6] px-[18px] py-4">
            <span className="shrink-0 text-[22px]">👋</span>
            <div>
              <p className="mb-1 text-[14px] font-bold">¡Hola! Pedí desde acá</p>
              <p className="text-[13px] leading-[1.5] text-[#6b4e35]">
                Te vamos a avisar <strong>en esta pantalla</strong> cuando tu pedido
                esté listo. No hace falta descargar nada.
              </p>
            </div>
          </div>

          <form onSubmit={submitSession}>
            <PhoneField label="¿Cómo te llamás?">
              <input
                autoComplete="given-name"
                className="phone-input"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Tu nombre"
                required
                value={draft.name}
              />
            </PhoneField>
            <PhoneField label="¿Cuál es tu número?">
              <input
                autoComplete="tel"
                className="phone-input"
                inputMode="numeric"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Ej: 11 2345-6789"
                required
                type="tel"
                value={draft.phone}
              />
              <span className="mt-1.5 block text-xs text-[#9a7560]">
                Solo para avisarte cuando esté tu pedido 🔔
              </span>
            </PhoneField>
            {formError ? (
              <p className="mb-4 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-sm font-semibold text-[#ef4444]">
                {formError}
              </p>
            ) : null}
            <PrimaryPhoneButton disabled={sessionMutation.isPending} type="submit">
              {sessionMutation.isPending ? "Guardando..." : "Ver menú →"}
            </PrimaryPhoneButton>
          </form>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,#fff8f1_80%,transparent)] px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-center">
          <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#f0ddd0] px-3.5 py-1.5 text-xs font-semibold text-[#6b4e35]">
            <span className="size-2 rounded-full bg-[#22c55e]" />
            {statusQuery.data?.todayHoursLabel ?? "Abierto hasta las 23:00"}
          </span>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <header className="shrink-0 border-b border-[#f0ddd0] bg-[#fff8f1] px-5 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1 pt-1">
          <div>
            <h1 className="text-[17px] font-black tracking-[-0.3px]">
              {truck?.truckName ?? "FoodTag"}
            </h1>
            <p className="text-xs font-medium text-[#9a7560]">Hola, {customer.name} 👋</p>
          </div>
          <button
            aria-label={searchOpen ? "Cerrar busqueda" : "Buscar en el menu"}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#fff1e6] text-[#1c1009] shadow-[inset_0_0_0_1px_#f0ddd0]"
            onClick={() => {
              if (searchOpen) {
                setSearchQuery("");
              }

              setSearchOpen((value) => !value);
            }}
            type="button"
          >
            {searchOpen ? <X aria-hidden="true" size={21} /> : <Search aria-hidden="true" size={22} />}
          </button>
        </div>
        {searchOpen ? (
          <div className="mb-3 flex items-center gap-2 rounded-[14px] border-2 border-[#f0ddd0] bg-[#fffbf7] px-3.5 py-2.5">
            <Search aria-hidden="true" className="shrink-0 text-[#9a7560]" size={18} />
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-[#1c1009] outline-none placeholder:text-[#9a7560]"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar productos o categorias"
              type="search"
              value={searchQuery}
            />
          </div>
        ) : null}
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {visibleCategories.map((category) => (
            <button
              className={
                category.id === activeCategory?.id
                  ? "shrink-0 rounded-full bg-[#f97316] px-3.5 py-1.5 text-[13px] font-bold text-white"
                  : "shrink-0 rounded-full bg-[#f0ddd0] px-3.5 py-1.5 text-[13px] font-bold text-[#6b4e35]"
              }
              key={category.id}
              onClick={() => setActiveCategoryId(category.id)}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>
      </header>

      <div className={cartTotals.count > 0 ? "flex-1 overflow-y-auto pb-40 [scrollbar-width:none]" : "flex-1 overflow-y-auto pb-6 [scrollbar-width:none]"}>
        {categoryItems.map((item, itemIndex) => {
          const quantity = cartItems
            .filter((entry) => entry.menuItemId === item.id)
            .reduce((total, entry) => total + entry.quantity, 0);
          const availableVariants = item.variants.filter((variant) => variant.available);
          const isOrderable = item.available && (!item.hasVariants || availableVariants.length > 0);

          return (
            <article
              className="flex gap-3.5 border-b border-[#f0ddd0] px-5 py-3.5"
              key={item.id}
              style={{ opacity: isOrderable ? 1 : 0.5 }}
            >
              <div className="relative flex size-[76px] shrink-0 items-center justify-center rounded-xl bg-[#fff1e6] text-4xl">
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={item.name}
                    className="size-full rounded-xl object-cover"
                    src={item.photoUrl}
                  />
                ) : (
                  itemEmoji(itemIndex)
                )}
                {!isOrderable ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#fff8f1]/75 text-[10px] font-black text-white">
                    <span className="rounded-md bg-[#ef4444] px-1.5 py-0.5">
                      {item.available ? "SIN OPCIONES" : "AGOTADO"}
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="mb-0.5 text-[15px] font-bold text-[#1c1009]">{item.name}</h2>
                <p className="mb-1.5 line-clamp-2 text-xs leading-[1.4] text-[#9a7560]">
                  {item.description || "Sin descripción"}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-base font-black text-[#f97316]">
                    {formatCurrency(item.priceCents)}
                  </p>
                  {isOrderable ? (
                    quantity > 0 ? (
                      <div className="flex items-center gap-1.5 rounded-full bg-[#fff1e6] p-1">
                        <button
                          aria-label={`Restar ${item.name}`}
                          className="flex size-7 items-center justify-center rounded-full bg-white text-lg font-black text-[#f97316] shadow-[inset_0_0_0_1px_#fed7aa]"
                          onClick={() => decrementMenuItem(item.id)}
                          type="button"
                        >
                          -
                        </button>
                        <span className="min-w-5 text-center text-sm font-black text-[#f97316]">
                          {quantity}
                        </span>
                        <button
                          aria-label={`Sumar ${item.name}`}
                          className="flex size-7 items-center justify-center rounded-full bg-[#f97316] text-lg font-black text-white"
                          onClick={() => openConfig(item)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        className="flex size-[34px] items-center justify-center rounded-[10px] bg-[#f97316] text-[22px] font-black leading-none text-white shadow-[0_2px_8px_rgba(249,115,22,0.30)]"
                        onClick={() => openConfig(item)}
                        type="button"
                      >
                        +
                      </button>
                    )
                  ) : null}
                </div>
                {(item.hasVariants || item.modifiers.length > 0) && isOrderable ? (
                  <p className="mt-1 flex gap-2 text-[11px] text-[#9a7560]">
                    {item.hasVariants ? (
                      <span>
                        Tamaños: {availableVariants.map((variant) => variant.name).join(" / ")}
                      </span>
                    ) : null}
                    {item.modifiers.length > 0 ? (
                      <span>· {item.modifiers.length} opciones</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
        {categoryItems.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
            <p className="text-lg font-black text-[#1c1009]">No encontramos resultados</p>
            <p className="mt-2 text-sm leading-6 text-[#9a7560]">
              Probá buscar por nombre del producto o por categoría.
            </p>
          </div>
        ) : null}
      </div>

      {cartTotals.count > 0 ? (
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,#fff8f1_82%,rgba(255,248,241,0))] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <div className="flex items-center gap-3 rounded-[18px] bg-white p-3 shadow-[0_-6px_28px_rgba(63,43,27,0.10),0_1px_0_rgba(240,221,208,0.9)]">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-[#9a7560]">
                {cartTotals.count} {cartTotals.count === 1 ? "producto" : "productos"}
              </p>
              <p className="mt-0.5 text-xl font-black tracking-[-0.4px] text-[#1c1009]">
                {formatCurrency(cartTotals.subtotalCents)}
              </p>
            </div>
            <button
              className="flex min-h-12 flex-[1.35] items-center justify-center gap-2 rounded-[14px] bg-[#f97316] px-4 text-[15px] font-black text-white shadow-[0_4px_16px_rgba(249,115,22,0.28)] transition active:scale-[0.98] active:bg-[#c2410c]"
              onClick={() => router.push("/cart")}
              type="button"
            >
              <ShoppingCart aria-hidden="true" size={18} />
              Ver carrito
            </button>
          </div>
        </div>
      ) : null}

      {configItem ? (
        <ConfigSheet
          item={configItem}
          onClose={() => setConfigItem(null)}
          onConfirm={confirmConfig}
          selectedModifiers={selectedModifiers}
          selectedVariantId={selectedVariantId}
          setSelectedModifiers={setSelectedModifiers}
          setSelectedVariantId={setSelectedVariantId}
        />
      ) : null}
    </PhoneShell>
  );
}

function PhoneField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-bold text-[#6b4e35]">{label}</span>
      {children}
    </label>
  );
}

function ConfigSheet({
  item,
  onClose,
  onConfirm,
  selectedModifiers,
  selectedVariantId,
  setSelectedModifiers,
  setSelectedVariantId,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: () => void;
  selectedModifiers: Record<string, boolean>;
  selectedVariantId: string | null;
  setSelectedModifiers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSelectedVariantId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const selectedVariant = item.variants.find((variant) => variant.id === selectedVariantId);
  const price = selectedVariant?.priceCents ?? item.priceCents;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="max-h-[80%] w-full overflow-y-auto rounded-t-[20px] bg-white px-5 pb-9 pt-5 [scrollbar-width:none]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#ddd]" />
        <h2 className="mb-0.5 text-lg font-black">{item.name}</h2>
        <p className="mb-5 text-[13px] text-[#9a7560]">{item.description}</p>

        {item.hasVariants ? (
          <div className="mb-5">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.8px] text-[#6b4e35]">
              Tamaño
            </p>
            {item.variants
              .filter((variant) => variant.available)
              .map((variant) => {
                const selected = selectedVariantId === variant.id;

                return (
                  <button
                    className={
                      selected
                        ? "mb-2 flex w-full items-center justify-between rounded-xl border-2 border-[#f97316] bg-[#fff1e6] px-4 py-3 text-[15px] font-semibold"
                        : "mb-2 flex w-full items-center justify-between rounded-xl border-2 border-[#eee] bg-[#f9f9f9] px-4 py-3 text-[15px] font-semibold"
                    }
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    type="button"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={
                          selected
                            ? "flex size-[18px] items-center justify-center rounded-full border-2 border-[#f97316]"
                            : "flex size-[18px] items-center justify-center rounded-full border-2 border-[#ccc]"
                        }
                      >
                        {selected ? <span className="size-[9px] rounded-full bg-[#f97316]" /> : null}
                      </span>
                      {variant.name}
                    </span>
                    <span className="font-black text-[#f97316]">
                      {formatCurrency(variant.priceCents)}
                    </span>
                  </button>
                );
              })}
          </div>
        ) : null}

        {item.modifiers.length > 0 ? (
          <div className="mb-6">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.8px] text-[#6b4e35]">
              Personalizá tu pedido
            </p>
            {item.modifiers.map((modifier) => {
              const checked = selectedModifiers[modifier.id] ?? modifier.defaultChecked;

              return (
                <button
                  className={
                    checked
                      ? "mb-2 flex w-full items-center gap-3 rounded-xl border-2 border-[#f97316] bg-[#fff1e6] px-4 py-3 text-left"
                      : "mb-2 flex w-full items-center gap-3 rounded-xl border-2 border-[#eee] bg-[#f9f9f9] px-4 py-3 text-left"
                  }
                  key={modifier.id}
                  onClick={() =>
                    setSelectedModifiers((current) => ({
                      ...current,
                      [modifier.id]: !checked,
                    }))
                  }
                  type="button"
                >
                  <span
                    className={
                      checked
                        ? "flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 border-[#f97316] bg-[#f97316] text-sm font-black text-white"
                        : "size-[22px] shrink-0 rounded-md border-2 border-[#ccc] bg-white"
                    }
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="flex-1 text-[15px] font-semibold text-[#1c1009]">
                    {modifier.label}
                  </span>
                  {modifier.defaultChecked ? (
                    <span className="rounded-md bg-[#f0f0f0] px-2 py-1 text-[10px] font-bold text-[#9a7560]">
                      por defecto
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <PrimaryPhoneButton
          disabled={item.hasVariants && !selectedVariant}
          onClick={onConfirm}
          type="button"
        >
          {item.hasVariants && !selectedVariant
            ? "Elegí un tamaño"
            : `Agregar al carrito · ${formatCurrency(price)}`}
        </PrimaryPhoneButton>
      </div>
    </div>
  );
}

function ClosedScreen({ status }: { status: TruckStatus }) {
  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
        <ClosedTruckIllustration />
        <h1 className="mt-2 text-[32px] font-black tracking-[-1px]">
          Estamos cerrados 😴
        </h1>
        <p className="max-w-[280px] text-[15px] leading-6 text-[#6b4e35]">
          {status.paused
            ? status.reason ?? "El truck está en pausa."
            : "El truck no está operando en este momento. Volvé pronto."}
        </p>
        <div className="mt-2 rounded-2xl bg-white px-6 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <p className="mb-2 text-xs font-black uppercase tracking-[1px] text-[#9a7560]">
            Próximo horario
          </p>
          <p className="font-black text-[#1c1009]">
            {status.nextOpeningLabel ?? "A definir"}
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}

function ClosedTruckIllustration() {
  return (
    <svg fill="none" height="100" viewBox="0 0 160 100" width="160">
      <rect fill="#DDD" height="50" rx="8" width="110" x="10" y="40" />
      <rect fill="#BBB" height="20" rx="8" width="110" x="10" y="40" />
      <rect fill="#C8B49A" height="20" rx="4" width="90" x="20" y="32" />
      {[0, 1, 2, 3, 4].map((index) => (
        <rect fill="#A09080" height="2" key={index} rx="1" width="86" x="22" y={34 + index * 4} />
      ))}
      <circle cx="35" cy="96" fill="#888" r="10" />
      <circle cx="35" cy="96" fill="#CCC" r="5" />
      <circle cx="95" cy="96" fill="#888" r="10" />
      <circle cx="95" cy="96" fill="#CCC" r="5" />
      <rect fill="#DDD" height="30" rx="4" width="30" x="120" y="60" />
      <rect fill="#BBB" height="10" rx="2" width="20" x="125" y="65" />
      <rect fill="#CCC" height="4" rx="2" width="16" x="140" y="86" />
      <rect fill="#EF4444" height="20" rx="6" width="50" x="40" y="20" />
      <text
        fill="white"
        fontFamily="DM Sans"
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        x="65"
        y="34"
      >
        CERRADO
      </text>
    </svg>
  );
}
