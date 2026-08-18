"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { useTransientMessage } from "@/hooks/use-transient-message";
import { optimizeImageFile } from "@/lib/utils/client-image";
import { fetchJson } from "@/lib/utils/http";

type Category = {
  id: string;
  name: string;
  position: number;
  visible: boolean;
};

type Variant = {
  id?: string;
  menu_item_id?: string;
  name: string;
  price_cents: number;
  available: boolean;
  position: number;
};

type Modifier = {
  id?: string;
  label: string;
  default_checked: boolean;
  position: number;
};

type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  photo_url: string | null;
  available: boolean;
  has_variants: boolean;
  position: number;
  variants: Variant[];
  modifiers: Modifier[];
};

type ItemForm = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: string;
  photoUrl: string;
  available: boolean;
  hasVariants: boolean;
  position: string;
  variants: Variant[];
  modifiers: Modifier[];
};

type CategoryForm = {
  id: string;
  name: string;
  position: string;
  visible: boolean;
};

const EMPTY_CATEGORY_FORM: CategoryForm = {
  id: "",
  name: "",
  position: "0",
  visible: true,
};

const EMPTY_ITEM_FORM: ItemForm = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  priceCents: "0",
  photoUrl: "",
  available: true,
  hasVariants: false,
  position: "0",
  variants: [],
  modifiers: [],
};

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ITEMS: MenuItem[] = [];
const MAX_IMAGE_UPLOAD_BYTES = 1_600_000;
const MAX_IMAGE_DIMENSION = 1600;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Los formularios trabajan en pesos, que es lo que el usuario escribe y lo que
 * dice la etiqueta del campo. La base guarda centavos. Antes se mandaba el
 * numero tal cual, asi que cargar 2800 quedaba guardado como $28.
 */
function pesosToCents(value: string) {
  const pesos = Number(String(value).replace(",", "."));
  return Number.isFinite(pesos) ? Math.round(pesos * 100) : 0;
}

