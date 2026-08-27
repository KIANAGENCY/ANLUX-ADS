"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

export interface CampaignWithMetrics extends Campaign {
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  campaigns: CampaignWithMetrics[];
  error: string | null;
}

async function loadReal(accountId: string, from: string, to: string): Promise<Result> {
  const key = `${accountId}|${from}|${to}`;
  try {
    const res = await fetch(`/api/meta/campaigns?accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener las campañas.");
    return { key, campaigns: data.campaigns ?? [], error: null };
  } catch (err) {
    return { key, campaigns: [], error: err instanceof Error ? err.message : "Error al obtener campañas reales." };
  }
}

async function loadMock(clientId: string, dateRange: { from: string; to: string }): Promise<Result> {
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const service = getMetaAdsService();
  const campaigns = await service.getCampaigns(clientId);
  const withMetrics = await Promise.all(
    campaigns.map(async (campaign) => {
      const rows = await service.getDailyMetrics("campaign", campaign.id, dateRange);
      return { ...campaign, metrics: aggregateMetrics(rows) };
    })
  );
  return { key, campaigns: withMetrics, error: null };
}

export function useCampaigns(): { loading: boolean; campaigns: CampaignWithMetrics[]; error: string | null } {
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
    campaigns: result?.campaigns ?? [],
    error: result?.key === key ? result.error : null,
  };
}
