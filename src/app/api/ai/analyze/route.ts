import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { fetchRealCampaigns } from "@/lib/meta/real/campaigns";
import { fetchRealAdSets } from "@/lib/meta/real/adsets";
import { fetchRealAds } from "@/lib/meta/real/ads";
import { fetchAggregatedInsightsByEntity, mapInsightsRowToDailyMetrics } from "@/lib/meta/real/insights";
import { metaErrorResponse } from "@/lib/meta/real/error-response";
import { aiErrorResponse } from "@/lib/ai/error-response";
import type { Ad, AdSet, AIAnalysis, Campaign, Client, DateRange, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, combineAccountMetrics } from "@/lib/utils/metrics";

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
}

const META_ACCOUNT_COLOR = "#1877F2";

/** Campañas + conjuntos + anuncios + métricas del periodo, todo vía `lib/meta/real/`. */
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

  // Sin campañas: no tiene sentido pedir insights ni entidades inferiores.
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

  // Sin gasto ni impresiones en el rango: tampoco hay nada real que analizar.
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
      previousMetrics: combineAccountMetrics(previousCampaignMetrics),
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
 * El frontend nunca llama al proveedor de IA directamente: envía aquí la
 * cuenta (si hay alguna seleccionada), el rango de fechas y la pregunta.
 *
 * El modo llega **explícito** en el cuerpo y se valida aquí: no se infiere de
 * la presencia de otros campos ni del texto de la pregunta, así que la
 * separación entre ambos es determinista.
 *   - **general** (consulta estratégica): no se consulta Meta bajo ninguna
 *     circunstancia, ni siquiera si el cuerpo trae cuenta o periodo. El
 *     proveedor recibe solo la pregunta, marcada como "sin datos de campaña".
 *     Funciona aunque META_ACCESS_TOKEN falte o esté vencido.
 *   - **performance** (analizar rendimiento): exige cuenta y periodo, y los
 *     valida antes de llamar a Meta o a la IA. Reúne campañas, conjuntos,
 *     anuncios y métricas exclusivamente de Meta Marketing API (`lib/meta/real/`).
 *
 * El proveedor solo recibe métricas reales: no existe ninguna fuente
 * simulada. Si no hay campañas ni gasto/impresiones en el periodo, se
 * devuelve un estado vacío explícito sin llamar al proveedor en absoluto.
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

  // ── Modo estratégico ────────────────────────────────────────────────────
  // Barrera dura: en este modo NO se consulta Meta bajo ninguna circunstancia,
  // aunque el cuerpo traiga clientId o dateRange — se ignoran deliberadamente.
  // Por eso funciona aunque META_ACCESS_TOKEN falte o esté vencido.
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

  // ── Modo rendimiento ────────────────────────────────────────────────────
  // Cuenta y periodo son obligatorios, y se validan ANTES de llamar a Meta o
  // a la IA: sin ellos no puede haber métricas reales, y devolver cualquier
  // análisis daría la falsa impresión de estar basado en datos.
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
      question,
    });
    return NextResponse.json(analysis);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
