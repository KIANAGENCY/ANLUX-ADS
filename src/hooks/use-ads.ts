"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { Ad, AdSet, Campaign, PerformanceMetrics } from "@/lib/types";
import { aggregateMetrics } from "@/lib/utils/metrics";

export interface AdWithMetrics extends Ad {
  campaignName: string;
  adSetName: string;
  metrics: PerformanceMetrics;
}

interface Result {
  key: string;
  ads: AdWithMetrics[];
}

export function useAds(): { loading: boolean; ads: AdWithMetrics[] } {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const service = getMetaAdsService();
      const [ads, adSets, campaigns] = await Promise.all([
        service.getAds(clientId),
        service.getAdSets(clientId),
        service.getCampaigns(clientId),
      ]);
      const adSetsById = new Map<string, AdSet>(adSets.map((a) => [a.id, a]));
      const campaignsById = new Map<string, Campaign>(campaigns.map((c) => [c.id, c]));

      const withMetrics = await Promise.all(
        ads.map(async (ad) => {
          const rows = await service.getDailyMetrics("ad", ad.id, dateRange);
          return {
            ...ad,
            campaignName: campaignsById.get(ad.campaignId)?.name ?? "—",
            adSetName: adSetsById.get(ad.adSetId)?.name ?? "—",
            metrics: aggregateMetrics(rows),
          };
        })
      );
      if (cancelled) return;
      setResult({ key, ads: withMetrics });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, dateRange.from, dateRange.to]);

  return { loading: result?.key !== key, ads: result?.ads ?? [] };
}
