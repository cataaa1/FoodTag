"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchJson } from "@/lib/utils/http";

type HoursEntry = {
  id: string;
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
};

type TruckStatus = {
  isOpen: boolean;
  paused: boolean;
  reason: string | null;
  truckName: string;
  todayHoursLabel: string;
};

const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export function HoursManager() {
  const queryClient = useQueryClient();
  const hoursQuery = useQuery({
    queryKey: ["admin", "hours"],
    queryFn: () => fetchJson<{ hours: HoursEntry[] }>("/api/admin/hours"),
  });
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });

  const [hoursState, setHoursState] = useState<HoursEntry[]>([]);
  const [pauseReason, setPauseReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hoursQuery.data?.hours) {
      setHoursState(hoursQuery.data.hours);
    }
  }, [hoursQuery.data]);

  const openDays = useMemo(
    () => hoursState.filter((entry) => !entry.closed).length,
    [hoursState],
  );

  const saveHoursMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ hours: HoursEntry[] }>("/api/admin/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: hoursState }),
      }),
    onSuccess: async () => {
      setMessage("Horarios guardados");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "hours"] }),
        queryClient.invalidateQueries({ queryKey: ["truck-status"] }),
      ]);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () =>
      fetchJson("/api/admin/truck/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: pauseReason }),
      }),
    onSuccess: async () => {
      setMessage("Truck pausado manualmente");
      await queryClient.invalidateQueries({ queryKey: ["truck-status"] });
      setPauseReason("");
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () =>
      fetchJson("/api/admin/truck/resume", {
        method: "POST",
      }),
    onSuccess: async () => {
      setMessage("Pausa manual removida");
      await queryClient.invalidateQueries({ queryKey: ["truck-status"] });
    },
  });

  function updateHourRow(
    weekday: number,
    patch: Partial<Pick<HoursEntry, "closed" | "opensAt" | "closesAt">>,
  ) {
    setHoursState((current) =>
      current.map((entry) =>
        entry.weekday === weekday ? { ...entry, ...patch } : entry,
      ),
    );
  }

  return (
    <AdminShell
      title="Horarios y pausa manual"
      subtitle="Control semanal del truck y cierre instantáneo del servicio."
    >
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Operación"
          title="Disponibilidad del truck"
          description="El menú público consulta este estado antes de dejar iniciar el flujo de pedido."
        />

        {message ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <Card className="surface-card border-white/70">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl font-black tracking-tight">
                Semana operativa
                <Badge variant="secondary">{openDays} días abiertos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hoursState.map((entry) => (
                <div
                  key={entry.weekday}
                  className="rounded-3xl border border-border/70 bg-background/75 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr] md:items-center">
                    <div>
                      <p className="text-base font-bold">
                        {WEEKDAY_LABELS[entry.weekday]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.closed
                          ? "El truck no atiende este día"
                          : "Horario visible para clientes y staff"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Apertura</Label>
                        <Input
                          disabled={entry.closed}
                          type="time"
                          value={entry.opensAt?.slice(0, 5) ?? ""}
                          onChange={(event) =>
                            updateHourRow(entry.weekday, {
                              opensAt: event.target.value
                                ? `${event.target.value}:00`
                                : null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cierre</Label>
                        <Input
                          disabled={entry.closed}
                          type="time"
                          value={entry.closesAt?.slice(0, 5) ?? ""}
                          onChange={(event) =>
                            updateHourRow(entry.weekday, {
                              closesAt: event.target.value
                                ? `${event.target.value}:00`
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3">
                      <div>
                        <p className="font-semibold">Día cerrado</p>
                        <p className="text-sm text-muted-foreground">
                          Apaga toda la jornada.
                        </p>
                      </div>
                      <Switch
                        checked={entry.closed}
                        onCheckedChange={(checked) =>
                          updateHourRow(entry.weekday, { closed: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                className="w-full md:w-auto"
                type="button"
                onClick={() => saveHoursMutation.mutate()}
              >
                Guardar horarios
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="surface-card border-white/70">
              <CardHeader>
                <CardTitle className="text-xl font-black tracking-tight">
                  Estado actual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl bg-primary/10 px-4 py-3 text-primary">
                  <p className="font-bold">{truckStatusQuery.data?.truckName ?? "FoodTag Truck"}</p>
                  <p>
                    {truckStatusQuery.data?.isOpen
                      ? "Abierto ahora"
                      : "Fuera de horario o pausado"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                  <p className="font-semibold">Horario de hoy</p>
                  <p className="text-muted-foreground">
                    {truckStatusQuery.data?.todayHoursLabel ?? "Sin información"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
                  <p className="font-semibold">Pausa manual</p>
                  <p className="text-muted-foreground">
                    {truckStatusQuery.data?.paused
                      ? truckStatusQuery.data.reason ?? "Pausado"
                      : "No hay pausa activa"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card border-white/70">
              <CardHeader>
                <CardTitle className="text-xl font-black tracking-tight">
                  Pausar truck ahora
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Motivo visible para operación</Label>
                  <Input
                    value={pauseReason}
                    onChange={(event) => setPauseReason(event.target.value)}
                    placeholder="Falta de stock, corte de gas, lluvia..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    type="button"
                    onClick={() => pauseMutation.mutate()}
                  >
                    Pausar manualmente
                  </Button>
                  <Button
                    className="flex-1"
                    type="button"
                    variant="secondary"
                    onClick={() => resumeMutation.mutate()}
                  >
                    Reanudar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
