"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { getMetaAdsService } from "@/lib/meta";
import type { AdSet, Campaign, DailyMetrics, MetricComparison } from "@/lib/types";
import { aggregateMetrics, compareMetrics } from "@/lib/utils/metrics";

export interface AdSetSummary extends AdSet {
  metrics: ReturnType<typeof aggregateMetrics>;
}

interface Result {
  key: string;
  campaign: Campaign | null;
  comparison: MetricComparison | null;
  dailyRows: DailyMetrics[];
  adSets: AdSetSummary[];
}

interface CampaignDetailState {
  loading: boolean;
  campaign: Campaign | null;
  comparison: MetricComparison | null;
  dailyRows: DailyMetrics[];
  adSets: AdSetSummary[];
}

export function useCampaignDetail(campaignId: string): CampaignDetailState {
  const { dateRange, previousDateRange } = useFilters();
  const key = `${campaignId}|${dateRange.from}|${dateRange.to}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const service = getMetaAdsService();
      const campaign = await service.getCampaign(campaignId);
      if (!campaign) {
        if (!cancelled) setResult({ key, campaign: null, comparison: null, dailyRows: [], adSets: [] });
        return;
      }

      const [currentRows, previousRows, allAdSets] = await Promise.all([
        service.getDailyMetrics("campaign", campaignId, dateRange),
        service.getDailyMetrics("campaign", campaignId, previousDateRange),
        service.getAdSetsByCampaign(campaignId),
      ]);

      const adSetsWithMetrics = await Promise.all(
        allAdSets.map(async (adSet) => {
          const rows = await service.getDailyMetrics("adset", adSet.id, dateRange);
          return { ...adSet, metrics: aggregateMetrics(rows) };
        })
      );

      if (cancelled) return;
      setResult({
        key,
        campaign,
        comparison: compareMetrics(aggregateMetrics(currentRows), aggregateMetrics(previousRows)),
        dailyRows: currentRows,
        adSets: adSetsWithMetrics,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, dateRange.from, dateRange.to, previousDateRange.from, previousDateRange.to]);

  return {
    loading: result?.key !== key,
    campaign: result?.campaign ?? null,
    comparison: result?.comparison ?? null,
    dailyRows: result?.dailyRows ?? [],
    adSets: result?.adSets ?? [],
  };
}
