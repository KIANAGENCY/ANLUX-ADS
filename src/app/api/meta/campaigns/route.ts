import { NextRequest, NextResponse } from "next/server";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { parseAccountRangeParams } from "@/lib/meta/real/request-params";
import { aggregateMetrics } from "@/lib/utils/metrics";

/** Campañas reales de la cuenta + sus métricas agregadas para el rango dado. */
export async function GET(req: NextRequest) {
  const parsed = parseAccountRangeParams(req.nextUrl.searchParams);
  if (!parsed.ok) return parsed.response;
  const { accountId, from, to } = parsed.params;

  try {
    const [campaigns, insightsByCampaign] = await Promise.all([
      fetchRealCampaigns(accountId),
      fetchAggregatedInsightsByEntity(accountId, "campaign", from, to),
    ]);

    const campaignsWithMetrics = campaigns.map((campaign) => {
      const row = insightsByCampaign.get(campaign.id);
      const dailyRow = row
        ? mapInsightsRowToDailyMetrics(row, campaign.id, "campaign", campaign.objective, from)
        : null;
      return { ...campaign, metrics: aggregateMetrics(dailyRow ? [dailyRow] : []) };
    });

    return NextResponse.json({ campaigns: campaignsWithMetrics });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
