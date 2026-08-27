import { NextRequest, NextResponse } from "next/server";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { aggregateMetrics } from "@/lib/utils/metrics";

/** Anuncios reales de la cuenta + sus métricas agregadas para el rango dado. */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  try {
    const [ads, insightsByAd] = await Promise.all([
      fetchRealAds(accountId),
      fetchAggregatedInsightsByEntity(accountId, "ad", from, to),
    ]);

    const adsWithMetrics = ads.map(({ campaignObjective, ...ad }) => {
      const row = insightsByAd.get(ad.id);
      const dailyRow = row ? mapInsightsRowToDailyMetrics(row, ad.id, "ad", campaignObjective, from) : null;
      return { ...ad, metrics: aggregateMetrics(dailyRow ? [dailyRow] : []) };
    });

    return NextResponse.json({ ads: adsWithMetrics });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
