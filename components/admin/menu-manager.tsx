"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/utils/http";

type Category = {
  id: string;
  name: string;
  position: number;
  visible: boolean;
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
};

type Variant = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  available: boolean;
  position: number;
};

const EMPTY_CATEGORY_FORM = {
  id: "",
  name: "",
  position: "0",
  visible: true,
};

const EMPTY_ITEM_FORM = {
  id: "",
  categoryId: "",
  name: "",
  description: "",
  priceCents: "0",
  photoUrl: "",
  available: true,
  hasVariants: false,
  position: "0",
};

const EMPTY_VARIANT_FORM = {
  id: "",
  menuItemId: "",
  name: "",
  priceCents: "0",
  available: true,
  position: "0",
};

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ITEMS: MenuItem[] = [];
const EMPTY_VARIANTS: Variant[] = [];

export function MenuManager() {
  const queryClient = useQueryClient();
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchJson<{ categories: Category[] }>("/api/admin/categories"),
  });
  const itemsQuery = useQuery({
    queryKey: ["admin", "menu-items"],
    queryFn: () => fetchJson<{ items: MenuItem[] }>("/api/admin/menu-items"),
  });
  const variantsQuery = useQuery({
    queryKey: ["admin", "variants"],
    queryFn: () => fetchJson<{ variants: Variant[] }>("/api/admin/variants"),
  });

  const categories = categoriesQuery.data?.categories ?? EMPTY_CATEGORIES;
  const items = itemsQuery.data?.items ?? EMPTY_ITEMS;
  const variants = variantsQuery.data?.variants ?? EMPTY_VARIANTS;

  const itemsWithCategory = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        categoryName:
          categories.find((category) => category.id === item.category_id)?.name ??
          "Sin categoría",
        variantCount: variants.filter((variant) => variant.menu_item_id === item.id)
          .length,
      })),
    [categories, items, variants],
  );

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "menu-items"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "variants"] }),
      queryClient.invalidateQueries({ queryKey: ["truck-status"] }),
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
      setFeedback("Categoría guardada");
      setCategoryForm(EMPTY_CATEGORY_FORM);
      await refreshAll();
    },
  });

  const itemMutation = useMutation({
    mutationFn: async () => {
      const body = {
        categoryId: itemForm.categoryId,
        name: itemForm.name,
        description: itemForm.description || null,
        priceCents: Number(itemForm.priceCents),
        photoUrl: itemForm.photoUrl || null,
        available: itemForm.available,
        hasVariants: itemForm.hasVariants,
        position: Number(itemForm.position),
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
      setFeedback("Ítem guardado");
      setItemForm(EMPTY_ITEM_FORM);
      await refreshAll();
    },
  });

  const variantMutation = useMutation({
    mutationFn: async () => {
      const body = {
        menuItemId: variantForm.menuItemId,
        name: variantForm.name,
        priceCents: Number(variantForm.priceCents),
        available: variantForm.available,
        position: Number(variantForm.position),
      };

      if (variantForm.id) {
        return fetchJson(`/api/admin/variants/${variantForm.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      return fetchJson("/api/admin/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setFeedback("Variante guardada");
      setVariantForm(EMPTY_VARIANT_FORM);
      await refreshAll();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { kind: "category" | "item" | "variant"; id: string }) => {
      const pathMap = {
        category: `/api/admin/categories/${input.id}`,
        item: `/api/admin/menu-items/${input.id}`,
        variant: `/api/admin/variants/${input.id}`,
      };

      return fetchJson(pathMap[input.kind], { method: "DELETE" });
    },
    onSuccess: async () => {
      setFeedback("Registro eliminado");
      await refreshAll();
    },
  });

  return (
    <AdminShell
      title="Gestión de menú"
      subtitle="Categorías, ítems y variantes desde el mismo panel."
    >
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Fase 1"
          title="Menú público administrable"
          description="La UI sigue la línea del handoff, pero ya conectada a route handlers, Zod y permisos server-side."
        />

        {feedback ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.1fr_0.95fr]">
          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl font-black tracking-tight">
                Categorías
                <Badge variant="secondary">{categories.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {categories.length ? (
                  categories.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-border/70 bg-background/70 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Posición {category.position}
                          </p>
                        </div>
                        <Badge variant={category.visible ? "default" : "secondary"}>
                          {category.visible ? "Visible" : "Oculta"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setCategoryForm({
                              id: category.id,
                              name: category.name,
                              position: String(category.position),
                              visible: category.visible,
                            })
                          }
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            deleteMutation.mutate({ kind: "category", id: category.id })
                          }
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Todavía no hay categorías"
                    description="Cargá las primeras familias del menú para publicar el truck."
                  />
                )}
              </div>

              <div className="space-y-3 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-lg font-black tracking-tight">
                  <Plus className="size-4" />
                  {categoryForm.id ? "Editar categoría" : "Nueva categoría"}
                </p>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Hamburguesas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posición</Label>
                  <Input
                    min="0"
                    type="number"
                    value={categoryForm.position}
                    onChange={(event) =>
                      setCategoryForm((current) => ({
                        ...current,
                        position: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                  <div>
                    <p className="font-semibold">Mostrar en el menú</p>
                    <p className="text-sm text-muted-foreground">
                      Si la apagás, no se renderiza en `/menu`.
                    </p>
                  </div>
                  <Switch
                    checked={categoryForm.visible}
                    onCheckedChange={(checked) =>
                      setCategoryForm((current) => ({ ...current, visible: checked }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    type="button"
                    onClick={() => categoryMutation.mutate()}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setCategoryForm(EMPTY_CATEGORY_FORM)}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl font-black tracking-tight">
                Ítems del menú
                <Badge variant="secondary">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                {itemsWithCategory.length ? (
                  itemsWithCategory.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/70 bg-background/75 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.categoryName} · ${item.price_cents.toLocaleString("es-AR")}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Badge variant={item.available ? "default" : "secondary"}>
                            {item.available ? "Disponible" : "Agotado"}
                          </Badge>
                          {item.has_variants ? (
                            <Badge variant="outline">{item.variantCount} variantes</Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {item.description || "Sin descripción"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setItemForm({
                              id: item.id,
                              categoryId: item.category_id,
                              name: item.name,
                              description: item.description ?? "",
                              priceCents: String(item.price_cents),
                              photoUrl: item.photo_url ?? "",
                              available: item.available,
                              hasVariants: item.has_variants,
                              position: String(item.position),
                            })
                          }
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            deleteMutation.mutate({ kind: "item", id: item.id })
                          }
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Todavía no hay ítems"
                    description="Creá el primer producto para habilitar el flujo público de menú."
                  />
                )}
              </div>

              <div className="space-y-3 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-lg font-black tracking-tight">
                  {itemForm.id ? "Editar ítem" : "Nuevo ítem"}
                </p>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={itemForm.categoryId}
                    onValueChange={(value) =>
                      setItemForm((current) => ({ ...current, categoryId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={itemForm.name}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Classic Smash"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={itemForm.description}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Doble medallón, cheddar, pickles..."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Precio (centavos)</Label>
                    <Input
                      min="0"
                      type="number"
                      value={itemForm.priceCents}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          priceCents: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <Input
                      min="0"
                      type="number"
                      value={itemForm.position}
                      onChange={(event) =>
                        setItemForm((current) => ({
                          ...current,
                          position: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Foto URL</Label>
                  <Input
                    value={itemForm.photoUrl}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        photoUrl: event.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                    <div>
                      <p className="font-semibold">Disponible</p>
                      <p className="text-sm text-muted-foreground">Toggle de stock MVP</p>
                    </div>
                    <Switch
                      checked={itemForm.available}
                      onCheckedChange={(checked) =>
                        setItemForm((current) => ({ ...current, available: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                    <div>
                      <p className="font-semibold">Tiene variantes</p>
                      <p className="text-sm text-muted-foreground">Simple/Doble/Triple</p>
                    </div>
                    <Switch
                      checked={itemForm.hasVariants}
                      onCheckedChange={(checked) =>
                        setItemForm((current) => ({
                          ...current,
                          hasVariants: checked,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" type="button" onClick={() => itemMutation.mutate()}>
                    Guardar ítem
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setItemForm(EMPTY_ITEM_FORM)}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl font-black tracking-tight">
                Variantes
                <Badge variant="secondary">{variants.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {variants.length ? (
                  variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="rounded-2xl border border-border/70 bg-background/75 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold">{variant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ${
                              variant.price_cents.toLocaleString("es-AR")
                            } · Posición {variant.position}
                          </p>
                        </div>
                        <Badge variant={variant.available ? "default" : "secondary"}>
                          {variant.available ? "Activa" : "Oculta"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setVariantForm({
                              id: variant.id,
                              menuItemId: variant.menu_item_id,
                              name: variant.name,
                              priceCents: String(variant.price_cents),
                              available: variant.available,
                              position: String(variant.position),
                            })
                          }
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            deleteMutation.mutate({ kind: "variant", id: variant.id })
                          }
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Todavía no hay variantes"
                    description="Activá variantes en un ítem para cargar tamaños o versiones."
                  />
                )}
              </div>

              <div className="space-y-3 rounded-3xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-lg font-black tracking-tight">
                  {variantForm.id ? "Editar variante" : "Nueva variante"}
                </p>
                <div className="space-y-2">
                  <Label>Ítem padre</Label>
                  <Select
                    value={variantForm.menuItemId}
                    onValueChange={(value) =>
                      setVariantForm((current) => ({ ...current, menuItemId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí un ítem" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={variantForm.name}
                    onChange={(event) =>
                      setVariantForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Doble"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Precio (centavos)</Label>
                    <Input
                      min="0"
                      type="number"
                      value={variantForm.priceCents}
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          priceCents: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <Input
                      min="0"
                      type="number"
                      value={variantForm.position}
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          position: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                  <div>
                    <p className="font-semibold">Disponible</p>
                    <p className="text-sm text-muted-foreground">
                      Si se apaga, no se ofrece al cliente.
                    </p>
                  </div>
                  <Switch
                    checked={variantForm.available}
                    onCheckedChange={(checked) =>
                      setVariantForm((current) => ({
                        ...current,
                        available: checked,
                      }))
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    type="button"
                    onClick={() => variantMutation.mutate()}
                  >
                    Guardar variante
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setVariantForm(EMPTY_VARIANT_FORM)}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
