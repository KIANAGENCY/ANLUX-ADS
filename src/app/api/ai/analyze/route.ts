import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { buildRealAlertsFromMetrics } from "@/lib/alerts/real-engine";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { fetchAccountDailyMetrics } from "@/lib/meta/real/overview";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { aiErrorResponse } from "@/lib/ai/error-response";
import type { Ad, AdSet, AIAnalysis, Campaign, Client, DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics } from "@/lib/utils/metrics";

/** Modos del AI Analyst. Los envía el frontend explícitamente; el servidor los valida. */
const ANALYSIS_MODES = ["general", "performance"] as const;
type AnalysisMode = (typeof ANALYSIS_MODES)[number];

function isAnalysisMode(value: unknown): value is AnalysisMode {
  return typeof value === "string" && (ANALYSIS_MODES as readonly string[]).includes(value);
}

interface AnalyzeRequestBody {
  /**
   * Modo explícito de la consulta. Es el contrato: el servidor no lo infiere
   * de la presencia de otros campos ni del texto de la pregunta.
   */
  mode?: string;
  clientId?: string;
  dateRange?: DateRange;
  question?: string;
}

interface GatheredData {
  client: Client;
  currency: string | null;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  campaignMetrics: Record<string, PerformanceMetrics>;
  adSetMetrics: Record<string, PerformanceMetrics>;
  adMetrics: Record<string, PerformanceMetrics>;
  currentMetrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
}

const META_ACCOUNT_COLOR = "#1877F2";

/**
 * Reúne datos reales para el AI Analyst.
 *
 * Los KPIs de CUENTA se obtienen de insights `level=account`, donde Meta ya
 * deduplica reach correctamente. No se aproximan sumando reach de campañas.
 * Los resultados se interpretan por objetivo mediante `fetchAccountDailyMetrics`.
 */
