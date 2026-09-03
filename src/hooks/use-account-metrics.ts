"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { DailyMetrics, MetricComparison } from "@/lib/types";
import { aggregateMetrics, compareMetrics } from "@/lib/utils/metrics";

interface AccountMetricsResult {
  key: string;
  comparison: MetricComparison;
  dailyRows: DailyMetrics[];
  error: string | null;
}

interface AccountMetricsState {
  loading: boolean;
  comparison: MetricComparison | null;
  dailyRows: DailyMetrics[];
  error: string | null;
}

/** Comparación vacía: todas las métricas a 0, sin variación. */
function emptyComparison(): MetricComparison {
  return compareMetrics(aggregateMetrics([]), aggregateMetrics([]));
}

async function load(accountId: string, from: string, to: string): Promise<AccountMetricsResult> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, comparison: emptyComparison(), dailyRows: [], error: null };
  try {
    const res = await fetch(`/api/meta/overview?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las métricas de la cuenta.");
    return { key, comparison: data.comparison, dailyRows: data.dailyRows ?? [], error: null };
  } catch (err) {
    return {
      key,
      comparison: emptyComparison(),
      dailyRows: [],
      error: err instanceof Error ? err.message : "Error al obtener métricas de Meta.",
    };
  }
}

/** Métricas de cuenta (periodo actual + anterior) de la cuenta de Meta seleccionada. */
export function useAccountMetrics(): AccountMetricsState {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<AccountMetricsResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    load(clientId, dateRange.from, dateRange.to).then((r) => {
      if (!cancelled) setResult(r);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, dateRange.from, dateRange.to]);

  return {
    loading: result?.key !== key,
    comparison: result?.comparison ?? null,
    dailyRows: result?.dailyRows ?? [],
    error: result?.key === key ? result.error : null,
  };
}
