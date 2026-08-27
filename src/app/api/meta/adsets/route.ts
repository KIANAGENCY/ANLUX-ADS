import { NextRequest, NextResponse } from "next/server";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { aggregateMetrics } from "@/lib/utils/metrics";

/** Conjuntos de anuncios reales de la cuenta + sus métricas agregadas para el rango dado. */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  try {
    const [adSets, insightsByAdSet] = await Promise.all([
      fetchRealAdSets(accountId),
      fetchAggregatedInsightsByEntity(accountId, "adset", from, to),
    ]);

    const adSetsWithMetrics = adSets.map(({ campaignObjective, ...adSet }) => {
      const row = insightsByAdSet.get(adSet.id);
      const dailyRow = row ? mapInsightsRowToDailyMetrics(row, adSet.id, "adset", campaignObjective, from) : null;
      return { ...adSet, metrics: aggregateMetrics(dailyRow ? [dailyRow] : []) };
    });

    return NextResponse.json({ adSets: adSetsWithMetrics });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
