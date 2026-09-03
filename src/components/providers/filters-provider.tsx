"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DateRangePreset, MetaAdAccountSummary } from "@/lib/types";
import { getPreviousPeriod, resolveDateRange } from "@/lib/utils/dates";

interface FiltersContextValue {
  /**
   * Cuenta publicitaria de Meta seleccionada ("act_XXXXXXXXXX"). Cadena vacía
   * mientras se descubren las cuentas o si el token no da acceso a ninguna.
   */
  clientId: string;
  setClientId: (id: string) => void;
  dateRangePreset: DateRangePreset;
  setDateRangePreset: (preset: DateRangePreset) => void;
  dateRange: { from: string; to: string };
  previousDateRange: { from: string; to: string };
  /** Cuentas reales descubiertas vía /api/meta/accounts. */
  realAccounts: MetaAdAccountSummary[];
  realAccountsLoading: boolean;
  /** Mensaje de error de /api/meta/accounts, o `null` si la llamada fue bien. */
  realAccountsError: string | null;
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
  const [selectedId, setSelectedId] = useState<string>(() => readStoredFilters().clientId ?? "");
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    () => readStoredFilters().dateRangePreset ?? "last30"
  );
  const [realAccounts, setRealAccounts] = useState<MetaAdAccountSummary[]>([]);
  const [realAccountsLoading, setRealAccountsLoading] = useState(true);
  const [realAccountsError, setRealAccountsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/meta/accounts")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : "No se pudieron obtener las cuentas de Meta."
          );
        }
        return data as { accounts?: MetaAdAccountSummary[] };
      })
      .then((data) => {
        if (cancelled) return;
        setRealAccounts(data.accounts ?? []);
        setRealAccountsError(null);
      })
      .catch((err: unknown) => {
        // El error se expone al contexto: sin cuentas no hay datos que mostrar,
        // y el usuario debe ver por qué (token ausente, inválido, sin permisos...).
        if (cancelled) return;
        setRealAccounts([]);
        setRealAccountsError(
          err instanceof Error ? err.message : "No se pudieron obtener las cuentas de Meta."
        );
      })
      .finally(() => {
        if (!cancelled) setRealAccountsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Cuenta efectiva: la última seleccionada si sigue siendo accesible con el
   * token actual; si no, la primera cuenta real disponible. Se deriva en vez
   * de sincronizarse con un efecto para que nunca quede apuntando a una cuenta
   * que ya no existe.
   */
  const clientId = useMemo(() => {
    if (selectedId && realAccounts.some((a) => a.id === selectedId)) return selectedId;
    return realAccounts[0]?.id ?? "";
  }, [selectedId, realAccounts]);

  useEffect(() => {
    if (!clientId) return;
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
      setClientId: setSelectedId,
      dateRangePreset,
      setDateRangePreset,
      dateRange,
      previousDateRange: getPreviousPeriod(dateRange),
      realAccounts,
      realAccountsLoading,
      realAccountsError,
    };
  }, [clientId, dateRangePreset, realAccounts, realAccountsLoading, realAccountsError]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters debe usarse dentro de <FiltersProvider>");
  return ctx;
}