async function gatherAccountData(accountId: string, dateRange: DateRange): Promise<GatheredData> {
  const previousRange = getPreviousPeriod(dateRange);

  const [accounts, campaigns] = await Promise.all([fetchAdAccounts(), fetchRealCampaigns(accountId)]);
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? null;
  const client: Client = {
    id: accountId,
    name: account?.name ?? accountId,
    slug: accountId,
    industry: "Cuenta de Meta Ads",
    initials: (account?.name ?? "MA").slice(0, 2).toUpperCase(),
    accentColor: META_ACCOUNT_COLOR,
    adAccountId: accountId,
  };

  if (campaigns.length === 0) {
    return {
      client,
      currency,
      campaigns: [],
      adSets: [],
      ads: [],
      campaignMetrics: {},
      adSetMetrics: {},
      adMetrics: {},
      currentMetrics: aggregateMetrics([]),
      previousMetrics: aggregateMetrics([]),
      alerts: [],
    };
  }

  const [currentInsights, previousInsights, currentAccountRows, previousAccountRows] = await Promise.all([
    fetchAggregatedInsightsByEntity(accountId, "campaign", dateRange.from, dateRange.to),
    fetchAggregatedInsightsByEntity(accountId, "campaign", previousRange.from, previousRange.to),
    fetchAccountDailyMetrics(accountId, dateRange.from, dateRange.to),
    fetchAccountDailyMetrics(accountId, previousRange.from, previousRange.to),
  ]);

  const campaignMetrics: Record<string, PerformanceMetrics> = {};
  const previousCampaignMetrics: Record<string, PerformanceMetrics> = {};
  for (const campaign of campaigns) {
    const currentRow = currentInsights.get(campaign.id);
    campaignMetrics[campaign.id] = aggregateMetrics(
      currentRow ? [mapInsightsRowToDailyMetrics(currentRow, campaign.id, "campaign", campaign.objective, dateRange.from)] : []
    );
    const previousRow = previousInsights.get(campaign.id);
    previousCampaignMetrics[campaign.id] = aggregateMetrics(
      previousRow
        ? [mapInsightsRowToDailyMetrics(previousRow, campaign.id, "campaign", campaign.objective, previousRange.from)]
        : []
    );
  }

  // Fuente canónica para KPIs de cuenta: Meta level=account, no una suma aproximada de campañas.
  const currentMetrics = aggregateMetrics(currentAccountRows);
  const previousMetrics = aggregateMetrics(previousAccountRows);

  if (currentMetrics.spend === 0 && currentMetrics.impressions === 0) {
    return {
      client,
      currency,
      campaigns,
      adSets: [],
      ads: [],
      campaignMetrics,
      adSetMetrics: {},
      adMetrics: {},
      currentMetrics,
      previousMetrics,
      alerts: [],
    };
  }

  const [adSets, adSetInsights, ads, adInsights] = await Promise.all([
    fetchRealAdSets(accountId),
    fetchAggregatedInsightsByEntity(accountId, "adset", dateRange.from, dateRange.to),
    fetchRealAds(accountId),
    fetchAggregatedInsightsByEntity(accountId, "ad", dateRange.from, dateRange.to),
  ]);

  const adSetMetrics: Record<string, PerformanceMetrics> = {};
  for (const adSet of adSets) {
    const row = adSetInsights.get(adSet.id);
    adSetMetrics[adSet.id] = aggregateMetrics(
      row ? [mapInsightsRowToDailyMetrics(row, adSet.id, "adset", adSet.campaignObjective, dateRange.from)] : []
    );
  }

  const adMetrics: Record<string, PerformanceMetrics> = {};
  for (const ad of ads) {
    const row = adInsights.get(ad.id);
    adMetrics[ad.id] = aggregateMetrics(
      row ? [mapInsightsRowToDailyMetrics(row, ad.id, "ad", ad.campaignObjective, dateRange.from)] : []
    );
  }

  const alerts = buildRealAlertsFromMetrics({
    campaigns,
    currentCampaignMetrics: campaignMetrics,
    previousCampaignMetrics,
    adSets,
    adSetMetrics,
    currency,
  });

  return {
    client,
    currency,
    campaigns,
    adSets,
    ads,
    campaignMetrics,
    adSetMetrics,
    adMetrics,
    currentMetrics,
    previousMetrics,
    alerts,
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
 * El modo llega explícito y se valida aquí:
 * - general: no consulta Meta; responde estrategia sin inventar métricas.
 * - performance: exige cuenta y periodo y reúne exclusivamente datos reales.
 *
 * El proveedor solo recibe métricas reales. Si no hay actividad, se devuelve
 * un estado vacío explícito sin llamar al proveedor de IA.
 */
export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { mode, clientId, dateRange, question } = body;

  if (!isAnalysisMode(mode)) {
    return NextResponse.json(
      { error: `El modo de consulta es obligatorio y debe ser uno de: ${ANALYSIS_MODES.join(", ")}.` },
      { status: 400 }
    );
  }

  if (mode === "general") {
    const generalQuestion = question?.trim();
    if (!generalQuestion) {
      return NextResponse.json(
        { error: "Escribe una pregunta para la consulta estratégica." },
        { status: 400 }
      );
    }

    try {
      const analysis = await getAIAnalystService().analyze({
        mode: "general",
        question: generalQuestion,
      });
      return NextResponse.json(analysis);
    } catch (err) {
      return aiErrorResponse(err);
    }
  }

  const accountId = clientId?.trim();
  if (!accountId) {
    return NextResponse.json(
      { error: "Selecciona una cuenta de Meta para analizar su rendimiento." },
      { status: 400 }
    );
  }
  if (!dateRange?.from || !dateRange?.to) {
    return NextResponse.json(
      { error: "Selecciona un periodo para analizar el rendimiento de esta cuenta." },
      { status: 400 }
    );
  }

  let data: GatheredData;
  try {
    data = await gatherAccountData(accountId, dateRange);
  } catch (err) {
    return metaErrorResponse(err);
  }

  if (data.campaigns.length === 0 || (data.currentMetrics.spend === 0 && data.currentMetrics.impressions === 0)) {
    return NextResponse.json(noDataAnalysis());
  }

  try {
    const analysis = await getAIAnalystService().analyze({
      mode: "performance",
      client: data.client,
      currency: data.currency,
      dateRange,
      campaigns: data.campaigns,
      adSets: data.adSets,
      ads: data.ads,
      currentMetrics: data.currentMetrics,
      previousMetrics: data.previousMetrics,
      campaignMetrics: data.campaignMetrics,
      adSetMetrics: data.adSetMetrics,
      adMetrics: data.adMetrics,
      alerts: data.alerts,
      question,
    });
    return NextResponse.json(analysis);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
