"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DateRangePreset } from "@/lib/types";
import { getPreviousPeriod, resolveDateRange } from "@/lib/utils/dates";
import { MOCK_CLIENTS } from "@/lib/mock/entities";

interface FiltersContextValue {
  clientId: string;
  setClientId: (id: string) => void;
  dateRangePreset: DateRangePreset;
  setDateRangePreset: (preset: DateRangePreset) => void;
  dateRange: { from: string; to: string };
  previousDateRange: { from: string; to: string };
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

const STORAGE_KEY = "anlux_filters";

interface StoredFilters {
  clientId?: string;
  dateRangePreset?: DateRangePreset;
}

/** Solo se llama en el lazy initializer de useState: nunca durante SSR. */
function readStoredFilters(): StoredFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredFilters) : {};
  } catch {
    return {};
  }
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientId] = useState<string>(() => {
    const stored = readStoredFilters().clientId;
    return stored && MOCK_CLIENTS.some((c) => c.id === stored) ? stored : MOCK_CLIENTS[0].id;
  });
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    () => readStoredFilters().dateRangePreset ?? "last30"
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ clientId, dateRangePreset }));
    } catch {
      // Ignorar: la persistencia de filtros es una comodidad, no un requisito.
    }
  }, [clientId, dateRangePreset]);

  const value = useMemo<FiltersContextValue>(() => {
    const dateRange = resolveDateRange(dateRangePreset);
    return {
      clientId,
      setClientId,
      dateRangePreset,
      setDateRangePreset,
      dateRange,
      previousDateRange: getPreviousPeriod(dateRange),
    };
  }, [clientId, dateRangePreset]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters debe usarse dentro de <FiltersProvider>");
  return ctx;
}
