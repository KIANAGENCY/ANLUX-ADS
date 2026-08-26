"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { AdSet, Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

export interface AdSetWithMetrics extends AdSet {
  campaignName: string;
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  adSets: AdSetWithMetrics[];
}

export function useAdSets(): { loading: boolean; adSets: AdSetWithMetrics[] } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const service = getMetaAdsService();
      const [adSets, campaigns] = await Promise.all([service.getAdSets(clientId), service.getCampaigns(clientId)]);
      const campaignsById = new Map<string, Campaign>(campaigns.map((c) => [c.id, c]));

      const withMetrics = await Promise.all(
        adSets.map(async (adSet) => {
          const rows = await service.getDailyMetrics("adset", adSet.id, dateRange);
          return {
            ...adSet,
            campaignName: campaignsById.get(adSet.campaignId)?.name ?? "—",
            metrics: aggregateMetrics(rows),
          };
        })
      );
      if (cancelled) return;
      setResult({ key, adSets: withMetrics });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to]);

  return { loading: result?.key !== key, adSets: result?.adSets ?? [] };
}
