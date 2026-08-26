import { NextRequest, NextResponse } from "next/server";
import { getAIAnalystService } from "@/lib/ai";
import { getMetaAdsService } from "@/lib/meta";
import type { DateRange, PerformanceMetrics } from "@/lib/types";
import { getPreviousPeriod } from "@/lib/utils/dates";
import { aggregateMetrics, combineAccountMetrics } from "@/lib/utils/metrics";

interface AnalyzeRequestBody {
  clientId: string;
  dateRange: DateRange;
  question?: string;
}

/**
 * Backend del "AI Performance Analyst".
 *
 * El frontend nunca llama a Anthropic directamente: envía aquí el cliente,
 * el rango de fechas y (opcionalmente) una pregunta. Este endpoint reúne
 * campañas, ad sets, anuncios y métricas desde `getMetaAdsService()` y se
 * los pasa a `getAIAnalystService()`, que hoy es una implementación mock y
 * en el futuro será una llamada real a Claude — sin que el frontend cambie.
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

  const metaService = getMetaAdsService();
  const client = await metaService.getClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const previousRange = getPreviousPeriod(dateRange);
  const [campaigns, adSets, ads] = await Promise.all([
    metaService.getCampaigns(clientId),
    metaService.getAdSets(clientId),
    metaService.getAds(clientId),
  ]);

  const campaignMetrics: Record<string, PerformanceMetrics> = {};
  await Promise.all(
    campaigns.map(async (c) => {
      const rows = await metaService.getDailyMetrics("campaign", c.id, dateRange);
      campaignMetrics[c.id] = aggregateMetrics(rows);
    })
  );

  const adMetrics: Record<string, PerformanceMetrics> = {};
  await Promise.all(
    ads.map(async (a) => {
      const rows = await metaService.getDailyMetrics("ad", a.id, dateRange);
      adMetrics[a.id] = aggregateMetrics(rows);
    })
  );

  const currentMetrics = combineAccountMetrics(Object.values(campaignMetrics));
  const previousCampaignMetrics = await Promise.all(
    campaigns.map(async (c) => aggregateMetrics(await metaService.getDailyMetrics("campaign", c.id, previousRange)))
  );
  const previousMetrics = combineAccountMetrics(previousCampaignMetrics);

  const analysis = await getAIAnalystService().analyze({
    client,
    dateRange,
    campaigns,
    adSets,
    ads,
    currentMetrics,
    previousMetrics,
    campaignMetrics,
    adMetrics,
    question,
  });

  return NextResponse.json(analysis);
}