function centsToPesos(cents: number) {
  return String(cents / 100);
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function itemToForm(item: MenuItem): ItemForm {
  return {
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    description: item.description ?? "",
    priceCents: centsToPesos(item.price_cents),
    photoUrl: item.photo_url ?? "",
    available: item.available,
    hasVariants: item.has_variants,
    position: String(item.position),
    // El campo se sigue llamando price_cents por el tipo compartido, pero
    // dentro del formulario contiene pesos, igual que el precio base.
    variants: item.variants.map((variant) => ({
      ...variant,
      price_cents: Number(centsToPesos(variant.price_cents)),
    })),
    modifiers: item.modifiers,
  };
}

export function MenuManager() {
  const queryClient = useQueryClient();
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(EMPTY_CATEGORY_FORM);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM_FORM);
  const [showItemModal, setShowItemModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTransientMessage(feedback, () => setFeedback(null));
  useTransientMessage(error, () => setError(null), 4_200);

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchJson<{ categories: Category[] }>("/api/admin/categories"),
  });
  const itemsQuery = useQuery({
    queryKey: ["admin", "menu-items"],
    queryFn: () => fetchJson<{ items: MenuItem[] }>("/api/admin/menu-items"),
  });

  const categories = categoriesQuery.data?.categories ?? EMPTY_CATEGORIES;
  const items = itemsQuery.data?.items ?? EMPTY_ITEMS;
  const activeCategory = categories.find((category) => category.id === activeCategoryId);
  const activeItems = useMemo(
    () => items.filter((item) => item.category_id === activeCategoryId),
    [activeCategoryId, items],
  );

  useEffect(() => {
    if (!categories.length) {
      return;
    }

    if (!activeCategoryId || !categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0]?.id ?? "");
    }
  }, [activeCategoryId, categories]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "menu-items"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "truck-status"] }),
      queryClient.invalidateQueries({ queryKey: ["public-menu"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard", "today"] }),
    ]);
  }

  const categoryMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: categoryForm.name,
        position: Number(categoryForm.position),
        visible: categoryForm.visible,
      };

      if (categoryForm.id) {
        return fetchJson(`/api/admin/categories/${categoryForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      return fetchJson("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setError(null);
      setFeedback("Categoría guardada");
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setShowCategoryForm(false);
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos guardar la categoría",
      );
    },
  });

  const itemMutation = useMutation({
    mutationFn: async () => {
      const body = {
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        description: itemForm.description || null,
        priceCents: pesosToCents(itemForm.priceCents),
        photoUrl: itemForm.photoUrl || null,
        available: itemForm.available,
        hasVariants: itemForm.hasVariants,
        position: Number(itemForm.position),
        variants: itemForm.hasVariants
          ? itemForm.variants.map((variant, index) => ({
              id: variant.id,
              name: variant.name,
              priceCents: pesosToCents(String(variant.price_cents)),
              available: variant.available,
              position: variant.position ?? index,
            }))
          : [],
        modifiers: itemForm.modifiers.map((modifier, index) => ({
          id: modifier.id,
          label: modifier.label,
          defaultChecked: modifier.default_checked,
          position: modifier.position ?? index,
        })),
      };

      if (itemForm.id) {
        return fetchJson(`/api/admin/menu-items/${itemForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      return fetchJson("/api/admin/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setError(null);
      setFeedback("Ítem guardado");
      closeItemModal();
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error ? mutationError.message : "No pudimos guardar el ítem",
      );
    },
  });

  const itemAvailabilityMutation = useMutation({
    mutationFn: async (item: MenuItem) =>
      fetchJson(`/api/admin/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      }),
    onMutate: async (item: MenuItem) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "menu-items"] });
      const previous = queryClient.getQueryData<{ items: MenuItem[] }>(["admin", "menu-items"]);
      queryClient.setQueryData<{ items: MenuItem[] }>(["admin", "menu-items"], (old) =>
        old
          ? { items: old.items.map((i) => (i.id === item.id ? { ...i, available: !item.available } : i)) }
          : old,
      );
      return { previous };
    },
    onSuccess: () => {
      setError(null);
      void refreshAll();
    },
    onError: (mutationError, _item, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin", "menu-items"], context.previous);
      }
      setFeedback(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos actualizar la disponibilidad",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { kind: "category" | "item"; id: string }) => {
      const pathMap = {
        category: `/api/admin/categories/${input.id}`,
        item: `/api/admin/menu-items/${input.id}`,
      };

      return fetchJson(pathMap[input.kind], { method: "DELETE" });
    },
    onSuccess: async () => {
      setError(null);
      setFeedback("Registro eliminado");
      await refreshAll();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos eliminar el registro",
      );
    },
  });

  function openNewItemModal() {
    setError(null);
    setItemForm({
      ...EMPTY_ITEM_FORM,
      categoryId: activeCategoryId,
      position: String(activeItems.length),
    });
    setShowItemModal(true);
  }

  function openEditItemModal(item: MenuItem) {
    setError(null);
    setItemForm(itemToForm(item));
    setShowItemModal(true);
  }

  function closeItemModal() {
    setShowItemModal(false);
    setItemForm(EMPTY_ITEM_FORM);
  }

  function editCategory(category: Category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      position: String(category.position),
      visible: category.visible,
    });
    setShowCategoryForm(true);
  }

  function addVariantRow() {
    setItemForm((current) => ({
      ...current,
      hasVariants: true,
      variants: [
        ...current.variants,
        {
          name: "",
          price_cents: Number(current.priceCents) || 0,
          available: true,
          position: current.variants.length,
        },
      ],
    }));
  }

  function addModifierRow() {
    setItemForm((current) => ({
      ...current,
      modifiers: [
        ...current.modifiers,
        {
          label: "",
          default_checked: true,
          position: current.modifiers.length,
        },
      ],
    }));
  }

  function importItemImage(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setFeedback(null);
      setError("Usá una imagen JPG, PNG o WEBP");
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      setFeedback(null);
      setError("La imagen no puede superar los 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setItemForm((current) => ({ ...current, photoUrl: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  }

  async function importOptimizedItemImage(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setFeedback(null);
      setError("Usá una imagen JPG, PNG o WEBP");
      return;
    }

    try {
      const optimized = await optimizeImageFile(file, {
        maxBytes: MAX_IMAGE_UPLOAD_BYTES,
        maxDimension: MAX_IMAGE_DIMENSION,
      });

      setFeedback(
        `Imagen optimizada a ${optimized.width}x${optimized.height} para que no pese más de 1.6MB`,
      );
      setError(null);
      setItemForm((current) => ({ ...current, photoUrl: optimized.dataUrl }));
    } catch (imageError) {
      setFeedback(null);
      setError(
        imageError instanceof Error
          ? imageError.message
          : "No pudimos procesar la imagen",
      );
    }
  }

  void importItemImage;

  return (
    <AdminShell
      action={
        <button className="admin-primary-button" onClick={openNewItemModal} type="button">
          + Agregar ítem
        </button>
      }
      subtitle={`${items.length} ítems en total`}
      title="Gestión de menú"
    >
      {feedback ? (
        <div className="brand-accent-notice mb-5 rounded-[10px] border px-4 py-3 text-[13px] font-bold">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-bold text-[#ef4444]">
          {error}
        </div>
      ) : null}

      <div className="flex items-start gap-5">
        <aside className="w-[200px] shrink-0 rounded-xl border border-[#e8e8e8] bg-white p-2 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
          <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.8px] text-[#999]">
            Categorías
          </div>
          <div className="space-y-0.5">
            {categories.map((category) => {
              const active = category.id === activeCategoryId;
              const count = items.filter((item) => item.category_id === category.id).length;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategoryId(category.id)}
                  className={
                    active
                      ? "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition"
                      : "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[#555] transition dark:text-[#b4b4b4]"
                  }
                  style={
                    active
                      ? {
                          backgroundColor: "var(--admin-accent-soft)",
                          color: "var(--admin-accent)",
                        }
                      : undefined
                  }
                  type="button"
                >
                  <span className={!category.visible ? "opacity-50" : ""}>{category.name}</span>
                  <span className="text-[11px] font-bold">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="my-2 h-px bg-[#e8e8e8] dark:bg-[#2e2e2e]" />
          <button
            className="brand-accent-dashed-action w-full rounded-lg px-3 py-2.5"
            onClick={() => {
              setCategoryForm({ ...EMPTY_CATEGORY_FORM, position: String(categories.length) });
              setShowCategoryForm(true);
            }}
            type="button"
          >
            + Nueva categoría
          </button>

          {activeCategory ? (
            <div className="mt-2 flex gap-1.5">
              <button
                className="flex-1 rounded-lg bg-[#f2f2f2] px-2 py-2 text-[11px] font-bold text-[#555] dark:bg-[#242424] dark:text-[#a0a0a0]"
                onClick={() => editCategory(activeCategory)}
                type="button"
              >
                Editar
              </button>
              <button
                className="rounded-lg bg-[#ef4444]/10 px-2 py-2 text-[11px] font-bold text-[#ef4444]"
                onClick={() => deleteMutation.mutate({ kind: "category", id: activeCategory.id })}
                type="button"
              >
                Borrar
              </button>
            </div>
          ) : null}

          {showCategoryForm ? (
            <CategoryFormPanel
              form={categoryForm}
              onCancel={() => {
                setShowCategoryForm(false);
                setCategoryForm(EMPTY_CATEGORY_FORM);
              }}
              onChange={setCategoryForm}
              onSubmit={() => {
                if (!categoryMutation.isPending) categoryMutation.mutate();
              }}
              saving={categoryMutation.isPending}
            />
          ) : null}
        </aside>

        <section className="flex-1">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {activeItems.map((item) => (
              <MenuItemCard
                item={item}
                key={item.id}
                onDelete={() => deleteMutation.mutate({ kind: "item", id: item.id })}
                onEdit={() => openEditItemModal(item)}
                onToggle={() => itemAvailabilityMutation.mutate(item)}
              />
            ))}
            <button
              className="brand-accent-dashed-action flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 dark:border-[#2e2e2e]"
              onClick={openNewItemModal}
              type="button"
            >
              <span className="text-[28px]">+</span>
              <span className="text-[13px] font-semibold">Agregar ítem</span>
            </button>
          </div>

          {!categories.length ? (
            <EmptyState
              description="Creá una categoría para empezar a cargar productos."
              title="Todavía no hay categorías"
            />
          ) : null}
        </section>
      </div>

      {showItemModal ? (
        <ItemModal
          categories={categories}
          form={itemForm}
          onAddModifier={addModifierRow}
          onAddVariant={addVariantRow}
          onChange={setItemForm}
          onClose={closeItemModal}
          onImportImage={importOptimizedItemImage}
          onSubmit={() => {
            if (!itemMutation.isPending) itemMutation.mutate();
          }}
          saving={itemMutation.isPending}
        />
      ) : null}
    </AdminShell>
  );
}

function CategoryFormPanel({
  form,
  onCancel,
  onChange,
  onSubmit,
  saving,
}: {
  form: CategoryForm;
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<CategoryForm>>;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-[10px] border border-[#e8e8e8] bg-[#fafafa] p-3 dark:border-[#2e2e2e] dark:bg-[#242424]">
      <input
        className="admin-input"
        onChange={(event) =>
          onChange((current) => ({ ...current, name: event.target.value }))
        }
        placeholder="Hamburguesas"
        value={form.name}
      />
      {/* El orden no se edita a mano: las categorias nuevas van al final y las
          existentes conservan su posicion. Un spinner sin etiqueta solo confundia. */}
      <ToggleRow
        checked={form.visible}
        label="Visible"
        onChange={(checked) => onChange((current) => ({ ...current, visible: checked }))}
      />
      <div className="flex gap-2">
        <button
          className="admin-primary-button flex-1 disabled:opacity-60"
          disabled={saving}
          onClick={onSubmit}
          type="button"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button className="admin-muted-button flex-1" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function MenuItemCard({
  item,
  onDelete,
  onEdit,
  onToggle,
}: {
  item: MenuItem;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article
      className="rounded-xl border border-[#e8e8e8] bg-white p-4 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]"
      style={{ opacity: item.available ? 1 : 0.6 }}
    >
      <div className="mb-3 flex h-[100px] w-full items-center justify-center overflow-hidden rounded-lg bg-[#f2f2f2] text-center text-xs font-semibold text-[#999] dark:bg-[#242424]">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={item.name} className="size-full object-cover" src={item.photo_url} />
        ) : (
          "foto del ítem"
        )}
      </div>
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold text-[#111] dark:text-[#f5f5f5]">{item.name}</h2>
        <button
          className="brand-accent-icon-button flex size-7 items-center justify-center rounded-lg bg-[#f2f2f2] text-sm dark:bg-[#242424]"
          onClick={onEdit}
          type="button"
        >
          ✏
        </button>
      </div>
      <div className="mb-1 text-sm font-bold" style={{ color: "var(--admin-accent)" }}>
        {item.has_variants && item.variants[0]
          ? `Desde ${formatPrice(item.variants[0].price_cents)}`
          : formatPrice(item.price_cents)}
      </div>
      <p className="mb-2 line-clamp-2 min-h-8 text-xs text-[#999]">
        {item.description || "Sin descripción"}
      </p>
      {item.has_variants ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {item.variants.length ? (
            item.variants.map((variant) => (
              <span
                className="brand-accent-chip rounded-[5px] px-2 py-0.5 text-[10px] font-semibold"
                key={variant.id ?? variant.name}
                title={`${variant.name} · ${formatPrice(variant.price_cents)}${
                  variant.available ? "" : " · agotada"
                }`}
              >
                {variant.name} · {formatPrice(variant.price_cents)}
                {!variant.available ? " · agotada" : ""}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[#999]">Con variantes</span>
          )}
        </div>
      ) : null}
      {item.modifiers.length ? (
        <div className="mb-2">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px] text-[#999]">
            Modificaciones
          </p>
          <div className="flex flex-wrap gap-1">
            {item.modifiers.map((modifier) => (
              <span
                className="rounded-[5px] bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-semibold text-[#555] dark:bg-[#242424] dark:text-[#a0a0a0]"
                key={modifier.id ?? modifier.label}
              >
                {modifier.label}
                {modifier.default_checked ? " · por defecto" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold"
          style={{ color: item.available ? "#22c55e" : "#999" }}
        >
          {item.available ? "Disponible" : "Agotado"}
        </span>
        <div className="flex items-center gap-2">
          <Toggle checked={item.available} onChange={onToggle} />
          <button
            className="rounded-md bg-[#ef4444]/10 px-2 py-1 text-[11px] font-bold text-[#ef4444]"
            onClick={onDelete}
            type="button"
          >
            Borrar
          </button>
        </div>
      </div>
    </article>
  );
}

function ItemModal({
  categories,
  form,
  onAddModifier,
  onAddVariant,
  onChange,
  onClose,
  onImportImage,
  onSubmit,
  saving,
}: {
  categories: Category[];
  form: ItemForm;
  onAddModifier: () => void;
  onAddVariant: () => void;
  onChange: React.Dispatch<React.SetStateAction<ItemForm>>;
  onClose: () => void;
  onImportImage: (file: File | undefined) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  const hasMods = form.modifiers.length > 0;
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-5"
      onClick={onClose}
    >
      <div
        className="scrollable max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[20px] bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.25)] dark:bg-[#1a1a1a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111] dark:text-[#f5f5f5]">
            {form.id ? "Editar ítem" : "Nuevo ítem"}
          </h2>
          <button
            className="flex size-8 items-center justify-center rounded-lg bg-[#f2f2f2] text-lg text-[#555] dark:bg-[#242424] dark:text-[#a0a0a0]"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <Field label="Nombre del ítem">
            <input
              className="admin-input"
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ej: Classic Smash"
              value={form.name}
            />
          </Field>
          <Field label="Descripción corta">
            <input
              className="admin-input"
              onChange={(event) =>
                onChange((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Ej: Doble medallón, cheddar, pickles..."
              value={form.description}
            />
          </Field>
          <Field label="Precio base">
            <input
              className="admin-input"
              min="0"
              onChange={(event) =>
                onChange((current) => ({ ...current, priceCents: event.target.value }))
              }
              placeholder="$0"
              type="number"
              value={form.priceCents}
            />
          </Field>
          <Field label="Categoría">
            <select
              className="admin-input"
              onChange={(event) =>
                onChange((current) => ({ ...current, categoryId: event.target.value }))
              }
              value={form.categoryId}
            >
              <option value="">Elegí una categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Foto">
            <input
              className="admin-input"
              onChange={(event) =>
                onChange((current) => ({ ...current, photoUrl: event.target.value }))
              }
              placeholder="https://... o pegá una data URL"
              value={form.photoUrl}
            />
          </Field>
          <div className="rounded-[12px] border border-[#e8e8e8] bg-[#fafafa] p-3 dark:border-[#2e2e2e] dark:bg-[#242424]">
            <div className="mb-3 flex h-28 w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#f2f2f2] text-xs font-semibold text-[#999] dark:bg-[#1a1a1a]">
              {form.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Vista previa del ítem" className="size-full object-cover" src={form.photoUrl} />
              ) : (
                "Sin imagen cargada"
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="admin-muted-button"
                onClick={() => imageInputRef.current?.click()}
                type="button"
              >
                Subir imagen
              </button>
              {form.photoUrl ? (
                <button
                  className="admin-muted-button"
                  onClick={() => onChange((current) => ({ ...current, photoUrl: "" }))}
                  type="button"
                >
                  Quitar imagen
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[#777] dark:text-[#b4b4b4]">
              La imagen se adapta automáticamente hasta {MAX_IMAGE_DIMENSION}px y 1.6MB.
            </p>
            <input
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(event) => onImportImage(event.target.files?.[0])}
              ref={imageInputRef}
              type="file"
            />
          </div>
          <ToggleRow
            checked={form.available}
            label="Disponible"
            onChange={(checked) => onChange((current) => ({ ...current, available: checked }))}
          />
        </div>

        <div className="mt-5 border-t border-[#e8e8e8] pt-[18px] dark:border-[#2e2e2e]">
          <OptionHeader
            checked={form.hasVariants}
            description="Ej: Simple / Doble / Triple con precios distintos"
            label="Variantes de tamaño"
            onChange={(checked) =>
              onChange((current) => ({
                ...current,
                hasVariants: checked,
                variants: checked ? current.variants : [],
              }))
            }
          />
          {form.hasVariants ? (
            <div>
              <div className="mb-1.5 grid grid-cols-[1fr_130px_32px] gap-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[#999]">
                <span>Nombre</span>
                <span>Precio</span>
                <span />
              </div>
              {form.variants.map((variant, index) => (
                <div
                  className="mb-2 grid grid-cols-[1fr_130px_32px] items-center gap-2"
                  key={variant.id ?? index}
                >
                  <input
                    className="admin-input"
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        variants: current.variants.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row,
                        ),
                      }))
                    }
                    placeholder="Ej: Doble"
                    value={variant.name}
                  />
                  <input
                    className="admin-input"
                    min="0"
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        variants: current.variants.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, price_cents: Number(event.target.value) }
                            : row,
                        ),
                      }))
                    }
                    placeholder="$0"
                    type="number"
                    value={variant.price_cents}
                  />
                  <RemoveButton
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        variants: current.variants.filter((_, rowIndex) => rowIndex !== index),
                      }))
                    }
                  />
                </div>
              ))}
              <button className="option-add-button" onClick={onAddVariant} type="button">
                + Agregar variante
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[#e8e8e8] pt-[18px] dark:border-[#2e2e2e]">
          <OptionHeader
            checked={hasMods}
            description="Opciones que el cliente puede marcar o desmarcar"
            label="Modificaciones"
            onChange={(checked) =>
              checked
                ? onAddModifier()
                : onChange((current) => ({ ...current, modifiers: [] }))
            }
          />
          {hasMods ? (
            <div>
              <div className="mb-1.5 grid grid-cols-[1fr_100px_32px] gap-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[#999]">
                <span>Opción</span>
                <span>Por defecto</span>
                <span />
              </div>
              {form.modifiers.map((modifier, index) => (
                <div
                  className="mb-2 grid grid-cols-[1fr_100px_32px] items-center gap-2"
                  key={modifier.id ?? index}
                >
                  <input
                    className="admin-input"
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        modifiers: current.modifiers.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, label: event.target.value } : row,
                        ),
                      }))
                    }
                    placeholder="Ej: Con lechuga"
                    value={modifier.label}
                  />
                  <div className="flex justify-center">
                    <Toggle
                      checked={modifier.default_checked}
                      onChange={() =>
                        onChange((current) => ({
                          ...current,
                          modifiers: current.modifiers.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, default_checked: !row.default_checked }
                              : row,
                          ),
                        }))
                      }
                    />
                  </div>
                  <RemoveButton
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        modifiers: current.modifiers.filter((_, rowIndex) => rowIndex !== index),
                      }))
                    }
                  />
                </div>
              ))}
              <button className="option-add-button" onClick={onAddModifier} type="button">
                + Agregar opción
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            className="admin-primary-button flex-[2] disabled:opacity-60"
            disabled={saving}
            onClick={onSubmit}
            type="button"
          >
            {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear ítem"}
          </button>
          <button className="admin-muted-button flex-1" onClick={onClose} type="button">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
        {label}
      </span>
      {children}
    </label>
  );
}

function OptionHeader({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <div>
        <div className="text-[13px] font-black text-[#111] dark:text-[#f5f5f5]">{label}</div>
        <div className="text-[11px] text-[#999]">{description}</div>
      </div>
      <Toggle checked={checked} onChange={() => onChange(!checked)} />
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#f2f2f2] px-3 py-2 dark:bg-[#242424]">
      <span className="text-xs font-bold text-[#555] dark:text-[#a0a0a0]">{label}</span>
      <Toggle checked={checked} onChange={() => onChange(!checked)} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button className="admin-toggle" data-checked={checked} onClick={onChange} type="button">
      <span className="admin-toggle-thumb" />
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex size-8 items-center justify-center rounded-lg bg-[#ef4444]/10 text-base text-[#ef4444]"
      onClick={onClick}
      type="button"
    >
      ×
    </button>
  );
}
