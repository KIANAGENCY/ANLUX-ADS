"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { DecisionEngineResult } from "@/lib/decisions/types";

interface State {
  key: string;
  result: DecisionEngineResult | null;
  error: string | null;
}

async function load(accountId: string, from: string, to: string): Promise<State> {
  const key = `${accountId}|${from}|${to}`;
  if (!accountId) return { key, result: null, error: null };

  try {
    const response = await fetch(
      `/api/meta/decisions?accountId=${encodeURIComponent(accountId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cache: "no-store" }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "No se pudieron calcular las decisiones.");
    return { key, result: data as DecisionEngineResult, error: null };
  } catch (err) {
    return {
      key,
      result: null,
      error: err instanceof Error ? err.message : "Error al calcular decisiones de Meta.",
    };
  }
}

export function useDecisions(): {
  loading: boolean;
  result: DecisionEngineResult | null;
  error: string | null;
} {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(clientId, dateRange.from, dateRange.to).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, dateRange.from, dateRange.to]);

  return {
    loading: state?.key !== key,
    result: state?.key === key ? state.result : null,
    error: state?.key === key ? state.error : null,
  };
}
