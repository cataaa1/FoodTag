"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { useTransientMessage } from "@/hooks/use-transient-message";
import type { PermissionKey } from "@/lib/types/domain";
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

type HoursResponse = {
  hours: HoursEntry[];
  permissions: PermissionKey[];
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
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function HoursManager() {
  const queryClient = useQueryClient();
  const [hoursState, setHoursState] = useState<HoursEntry[]>([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useTransientMessage(message, () => setMessage(null));
  useTransientMessage(error, () => setError(null), 4_200);

  const hoursQuery = useQuery({
    queryKey: ["admin", "hours"],
    queryFn: () => fetchJson<HoursResponse>("/api/admin/hours"),
  });
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });

  useEffect(() => {
    if (hoursQuery.data?.hours) {
      setHoursState(hoursQuery.data.hours);
    }
  }, [hoursQuery.data]);

  const orderedHours = useMemo(
    () =>
      DISPLAY_ORDER.map((weekday) =>
        hoursState.find((entry) => entry.weekday === weekday),
      ).filter((entry): entry is HoursEntry => Boolean(entry)),
    [hoursState],
  );

  async function refreshStatus() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "hours"] }),
      queryClient.invalidateQueries({ queryKey: ["truck-status"] }),
      queryClient.invalidateQueries({ queryKey: ["public-menu"] }),
    ]);
  }

  const saveHoursMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ hours: HoursEntry[] }>("/api/admin/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: hoursState }),
      }),
    onSuccess: async () => {
      setError(null);
      setMessage("Horarios guardados");
      await refreshStatus();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos guardar los horarios",
      );
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
      setError(null);
      setMessage("Truck pausado manualmente");
      setPauseReason("");
      setShowPauseModal(false);
      await refreshStatus();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos pausar el truck",
      );
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => fetchJson("/api/admin/truck/resume", { method: "POST" }),
    onSuccess: async () => {
      setError(null);
      setMessage("Pausa manual removida");
      await refreshStatus();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos reanudar el truck",
      );
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

  const isPaused = truckStatusQuery.data?.paused ?? false;
  const permissions = hoursQuery.data?.permissions ?? [];
  const canPauseTruck = permissions.includes("settings.write");
  // Cajero y cocina consultan la grilla; solo hours.write puede tocarla.
  const canEditHours = permissions.includes("hours.write");

  return (
    <AdminShell
      action={
        canPauseTruck ? (
          isPaused ? (
            <button
              className="rounded-[10px] bg-[#22c55e] px-[18px] py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]"
              disabled={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
              type="button"
            >
              {resumeMutation.isPending ? "Reanudando..." : "▶ Reanudar truck"}
            </button>
          ) : (
            <button
              className="rounded-[10px] bg-[#ef4444] px-[18px] py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
              disabled={pauseMutation.isPending}
              onClick={() => setShowPauseModal(true)}
              type="button"
            >
              ⏸ Pausar truck ahora
            </button>
          )
        ) : (
          <span className="rounded-[10px] border border-[#e8e8e8] bg-[#f8f8f8] px-4 py-2.5 text-[12px] font-bold text-[#777] dark:border-[#2e2e2e] dark:bg-[#222] dark:text-[#aaa]">
            Sin permiso para pausar o reanudar
          </span>
        )
      }
      subtitle={
        canEditHours
          ? "Configurá cuándo está abierto el truck"
          : "Horarios y pausa del truck (solo lectura)"
      }
      title="Gestión de horarios"
    >
      {!canEditHours ? (
        <div className="mb-5 rounded-[10px] border border-[#e8e8e8] bg-[#f8f8f8] px-4 py-3 text-[13px] font-semibold text-[#777] dark:border-[#2e2e2e] dark:bg-[#222] dark:text-[#aaa]">
          Estás viendo los horarios en modo lectura. Para editarlos necesitás el
          permiso <span className="font-black">Editar horarios</span>.
        </div>
      ) : null}
      {message ? (
        <div className="brand-accent-notice mb-5 rounded-[10px] border px-4 py-3 text-[13px] font-bold">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-bold text-[#ef4444]">
          {error}
        </div>
      ) : null}

      <div className="mb-5 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[120px] bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
                Día
              </th>
              <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
                Abierto
              </th>
              <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
                Apertura
              </th>
              <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
                Cierre
              </th>
              <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedHours.map((entry) => {
              const active = !entry.closed;

              return (
                <tr className="hover:bg-[#f2f2f2] dark:hover:bg-[#242424]" key={entry.weekday}>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] text-sm font-bold text-[#111] dark:border-[#2e2e2e] dark:text-[#f5f5f5]">
                    {WEEKDAY_LABELS[entry.weekday]}
                  </td>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                    <Toggle
                      checked={active}
                      disabled={!canEditHours}
                      onChange={() => updateHourRow(entry.weekday, { closed: active })}
                    />
                  </td>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                    <input
                      className="admin-input max-w-[135px] disabled:bg-[#f2f2f2] disabled:text-[#999] dark:disabled:bg-[#242424]"
                      disabled={!active || !canEditHours}
                      onChange={(event) =>
                        updateHourRow(entry.weekday, {
                          opensAt: event.target.value ? `${event.target.value}:00` : null,
                        })
                      }
                      type="time"
                      value={entry.opensAt?.slice(0, 5) ?? ""}
                    />
                  </td>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                    <input
                      className="admin-input max-w-[135px] disabled:bg-[#f2f2f2] disabled:text-[#999] dark:disabled:bg-[#242424]"
                      disabled={!active || !canEditHours}
                      onChange={(event) =>
                        updateHourRow(entry.weekday, {
                          closesAt: event.target.value ? `${event.target.value}:00` : null,
                        })
                      }
                      type="time"
                      value={entry.closesAt?.slice(0, 5) ?? ""}
                    />
                  </td>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                    <span
                      className="rounded-md px-2.5 py-1 text-[11px] font-bold"
                      style={{
                        background: active ? "rgba(34,197,94,0.1)" : "#f2f2f2",
                        color: active ? "#22c55e" : "#999",
                      }}
                    >
                      {active ? "Abierto" : "Cerrado"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canEditHours ? (
          <button
            className="admin-primary-button px-6 py-3 text-sm"
            disabled={saveHoursMutation.isPending}
            onClick={() => saveHoursMutation.mutate()}
            type="button"
          >
            {saveHoursMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        ) : null}
        <span className="text-xs font-semibold text-[#999]">
          Estado actual: {truckStatusQuery.data?.isOpen ? "abierto" : "cerrado"} ·{" "}
          {truckStatusQuery.data?.todayHoursLabel ?? "sin información"}
        </span>
      </div>

      {showPauseModal ? (
        <PauseModal
          onClose={() => setShowPauseModal(false)}
          onSubmit={() => pauseMutation.mutate()}
          reason={pauseReason}
          setReason={setPauseReason}
          submitting={pauseMutation.isPending}
        />
      ) : null}
    </AdminShell>
  );
}

function PauseModal({
  onClose,
  onSubmit,
  reason,
  setReason,
  submitting,
}: {
  onClose: () => void;
  onSubmit: () => void;
  reason: string;
  setReason: (reason: string) => void;
  submitting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-[20px] bg-white p-7 dark:bg-[#1a1a1a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 text-center text-5xl">⏸</div>
        <div className="mb-1.5 text-center text-lg font-black text-[#111] dark:text-[#f5f5f5]">
          ¿Pausar el truck?
        </div>
        <div className="mb-5 text-center text-[13px] text-[#999]">
          Los clientes verán que están cerrados hasta que lo retomes.
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
            Motivo (opcional)
          </span>
          <input
            className="admin-input"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej: Sin gas, lluvia..."
            value={reason}
          />
        </label>
        <div className="flex gap-2.5">
          <button
            className="flex-[2] rounded-[10px] bg-[#ef4444] p-[13px] text-sm font-bold text-white"
            disabled={submitting}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "Pausando..." : "Pausar ahora"}
          </button>
          <button className="admin-muted-button flex-1" onClick={onClose} type="button">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="admin-toggle disabled:cursor-not-allowed disabled:opacity-50"
      data-checked={checked}
      disabled={disabled}
      onClick={onChange}
      type="button"
    >
      <span className="admin-toggle-thumb" />
    </button>
  );
}
