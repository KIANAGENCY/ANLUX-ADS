import type { DateRange, DateRangePreset } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/** Referencia "hoy" para todos los cálculos de mock, fijada a medianoche UTC. */
export function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoy",
  last7: "Últimos 7 días",
  last14: "Últimos 14 días",
  last30: "Últimos 30 días",
  thisMonth: "Este mes",
  lastMonth: "Mes anterior",
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "today",
  "last7",
  "last14",
  "last30",
  "thisMonth",
  "lastMonth",
];

/** Resuelve un preset a un rango de fechas concreto (inclusive por ambos extremos). */
export function resolveDateRange(preset: DateRangePreset, today: Date = getToday()): DateRange {
  switch (preset) {
    case "today":
      return { from: toISODate(today), to: toISODate(today) };
    case "last7":
      return { from: toISODate(addDays(today, -6)), to: toISODate(today) };
    case "last14":
      return { from: toISODate(addDays(today, -13)), to: toISODate(today) };
    case "last30":
      return { from: toISODate(addDays(today, -29)), to: toISODate(today) };
    case "thisMonth":
      return { from: toISODate(startOfMonth(today)), to: toISODate(today) };
    case "lastMonth": {
      const lastMonthAnchor = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)
      );
      return {
        from: toISODate(startOfMonth(lastMonthAnchor)),
        to: toISODate(endOfMonth(lastMonthAnchor)),
      };
    }
  }
}

function daysBetweenInclusive(range: DateRange): number {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/**
 * Calcula el rango anterior "equivalente" (misma duración, inmediatamente
 * antes del rango actual) para poder comparar variaciones porcentuales.
 */
export function getPreviousPeriod(range: DateRange): DateRange {
  const span = daysBetweenInclusive(range);
  const from = new Date(range.from);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, -(span - 1));
  return { from: toISODate(previousFrom), to: toISODate(previousTo) };
}

export function enumerateDates(range: DateRange): string[] {
  const dates: string[] = [];
  let cursor = new Date(range.from);
  const end = new Date(range.to);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatDateShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export function formatDateLong(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
