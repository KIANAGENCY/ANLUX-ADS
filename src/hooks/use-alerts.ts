"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { generateMockAlerts } from "@/lib/alerts/engine";
import type { PerformanceAlert } from "@/lib/types";

interface Result {
  key: string;
  alerts: PerformanceAlert[];
  error: string | null;
}

async function loadReal(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  try {
    const res = await fetch(`/api/meta/alerts?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las alertas.");
    return { key, alerts: data.alerts ?? [], error: null };
  } catch (err) {
    return { key, alerts: [], error: err instanceof Error ? err.message : "Error al obtener alertas reales." };
  }
}

async function loadMock(clientId: string, dateRange: { from: string; to: string }): Promise<Result> {
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const alerts = await generateMockAlerts(clientId, dateRange);
  return { key, alerts, error: null };
}

export function useAlerts(): { loading: boolean; alerts: PerformanceAlert[]; error: string | null } {
  const { clientId, dateRange, isRealAccount } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    const promise = isRealAccount ? loadReal(clientId, dateRange.from, dateRange.to) : loadMock(clientId, dateRange);

    promise.then((r) => {
      if (!cancelled) setResult(r);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to, isRealAccount]);

  return {
    loading: result?.key !== key,
    alerts: result?.alerts ?? [],
    error: result?.key === key ? result.error : null,
  };
}
