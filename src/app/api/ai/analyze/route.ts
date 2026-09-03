import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { aiErrorResponse } from "@/lib/ai/error-response";
import type { Ad, AIAnalysis, Campaign, Client, DateRange, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, combineAccountMetrics } from "@/lib/utils/metrics";

interface AnalyzeRequestBody {
  clientId: string;
  dateRange: DateRange;
  question?: string;
}

interface GatheredData {
  client: Client;
  campaigns: Campaign[];
  ads: Ad[];
  campaignMetrics: Record<string, PerformanceMetrics>;
  adMetrics: Record<string, PerformanceMetrics>;
  currentMetrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
}

const META_ACCOUNT_COLOR = "#1877F2";

/** Campañas + anuncios + métricas del periodo de la cuenta, todo vía `lib/meta/real/`. */
async function gatherAccountData(accountId: string, dateRange: DateRange): Promise<GatheredData> {
  const previousRange = getPreviousPeriod(dateRange);

  const [accounts, campaigns] = await Promise.all([fetchAdAccounts(), fetchRealCampaigns(accountId)]);
  const account = accounts.find((a) => a.id === accountId);
  const client: Client = {
    id: accountId,
    name: account?.name ?? accountId,
    slug: accountId,
    industry: "Cuenta de Meta Ads",
    initials: (account?.name ?? "MA").slice(0, 2).toUpperCase(),
    accentColor: META_ACCOUNT_COLOR,
    adAccountId: accountId,
  };

  // Sin campañas: no tiene sentido pedir insights ni anuncios — se corta aquí (ver ruta principal).
  if (campaigns.length === 0) {
    return {
      client,
      campaigns: [],
      ads: [],
      campaignMetrics: {},
      adMetrics: {},
      currentMetrics: aggregateMetrics([]),
      previousMetrics: aggregateMetrics([]),
    };
  }

  const [currentInsights, previousInsights] = await Promise.all([
    fetchAggregatedInsightsByEntity(accountId, "campaign", dateRange.from, dateRange.to),
    fetchAggregatedInsightsByEntity(accountId, "campaign", previousRange.from, previousRange.to),
  ]);

  const campaignMetrics: Record<string, PerformanceMetrics> = {};
  const previousCampaignMetrics: PerformanceMetrics[] = [];
  for (const campaign of campaigns) {
    const currentRow = currentInsights.get(campaign.id);
    campaignMetrics[campaign.id] = aggregateMetrics(
      currentRow ? [mapInsightsRowToDailyMetrics(currentRow, campaign.id, "campaign", campaign.objective, dateRange.from)] : []
    );
    const previousRow = previousInsights.get(campaign.id);
    previousCampaignMetrics.push(
      aggregateMetrics(
        previousRow
          ? [mapInsightsRowToDailyMetrics(previousRow, campaign.id, "campaign", campaign.objective, previousRange.from)]
          : []
      )
    );
  }

  const currentMetrics = combineAccountMetrics(Object.values(campaignMetrics));

  // Sin gasto ni impresiones en el rango: tampoco hay nada real que analizar (ver ruta principal).
  if (currentMetrics.spend === 0 && currentMetrics.impressions === 0) {
    return {
      client,
      campaigns,
      ads: [],
      campaignMetrics,
      adMetrics: {},
      currentMetrics,
      previousMetrics: combineAccountMetrics(previousCampaignMetrics),
    };
  }

  const [ads, adInsights] = await Promise.all([
    fetchRealAds(accountId),
    fetchAggregatedInsightsByEntity(accountId, "ad", dateRange.from, dateRange.to),
  ]);

  const adMetrics: Record<string, PerformanceMetrics> = {};
  for (const ad of ads) {
    const row = adInsights.get(ad.id);
    adMetrics[ad.id] = aggregateMetrics(
      row ? [mapInsightsRowToDailyMetrics(row, ad.id, "ad", ad.campaignObjective, dateRange.from)] : []
    );
  }

  return {
    client,
    campaigns,
    ads,
    campaignMetrics,
    adMetrics,
    currentMetrics,
    previousMetrics: combineAccountMetrics(previousCampaignMetrics),
  };
}

function noDataAnalysis(): AIAnalysis {
  return {
    summary:
      "No hay datos publicitarios en esta cuenta para el periodo seleccionado — no encontré campañas con actividad que analizar. Prueba a ampliar el rango de fechas o a seleccionar otra cuenta.",
    issues: [],
    opportunities: [],
    recommendations: [],
    priority: "low",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Backend del "AI Performance Analyst".
 *
 * El frontend nunca llama a Anthropic directamente: envía aquí la cuenta, el
 * rango de fechas y (opcionalmente) una pregunta. Este endpoint reúne
 * campañas, anuncios y métricas exclusivamente de Meta Marketing API
 * (`lib/meta/real/`) y se los pasa a `getAIAnalystService()` (Claude).
 *
 * Claude solo recibe métricas reales: no existe ninguna fuente simulada. Si
 * no hay campañas ni gasto/impresiones en el periodo, se devuelve un estado
 * vacío explícito sin llamar a Anthropic en absoluto.
 */
export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { clientId, dateRange, question } = body;
  if (!clientId || !dateRange?.from || !dateRange?.to) {
    return NextResponse.json({ error: "clientId y dateRange son obligatorios" }, { status: 400 });
  }

  let data: GatheredData;
  try {
    data = await gatherAccountData(clientId, dateRange);
  } catch (err) {
    return metaErrorResponse(err);
  }

  if (data.campaigns.length === 0 || (data.currentMetrics.spend === 0 && data.currentMetrics.impressions === 0)) {
    return NextResponse.json(noDataAnalysis());
  }

  try {
    const analysis = await getAIAnalystService().analyze({
      client: data.client,
      dateRange,
      campaigns: data.campaigns,
      adSets: [],
      ads: data.ads,
      currentMetrics: data.currentMetrics,
      previousMetrics: data.previousMetrics,
      campaignMetrics: data.campaignMetrics,
      adMetrics: data.adMetrics,
      question,
    });
    return NextResponse.json(analysis);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
