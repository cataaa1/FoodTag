"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, Store, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/utils/http";

type CategoryResponse = {
  categories: Array<{ id: string; visible: boolean }>;
};

type ItemsResponse = {
  items: Array<{ id: string; available: boolean; has_variants: boolean }>;
};

type HoursResponse = {
  hours: Array<{ weekday: number; closed: boolean }>;
};

type TruckStatus = {
  isOpen: boolean;
  todayHoursLabel: string;
  truckName: string;
  paused: boolean;
  reason: string | null;
};

export function DashboardOverview() {
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchJson<CategoryResponse>("/api/admin/categories"),
  });
  const itemsQuery = useQuery({
    queryKey: ["admin", "menu-items"],
    queryFn: () => fetchJson<ItemsResponse>("/api/admin/menu-items"),
  });
  const hoursQuery = useQuery({
    queryKey: ["admin", "hours"],
    queryFn: () => fetchJson<HoursResponse>("/api/admin/hours"),
  });
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });

  const categories = categoriesQuery.data?.categories ?? [];
  const items = itemsQuery.data?.items ?? [];
  const hours = hoursQuery.data?.hours ?? [];
  const truckStatus = truckStatusQuery.data;

  const openDays = hours.filter((entry) => !entry.closed).length;

  const metrics = [
    {
      label: "Categorías visibles",
      value: String(categories.filter((category) => category.visible).length),
      helper: "Se ven en el menú público",
      icon: Store,
    },
    {
      label: "Ítems activos",
      value: String(items.filter((item) => item.available).length),
      helper: "Disponibles para vender",
      icon: UtensilsCrossed,
    },
    {
      label: "Días con servicio",
      value: String(openDays),
      helper: "Horarios semanales configurados",
      icon: Clock3,
    },
  ];

  return (
    <AdminShell
      title="Dashboard del truck"
      subtitle="Resumen operativo de la configuración inicial del MVP."
    >
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <Card key={metric.label} className="surface-card border-white/70">
                  <CardHeader className="pb-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Icon className="size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-3xl font-black tracking-tight">{metric.value}</p>
                    <p className="text-sm font-semibold">{metric.label}</p>
                    <p className="text-xs text-muted-foreground">{metric.helper}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight">
                Lo que ya quedó cubierto en Fase 0/1
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Menú público por API, estados de abierto/cerrado y prompt de sesión
                listo para conectar con JWT en Fase 2.
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                CRUD base para categorías, ítems, variantes, horarios y pausa
                manual con permisos server-side.
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Auth staff con Supabase SSR, middleware y chequeo de rol/permisos
                desde el servidor.
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                Migración inicial, seed de roles del sistema y primer admin listos
                para staging.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight">
                Estado del truck
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl bg-primary/10 px-4 py-3 text-primary">
                <p className="font-bold">{truckStatus?.truckName ?? "FoodTag Truck"}</p>
                <p className="text-primary/80">
                  {truckStatus?.isOpen ? "Abierto ahora" : "Fuera de horario"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="font-semibold">Horario de hoy</p>
                <p className="text-muted-foreground">
                  {truckStatus?.todayHoursLabel ?? "Sin información"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="font-semibold">Pausa manual</p>
                <p className="text-muted-foreground">
                  {truckStatus?.paused
                    ? truckStatus.reason ?? "Pausado manualmente"
                    : "No hay pausa activa"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight">
                Siguientes pasos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-between">
                <Link href="/admin/menu">
                  Cargar menú y variantes
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild className="w-full justify-between" variant="secondary">
                <Link href="/admin/hours">
                  Ajustar horarios y pausa
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {categoriesQuery.isError || itemsQuery.isError || hoursQuery.isError ? (
            <EmptyState
              title="No pudimos leer la configuración"
              description="Revisá las variables de entorno, el schema inicial y el seed del proyecto."
            />
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
