export function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

export function formatTimeWindow(
  opensAt: string | null,
  closesAt: string | null,
) {
  if (!opensAt || !closesAt) {
    return "Sin horario cargado";
  }

  return `${opensAt.slice(0, 5)} a ${closesAt.slice(0, 5)}`;
}

export function formatWeekday(weekday: number) {
  const names = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ] as const;

  return names[weekday] ?? "Día";
}
