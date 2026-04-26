"use client";

import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin/admin-shell";
import { fetchJson } from "@/lib/utils/http";

type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  at: string;
};

type HistoryCategory =
  | "all"
  | "menu"
  | "users"
  | "roles"
  | "settings"
  | "hours"
  | "operation";

type HistoryPresentation = {
  category: Exclude<HistoryCategory, "all">;
  categoryLabel: string;
  title: string;
  description: string;
  details: string[];
};

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  all: "Todo",
  menu: "Menú",
  users: "Usuarios",
  roles: "Roles",
  settings: "Configuración",
  hours: "Horarios",
  operation: "Operación",
};

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function buildDetailsFromMetadata(metadata: Record<string, unknown>) {
  const details: string[] = [];
  const name = asString(metadata.name);
  const roleName = asString(metadata.roleName);
  const email = asString(metadata.email);
  const fullName = asString(metadata.fullName);
  const permissions = asStringArray(metadata.permissions);
  const available = asBoolean(metadata.available);
  const hasImage = asBoolean(metadata.hasImage);
  const hasVariants = asBoolean(metadata.hasVariants);

  if (name) details.push(`Nombre: ${name}`);
  if (fullName) details.push(`Usuario: ${fullName}`);
  if (email) details.push(`Email: ${email}`);
  if (roleName) details.push(`Rol: ${roleName}`);
  if (available !== null) details.push(`Disponible: ${available ? "sí" : "no"}`);
  if (hasImage !== null) details.push(`Imagen cargada: ${hasImage ? "sí" : "no"}`);
  if (hasVariants !== null) details.push(`Usa variantes: ${hasVariants ? "sí" : "no"}`);
  if (permissions.length) details.push(`Permisos: ${permissions.join(", ")}`);

  return details;
}

