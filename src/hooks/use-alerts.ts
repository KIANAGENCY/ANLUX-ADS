"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { PerformanceAlert } from "@/lib/types";

interface Result {
  key: string;
  alerts: PerformanceAlert[];
  error: string | null;
}

async function load(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, alerts: [], error: null };
  try {
    const res = await fetch(`/api/meta/alerts?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las alertas.");
    return { key, alerts: data.alerts ?? [], error: null };
  } catch (err) {
    return { key, alerts: [], error: err instanceof Error ? err.message : "Error al obtener alertas de Meta." };
  }
}

export function useAlerts(): { loading: boolean; alerts: PerformanceAlert[]; error: string | null } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

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
    alerts: result?.alerts ?? [],
    error: result?.key === key ? result.error : null,
  };
}
