import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { getMetaAdsService } from "@/lib/meta";
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

/** Cuenta real de Meta: campañas + anuncios + métricas del periodo, todo vía `lib/meta/real/`. */
async function gatherRealData(accountId: string, dateRange: DateRange): Promise<GatheredData> {
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

/** Cliente demo: exactamente el mismo camino que antes, contra el servicio mock. */
async function gatherMockData(clientId: string, dateRange: DateRange): Promise<GatheredData | null> {
  const metaService = getMetaAdsService();
  const client = await metaService.getClient(clientId);
  if (!client) return null;

  const previousRange = getPreviousPeriod(dateRange);
  const [campaigns, ads] = await Promise.all([metaService.getCampaigns(clientId), metaService.getAds(clientId)]);

  const campaignMetrics: Record<string, PerformanceMetrics> = {};
  const previousCampaignMetrics: PerformanceMetrics[] = [];
  await Promise.all(
    campaigns.map(async (c) => {
      const [rows, previousRows] = await Promise.all([
        metaService.getDailyMetrics("campaign", c.id, dateRange),
        metaService.getDailyMetrics("campaign", c.id, previousRange),
      ]);
      campaignMetrics[c.id] = aggregateMetrics(rows);
      previousCampaignMetrics.push(aggregateMetrics(previousRows));
    })
  );

  const adMetrics: Record<string, PerformanceMetrics> = {};
  await Promise.all(
    ads.map(async (a) => {
      const rows = await metaService.getDailyMetrics("ad", a.id, dateRange);
      adMetrics[a.id] = aggregateMetrics(rows);
    })
  );

  return {
    client,
    campaigns,
    ads,
    campaignMetrics,
    adMetrics,
    currentMetrics: combineAccountMetrics(Object.values(campaignMetrics)),
    previousMetrics: combineAccountMetrics(previousCampaignMetrics),
  };
}

function noDataAnalysis(): AIAnalysis {
  return {
    summary:
      "No hay suficientes datos publicitarios en esta cuenta para el periodo seleccionado — no encontré campañas con actividad para analizar. Prueba a ampliar el rango de fechas, o selecciona un cliente demo (Orthobasic / Hotel Expert) para explorar el AI Analyst con datos simulados.",
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
 * El frontend nunca llama a Anthropic directamente: envía aquí el cliente,
 * el rango de fechas y (opcionalmente) una pregunta. Este endpoint reúne
 * campañas, anuncios y métricas — de Meta real (`lib/meta/real/`) si
 * `clientId` es una cuenta real (prefijo "act_"), o del servicio mock si es
 * un cliente demo — y se los pasa a `getAIAnalystService()`, que hoy es
 * Claude (Sonnet 5) si `ANTHROPIC_API_KEY` está configurada, o el analista
 * simulado si no.
 *
 * Si no hay campañas ni gasto/impresiones en el periodo (solo puede pasar
 * con cuentas reales — los clientes demo siempre tienen datos), se devuelve
 * un estado vacío claro sin llamar a Anthropic en absoluto.
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

  const isRealAccount = clientId.startsWith("act_");

  let data: GatheredData | null;
  try {
    data = isRealAccount ? await gatherRealData(clientId, dateRange) : await gatherMockData(clientId, dateRange);
  } catch (err) {
    return metaErrorResponse(err);
  }

  if (!data) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
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