function presentHistoryEntry(entry: AuditLogEntry): HistoryPresentation {
  const metadata = entry.metadata;
  const name = asString(metadata.name);
  const fullName = asString(metadata.fullName);
  const reason = entry.reason?.trim();

  switch (entry.action) {
    case "menu.category.created":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Categoría creada",
        description: name ? `Se agregó la categoría "${name}".` : "Se agregó una categoría.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.category.updated":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Categoría actualizada",
        description: "Se actualizaron los datos de una categoría del menú.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.category.deleted":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Categoría eliminada",
        description: name ? `Se eliminó la categoría "${name}".` : "Se eliminó una categoría.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.item.created":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Ítem creado",
        description: name ? `Se agregó "${name}" al menú.` : "Se agregó un ítem al menú.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.item.updated":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Ítem actualizado",
        description: name ? `Se editaron los datos de "${name}".` : "Se editó un ítem del menú.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.item.availability.updated":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Disponibilidad actualizada",
        description: name
          ? `Se cambió la disponibilidad de "${name}".`
          : "Se cambió la disponibilidad de un ítem.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "menu.item.deleted":
      return {
        category: "menu",
        categoryLabel: CATEGORY_LABELS.menu,
        title: "Ítem eliminado",
        description: name ? `Se eliminó "${name}" del menú.` : "Se eliminó un ítem del menú.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "staff-user.created":
      return {
        category: "users",
        categoryLabel: CATEGORY_LABELS.users,
        title: "Usuario creado",
        description: fullName
          ? `Se creó el usuario "${fullName}".`
          : "Se creó un usuario del staff.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "staff-user.updated":
      return {
        category: "users",
        categoryLabel: CATEGORY_LABELS.users,
        title: "Usuario actualizado",
        description: fullName
          ? `Se actualizaron los datos de "${fullName}".`
          : "Se actualizó un usuario del staff.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "staff-user.activated":
      return {
        category: "users",
        categoryLabel: CATEGORY_LABELS.users,
        title: "Usuario activado",
        description: fullName
          ? `Se volvió a activar a "${fullName}".`
          : "Se activó un usuario del staff.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "staff-user.deactivated":
      return {
        category: "users",
        categoryLabel: CATEGORY_LABELS.users,
        title: "Usuario desactivado",
        description: fullName
          ? `Se desactivó a "${fullName}".`
          : "Se desactivó un usuario del staff.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "staff-user.deleted":
      return {
        category: "users",
        categoryLabel: CATEGORY_LABELS.users,
        title: "Usuario eliminado",
        description: fullName
          ? `Se eliminó el usuario "${fullName}".`
          : "Se eliminó un usuario del staff.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "role.created":
      return {
        category: "roles",
        categoryLabel: CATEGORY_LABELS.roles,
        title: "Rol creado",
        description: name ? `Se creó el rol "${name}".` : "Se creó un rol.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "role.updated":
      return {
        category: "roles",
        categoryLabel: CATEGORY_LABELS.roles,
        title: "Rol actualizado",
        description: name ? `Se editaron los permisos de "${name}".` : "Se editó un rol.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "role.deleted":
      return {
        category: "roles",
        categoryLabel: CATEGORY_LABELS.roles,
        title: "Rol eliminado",
        description: name ? `Se eliminó el rol "${name}".` : "Se eliminó un rol.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "truck.settings.updated":
      return {
        category: "settings",
        categoryLabel: CATEGORY_LABELS.settings,
        title: "Configuración guardada",
        description: "Se actualizaron los ajustes generales del food truck.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "truck.hours.updated":
      return {
        category: "hours",
        categoryLabel: CATEGORY_LABELS.hours,
        title: "Horarios actualizados",
        description: "Se guardó una nueva grilla horaria para la semana.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "truck.paused":
      return {
        category: "operation",
        categoryLabel: CATEGORY_LABELS.operation,
        title: "Truck pausado",
        description: reason
          ? `Se activó una pausa manual: ${reason}.`
          : "Se activó una pausa manual.",
        details: buildDetailsFromMetadata(metadata),
      };
    case "truck.resumed":
      return {
        category: "operation",
        categoryLabel: CATEGORY_LABELS.operation,
        title: "Truck reanudado",
        description: "Se quitó la pausa manual y el truck volvió a operar.",
        details: buildDetailsFromMetadata(metadata),
      };
    default:
      return {
        category: "operation",
        categoryLabel: CATEGORY_LABELS.operation,
        title: entry.action,
        description: "Evento registrado por el sistema.",
        details: buildDetailsFromMetadata(metadata),
      };
  }
}

export function HistoryManager() {
  const [selectedCategory, setSelectedCategory] = useState<HistoryCategory>("all");
  const [search, setSearch] = useState("");
  const historyQuery = useQuery({
    queryKey: ["admin", "history"],
    queryFn: () => fetchJson<{ entries: AuditLogEntry[] }>("/api/admin/history"),
  });

  const presentedEntries = useMemo(
    () =>
      (historyQuery.data?.entries ?? []).map((entry) => ({
        ...entry,
        presentation: presentHistoryEntry(entry),
      })),
    [historyQuery.data?.entries],
  );

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return presentedEntries.filter((entry) => {
      if (
        selectedCategory !== "all" &&
        entry.presentation.category !== selectedCategory
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        entry.presentation.title,
        entry.presentation.description,
        entry.presentation.categoryLabel,
        entry.actorName ?? "Sistema",
        entry.actorEmail ?? "",
        ...entry.presentation.details,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [presentedEntries, search, selectedCategory]);

  return (
    <AdminShell subtitle="Eventos auditados del backoffice" title="Historial">
      {historyQuery.isError ? (
        <div className="rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 p-5">
          <div className="text-sm font-bold text-[#ef4444]">No pudimos cargar el historial</div>
          <div className="mt-1 text-xs text-[#666] dark:text-white/60">
            Esta vista requiere permisos de gestión y acceso a la base local.
          </div>
        </div>
      ) : null}

      {!historyQuery.isError ? (
        <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className="admin-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por acción, usuario o detalle"
            type="search"
            value={search}
          />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as HistoryCategory[]).map((category) => {
              const active = selectedCategory === category;

              return (
                <button
                  className="rounded-full border px-3 py-2 text-xs font-black transition"
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  style={
                    active
                      ? {
                          backgroundColor: "var(--admin-accent)",
                          borderColor: "var(--admin-accent)",
                          color: "var(--admin-accent-contrast)",
                        }
                      : undefined
                  }
                  type="button"
                >
                  {CATEGORY_LABELS[category]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!historyQuery.isError && !historyQuery.isLoading && filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d9d9d9] bg-white p-10 text-center dark:border-white/10 dark:bg-[#1a1a1a]">
          <div className="text-3xl">🧾</div>
          <div className="mt-3 text-lg font-black text-[#111] dark:text-[#f5f5f5]">
            No hay resultados para ese filtro
          </div>
          <div className="mt-2 text-sm text-[#666] dark:text-white/60">
            Probá con otra categoría o un texto de búsqueda más general.
          </div>
        </div>
      ) : null}

      {filteredEntries.length > 0 ? (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <article
              className="rounded-xl border border-[#e8e8e8] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[#1a1a1a]"
              key={entry.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]"
                      style={{
                        backgroundColor: "var(--admin-accent-soft)",
                        color: "var(--admin-accent)",
                      }}
                    >
                      {entry.presentation.categoryLabel}
                    </span>
                    <div className="text-sm font-black text-[#111] dark:text-[#f5f5f5]">
                      {entry.presentation.title}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-[#444] dark:text-white/75">
                    {entry.presentation.description}
                  </div>
                </div>
                <div className="rounded-full bg-[#f4f4f5] px-3 py-1 text-xs font-bold text-[#444] dark:bg-white/10 dark:text-white/70">
                  {formatTimestamp(entry.at)}
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#888]">
                    Quién lo hizo
                  </div>
                  <div className="mt-1 text-[#222] dark:text-[#f5f5f5]">
                    {entry.actorName ?? "Sistema"}
                  </div>
                  <div className="text-xs text-[#666] dark:text-white/60">
                    {entry.actorEmail ?? "Sin usuario asociado"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#888]">
                    Motivo
                  </div>
                  <div className="mt-1 text-[#222] dark:text-[#f5f5f5]">
                    {entry.reason ?? "Sin motivo informado"}
                  </div>
                </div>
              </div>

              {entry.presentation.details.length ? (
                <div className="mt-3 rounded-lg bg-[#f7f7f8] p-3 dark:bg-[#111]">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#888]">
                    Detalles
                  </div>
                  <div className="grid gap-1 text-xs text-[#444] dark:text-white/70">
                    {entry.presentation.details.map((detail) => (
                      <div key={`${entry.id}-${detail}`}>{detail}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}
