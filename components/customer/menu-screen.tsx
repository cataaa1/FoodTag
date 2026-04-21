"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, QrCode, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/utils/http";

type TruckStatus = {
  isOpen: boolean;
  nextOpeningLabel: string | null;
  paused: boolean;
  reason: string | null;
  truckName: string;
  primaryColor: string;
  todayHoursLabel: string;
};

type MenuVariant = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
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
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type SessionDraft = {
  name: string;
  phone: string;
};

const SESSION_STORAGE_KEY = "foodtag-customer-draft";
const EMPTY_CATEGORIES: MenuCategory[] = [];

export function MenuScreen() {
  const statusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });
  const menuQuery = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => fetchJson<{ categories: MenuCategory[] }>("/api/menu"),
  });

  const [draft, setDraft] = useState<SessionDraft>({ name: "", phone: "" });
  const [sessionReady, setSessionReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as SessionDraft;
    setDraft(parsed);
    setSessionReady(Boolean(parsed.name && parsed.phone));
  }, []);

  const categories = menuQuery.data?.categories ?? EMPTY_CATEGORIES;
  const visibleItems = useMemo(
    () =>
      categories.flatMap((category) =>
        category.items.filter((item) => item.available).map((item) => ({
          ...item,
          categoryName: category.name,
        })),
      ),
    [categories],
  );

  function handleSessionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(draft));
    setSessionReady(true);
  }

  const truckName = statusQuery.data?.truckName ?? "FoodTag Truck";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 md:px-6 md:py-8">
      <section className="surface-card surface-glow overflow-hidden border-white/70">
        <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10">
          <div className="space-y-5">
            <Badge className="rounded-full px-4 py-1.5 text-xs font-extrabold tracking-[0.24em] uppercase">
              FoodTag MVP
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-black tracking-tight md:text-6xl">
                Pedí desde tu celu y esperá el beeper digital.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                Un solo QR, menú vivo, pago obligatorio antes de cocina y ticket
                listo para la próxima fase de checkout.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-full bg-primary/10 px-4 py-2 font-semibold text-primary">
                {statusQuery.data?.isOpen ? "Abierto ahora" : "Cerrado"}
              </div>
              <div className="rounded-full bg-secondary px-4 py-2 font-semibold text-secondary-foreground">
                Horario de hoy: {statusQuery.data?.todayHoursLabel ?? "cargando..."}
              </div>
            </div>
          </div>

          <Card className="rounded-[32px] border-border/80 bg-[#fff8f1] p-1 shadow-[0_30px_80px_rgba(28,16,9,0.15)]">
            <CardContent className="rounded-[28px] border border-white/80 bg-gradient-to-b from-[#fffaf5] to-[#fff1e6] p-6">
              <div className="mb-6 flex items-center justify-between text-sm font-semibold">
                <span>{truckName}</span>
                <span className="ticket-font text-muted-foreground">9:41</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <QrCode className="size-5 text-primary" />
                  <div>
                    <p className="font-bold">Un único QR por truck</p>
                    <p className="text-sm text-muted-foreground">
                      La URL fija del MVP es `/menu`.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <Flame className="size-5 text-primary" />
                  <div>
                    <p className="font-bold">Beeper in-tab</p>
                    <p className="text-sm text-muted-foreground">
                      Audio y vibración quedan preparados para Fase 2.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <Store className="size-5 text-primary" />
                  <div>
                    <p className="font-bold">Menú administrable</p>
                    <p className="text-sm text-muted-foreground">
                      Todo lo que ve el cliente sale del panel admin.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {!statusQuery.data?.isOpen ? (
        <Card className="surface-card border-white/70 bg-card/95">
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-3xl font-black tracking-tight">El truck está cerrado</p>
            <p className="text-muted-foreground">
              {statusQuery.data?.paused
                ? statusQuery.data.reason ?? "Pausa manual activa"
                : `Próxima apertura: ${statusQuery.data?.nextOpeningLabel ?? "a definir"}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Card className="surface-card border-white/70">
              <CardContent className="space-y-4 p-6">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                    Sesión cliente
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    Antes de empezar, contanos quién sos
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    En Fase 1 queda como preparación visual/local; la cookie JWT
                    httpOnly entra en Fase 2.
                  </p>
                </div>
                <form className="space-y-4" onSubmit={handleSessionSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">Nombre</Label>
                    <Input
                      id="customer-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Catalina"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-phone">Teléfono</Label>
                    <Input
                      id="customer-phone"
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="11 5555-5555"
                      required
                    />
                  </div>
                  <Button className="w-full" type="submit">
                    {sessionReady ? "Actualizar datos del dispositivo" : "Usar este dispositivo"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="surface-card border-white/70">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                    Estado de la fase
                  </p>
                  <h2 className="text-2xl font-black tracking-tight">
                    Menú público listo para integrarse con carrito y pago
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Ya estamos consultando `/api/menu` y `/api/customer/truck-status`
                    en tiempo real. El botón de compra final se habilita cuando
                    entremos en Fase 2.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge variant={sessionReady ? "default" : "secondary"}>
                    {sessionReady ? "Sesión local lista" : "Sin sesión persistida"}
                  </Badge>
                  <Badge variant="outline">{visibleItems.length} ítems disponibles</Badge>
                  <Badge variant="outline">{cartCount} ítems en demo carrito</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            {categories.map((category) => (
              <div key={category.id} className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">
                      Categoría
                    </p>
                    <h2 className="text-2xl font-black tracking-tight">{category.name}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {category.items.length} opciones
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {category.items.map((item) => (
                    <Card
                      key={item.id}
                      className="surface-card border-white/70 bg-card/95 transition-transform hover:-translate-y-1"
                    >
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xl font-black tracking-tight">{item.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.description || "Sin descripción"}
                            </p>
                          </div>
                          <Badge variant={item.available ? "default" : "secondary"}>
                            {item.available ? "Disponible" : "Agotado"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.hasVariants
                            ? item.variants.map((variant) => (
                                <Badge key={variant.id} variant="outline">
                                  {variant.name}
                                </Badge>
                              ))
                            : null}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-black text-primary">
                            ${item.priceCents.toLocaleString("es-AR")}
                          </p>
                          <Button
                            disabled={!sessionReady || !item.available}
                            type="button"
                            onClick={() => setCartCount((count) => count + 1)}
                          >
                            {sessionReady ? "Sumar demo" : "Completá tus datos"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
