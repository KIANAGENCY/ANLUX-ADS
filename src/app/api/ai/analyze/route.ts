import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { buildRealAlertsFromMetrics } from "@/lib/alerts/real-engine";
import { evaluateDecision } from "@/lib/decisions/engine";
import type { PerformanceDecision } from "@/lib/decisions/types";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { fetchAccountRangeMetrics } from "@/lib/meta/real/overview";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { aiErrorResponse } from "@/lib/ai/error-response";
import type { Ad, AdSet, AIAnalysis, Campaign, Client, DateRange, PerformanceAlert, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics } from "@/lib/utils/metrics";

const ANALYSIS_MODES = ["general", "performance"] as const;
const MAX_REQUEST_CHARS = 16_384;
const MAX_QUESTION_CHARS = 4_000;
const ACCOUNT_ID_RE = /^act_\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

type AnalysisMode = (typeof ANALYSIS_MODES)[number];

function isAnalysisMode(value: unknown): value is AnalysisMode {
  return typeof value === "string" && (ANALYSIS_MODES as readonly string[]).includes(value);
}

function parseIsoDate(value: string): number | null {
  if (!DATE_RE.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function validDateRange(range: DateRange | undefined): range is DateRange {
  if (!range?.from || !range?.to) return false;
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (from === null || to === null || from > to) return false;
  return (to - from) / 86_400_000 + 1 <= MAX_RANGE_DAYS;
}

function hasActivity(metrics: PerformanceMetrics): boolean {
  return metrics.spend > 0 || metrics.impressions > 0 || metrics.clicks > 0 || metrics.results > 0;
}

const DECISION_PRIORITY: Record<PerformanceDecision["action"], number> = {
  PAUSE_CANDIDATE: 0,
  REDUCE: 1,
  REFRESH_CREATIVE: 2,
  REVIEW_AUDIENCE: 3,
  SCALE: 4,
  WATCH: 5,
  MAINTAIN: 6,
  INSUFFICIENT_DATA: 7,
};

function sortDecisions(decisions: PerformanceDecision[]): PerformanceDecision[] {
  const confidence = { high: 0, medium: 1, low: 2 } as const;
  return decisions.sort((a, b) => {
    const action = DECISION_PRIORITY[a.action] - DECISION_PRIORITY[b.action];
    if (action !== 0) return action;
    return confidence[a.confidence] - confidence[b.confidence];
  });
}

interface AnalyzeRequestBody {
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
  decisions: PerformanceDecision[];
}

const META_ACCOUNT_COLOR = "#1877F2";

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
      decisions: [],
    };
  }

  const [currentInsights, previousInsights, currentMetrics, previousMetrics] = await Promise.all([
    fetchAggregatedInsightsByEntity(accountId, "campaign", dateRange.from, dateRange.to),
    fetchAggregatedInsightsByEntity(accountId, "campaign", previousRange.from, previousRange.to),
    fetchAccountRangeMetrics(accountId, dateRange.from, dateRange.to),
    fetchAccountRangeMetrics(accountId, previousRange.from, previousRange.to),
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
      decisions: [],
    };
  }

  const [adSets, adSetInsights, previousAdSetInsights, ads, adInsights, previousAdInsights] = await Promise.all([
    fetchRealAdSets(accountId),
    fetchAggregatedInsightsByEntity(accountId, "adset", dateRange.from, dateRange.to),
    fetchAggregatedInsightsByEntity(accountId, "adset", previousRange.from, previousRange.to),
    fetchRealAds(accountId),
    fetchAggregatedInsightsByEntity(accountId, "ad", dateRange.from, dateRange.to),
    fetchAggregatedInsightsByEntity(accountId, "ad", previousRange.from, previousRange.to),
  ]);

  const adSetMetrics: Record<string, PerformanceMetrics> = {};
  const previousAdSetMetrics: Record<string, PerformanceMetrics> = {};
  for (const adSet of adSets) {
    const row = adSetInsights.get(adSet.id);
    adSetMetrics[adSet.id] = aggregateMetrics(
      row ? [mapInsightsRowToDailyMetrics(row, adSet.id, "adset", adSet.campaignObjective, dateRange.from)] : []
    );
    const previousRow = previousAdSetInsights.get(adSet.id);
    previousAdSetMetrics[adSet.id] = aggregateMetrics(
      previousRow
        ? [mapInsightsRowToDailyMetrics(previousRow, adSet.id, "adset", adSet.campaignObjective, previousRange.from)]
        : []
    );
  }

  const adMetrics: Record<string, PerformanceMetrics> = {};
  const previousAdMetrics: Record<string, PerformanceMetrics> = {};
  for (const ad of ads) {
    const row = adInsights.get(ad.id);
    adMetrics[ad.id] = aggregateMetrics(
      row ? [mapInsightsRowToDailyMetrics(row, ad.id, "ad", ad.campaignObjective, dateRange.from)] : []
    );
    const previousRow = previousAdInsights.get(ad.id);
    previousAdMetrics[ad.id] = aggregateMetrics(
      previousRow
        ? [mapInsightsRowToDailyMetrics(previousRow, ad.id, "ad", ad.campaignObjective, previousRange.from)]
        : []
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

  const decisions: PerformanceDecision[] = [];
  for (const campaign of campaigns) {
    if (campaign.status !== "ACTIVE" || !hasActivity(campaignMetrics[campaign.id] ?? aggregateMetrics([]))) continue;
    decisions.push(
      evaluateDecision({
        entityType: "campaign",
        entityId: campaign.id,
        entityName: campaign.name,
        campaignId: campaign.id,
        campaignName: campaign.name,
        objective: campaign.objective,
        current: campaignMetrics[campaign.id],
        previous: previousCampaignMetrics[campaign.id],
      })
    );
  }

  for (const adSet of adSets) {
    const current = adSetMetrics[adSet.id];
    if (adSet.status !== "ACTIVE" || !current || !hasActivity(current)) continue;
    decisions.push(
      evaluateDecision({
        entityType: "adset",
        entityId: adSet.id,
        entityName: adSet.name,
        campaignId: adSet.campaignId,
        campaignName: adSet.campaignName,
        objective: adSet.campaignObjective,
        current,
        previous: previousAdSetMetrics[adSet.id] ?? aggregateMetrics([]),
      })
    );
  }

  for (const ad of ads) {
    const current = adMetrics[ad.id];
    if (ad.status !== "ACTIVE" || !current || !hasActivity(current)) continue;
    decisions.push(
      evaluateDecision({
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        campaignId: ad.campaignId,
        campaignName: ad.campaignName,
        objective: ad.campaignObjective,
        current,
        previous: previousAdMetrics[ad.id] ?? aggregateMetrics([]),
      })
    );
  }

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
    decisions: sortDecisions(decisions),
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

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_CHARS) {
      return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });
    }
    body = JSON.parse(raw) as AnalyzeRequestBody;
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

  if (question !== undefined && (typeof question !== "string" || question.length > MAX_QUESTION_CHARS)) {
    return NextResponse.json(
      { error: `La pregunta debe ser texto y no superar ${MAX_QUESTION_CHARS} caracteres.` },
      { status: 400 }
    );
  }

  if (mode === "general") {
    const generalQuestion = question?.trim();
    if (!generalQuestion) {
      return NextResponse.json({ error: "Escribe una pregunta para la consulta estratégica." }, { status: 400 });
    }

    try {
      const analysis = await getAIAnalystService().analyze({ mode: "general", question: generalQuestion });
      return NextResponse.json(analysis);
    } catch (err) {
      return aiErrorResponse(err);
    }
  }

  const accountId = clientId?.trim();
  if (!accountId || !ACCOUNT_ID_RE.test(accountId)) {
    return NextResponse.json(
      { error: "Selecciona una cuenta de Meta válida para analizar su rendimiento." },
      { status: 400 }
    );
  }
  if (!validDateRange(dateRange)) {
    return NextResponse.json(
      { error: `Selecciona un periodo válido, en orden cronológico y de hasta ${MAX_RANGE_DAYS} días.` },
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
      decisions: data.decisions,
      question: question?.trim() || undefined,
    });
    return NextResponse.json(analysis);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
