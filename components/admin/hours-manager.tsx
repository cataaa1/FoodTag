"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
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
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function HoursManager() {
  const queryClient = useQueryClient();
  const [hoursState, setHoursState] = useState<HoursEntry[]>([]);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const hoursQuery = useQuery({
    queryKey: ["admin", "hours"],
    queryFn: () => fetchJson<{ hours: HoursEntry[] }>("/api/admin/hours"),
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
      setMessage("Horarios guardados");
      await refreshStatus();
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
      setPauseReason("");
      setShowPauseModal(false);
      await refreshStatus();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => fetchJson("/api/admin/truck/resume", { method: "POST" }),
    onSuccess: async () => {
      setMessage("Pausa manual removida");
      await refreshStatus();
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

  return (
    <AdminShell
      action={
        isPaused ? (
          <button
            className="rounded-[10px] bg-[#22c55e] px-[18px] py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(34,197,94,0.25)]"
            onClick={() => resumeMutation.mutate()}
            type="button"
          >
            ▶ Reanudar truck
          </button>
        ) : (
          <button
            className="rounded-[10px] bg-[#ef4444] px-[18px] py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(239,68,68,0.25)]"
            onClick={() => setShowPauseModal(true)}
            type="button"
          >
            ⏸ Pausar truck ahora
          </button>
        )
      }
      subtitle="Configurá cuándo está abierto el truck"
      title="Gestión de horarios"
    >
      {message ? (
        <div className="mb-5 rounded-[10px] border border-[#f97316]/25 bg-[#fff0e6] px-4 py-3 text-[13px] font-bold text-[#f97316]">
          {message}
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
                      onChange={() => updateHourRow(entry.weekday, { closed: active })}
                    />
                  </td>
                  <td className="border-b border-[#e8e8e8] px-4 py-[13px] dark:border-[#2e2e2e]">
                    <input
                      className="admin-input max-w-[135px] disabled:bg-[#f2f2f2] disabled:text-[#999] dark:disabled:bg-[#242424]"
                      disabled={!active}
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
                      disabled={!active}
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
        <button
          className="admin-primary-button px-6 py-3 text-sm"
          onClick={() => saveHoursMutation.mutate()}
          type="button"
        >
          Guardar cambios
        </button>
        <span className="text-xs font-semibold text-[#999]">
          Estado actual:{" "}
          {truckStatusQuery.data?.isOpen ? "abierto" : "cerrado"} ·{" "}
          {truckStatusQuery.data?.todayHoursLabel ?? "sin información"}
        </span>
      </div>

      {showPauseModal ? (
        <PauseModal
          onClose={() => setShowPauseModal(false)}
          onSubmit={() => pauseMutation.mutate()}
          reason={pauseReason}
          setReason={setPauseReason}
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
}: {
  onClose: () => void;
  onSubmit: () => void;
  reason: string;
  setReason: (reason: string) => void;
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
            onClick={onSubmit}
            type="button"
          >
            Pausar ahora
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
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="admin-toggle"
      data-checked={checked}
      onClick={onChange}
      type="button"
    >
      <span className="admin-toggle-thumb" />
    </button>
  );
}
