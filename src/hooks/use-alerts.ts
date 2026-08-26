"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { generateAlerts } from "@/lib/alerts/engine";
import type { PerformanceAlert } from "@/lib/types";

interface Result {
  key: string;
  alerts: PerformanceAlert[];
}

export function useAlerts(): { loading: boolean; alerts: PerformanceAlert[] } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    generateAlerts(clientId, dateRange).then((alerts) => {
      if (!cancelled) setResult({ key, alerts });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to]);

  return { loading: result?.key !== key, alerts: result?.alerts ?? [] };
}
