import type { Ad, AdSet, Campaign, DailyMetrics, EntityType } from "@/lib/types";
import { enumerateDates, getToday, toISODate } from "@/lib/utils/dates";
import { MOCK_ADS, MOCK_AD_SETS, MOCK_CAMPAIGNS } from "./entities";
import { createRng, hashStringToSeed, randomBetween, type Rng } from "./random";

// ---------------------------------------------------------------------------
// Perfil estático por anuncio (se calcula una única vez, de forma determinista,
// al cargar el módulo). Define "quién es" cada anuncio: su nivel de
// performance base y sus tendencias a lo largo del flight. A partir de aquí,
// las métricas día a día se derivan matemáticamente, no se inventan sueltas.
// ---------------------------------------------------------------------------

type CtrTrend = "improving" | "stable" | "declining" | "crashing";
type CostTrend = "stable" | "rising" | "spiking";
type Tier = "top" | "good" | "average" | "weak";

interface AdProfile {
  tier: Tier;
  baseCtr: number; // %
  baseCpm: number; // $
  baseResultRate: number; // fracción de clics que se convierten en "resultado"
  ctrTrend: CtrTrend;
  costTrend: CostTrend;
  spendShare: number; // proporción del presupuesto del ad set que consume este anuncio
}

/** Anuncios con arcos de rendimiento "guionizados" para que el MVP cuente una historia creíble. */
const SCRIPTED_TIERS: Record<string, Tier> = {
  adset_ob1_25_45_ad1: "top",
  adset_ob2_lookalike_ad1: "top",
  adset_he1_familias_ad3: "top",
  adset_he4_remarketing_ad1: "top",
  adset_ob3_retarget_web_ad2: "weak",
  adset_he2_blog_organico_ad2: "weak",
};

const SCRIPTED_CTR_TREND: Record<string, CtrTrend> = {
  adset_ob1_25_45_ad2: "crashing",
  adset_he1_parejas_ad1: "declining",
  adset_ob2_lookalike_ad1: "improving",
  adset_he4_remarketing_ad1: "improving",
};

const SCRIPTED_COST_TREND: Record<string, CostTrend> = {
  adset_he3_bodas_ad1: "spiking",
  adset_he3_bodas_ad2: "spiking",
  adset_ob1_deportistas_ad1: "rising",
};

/** Ad sets con audiencia pequeña que se satura (frecuencia creciente por encima de 3). */
export const FREQUENCY_HOTSPOT_ADSETS = new Set([
  "adset_ob2_geo_local",
  "adset_he4_lookalike_compradores",
]);

/** Objetivos de awareness no producen "resultados" reales (leads/mensajes/ventas). */
const ZERO_RESULT_OBJECTIVES = new Set(["BRAND_AWARENESS"]);

const CAMPAIGNS_BY_ID = new Map(MOCK_CAMPAIGNS.map((c) => [c.id, c]));
const AD_SETS_BY_ID = new Map(MOCK_AD_SETS.map((a) => [a.id, a]));

function pickTier(rng: Rng): Tier {
  const roll = rng();
  if (roll < 0.15) return "top";
  if (roll < 0.5) return "good";
  if (roll < 0.85) return "average";
  return "weak";
}

const TIER_CTR_RANGE: Record<Tier, [number, number]> = {
  top: [2.4, 3.6],
  good: [1.5, 2.3],
  average: [0.9, 1.5],
  weak: [0.4, 0.9],
};

const TIER_RESULT_RATE_RANGE: Record<Tier, [number, number]> = {
  top: [0.09, 0.16],
  good: [0.05, 0.09],
  average: [0.025, 0.05],
  weak: [0.005, 0.02],
};

function buildAdProfiles(): Map<string, AdProfile> {
  const rng = createRng(42);
  const profiles = new Map<string, AdProfile>();
  const adsBySet = new Map<string, Ad[]>();
  for (const ad of MOCK_ADS) {
    const list = adsBySet.get(ad.adSetId) ?? [];
    list.push(ad);
    adsBySet.set(ad.adSetId, list);
  }

  for (const [, ads] of adsBySet) {
    const shares = ads.map(() => 0.4 + rng());
    const shareSum = shares.reduce((a, b) => a + b, 0);

    ads.forEach((ad, i) => {
      const campaign = CAMPAIGNS_BY_ID.get(ad.campaignId);
      const tier = SCRIPTED_TIERS[ad.id] ?? pickTier(rng);
      const [ctrMin, ctrMax] = TIER_CTR_RANGE[tier];
      const isZeroResultObjective = campaign && ZERO_RESULT_OBJECTIVES.has(campaign.objective);
      const [rrMin, rrMax] = TIER_RESULT_RATE_RANGE[tier];

      profiles.set(ad.id, {
        tier,
        baseCtr: randomBetween(rng, ctrMin, ctrMax),
        baseCpm: randomBetween(rng, 7, 21),
        baseResultRate: isZeroResultObjective ? randomBetween(rng, 0, 0.004) : randomBetween(rng, rrMin, rrMax),
        ctrTrend: SCRIPTED_CTR_TREND[ad.id] ?? "stable",
        costTrend: SCRIPTED_COST_TREND[ad.id] ?? "stable",
        spendShare: shares[i] / shareSum,
      });
    });
  }

  return profiles;
}

const AD_PROFILES = buildAdProfiles();

/** Fecha (determinista) en la que una entidad PAUSED dejó de recibir presupuesto. */
function getPausedSince(campaignId: string): string {
  const rng = createRng(hashStringToSeed(`paused:${campaignId}`));
  const today = getToday();
  const daysAgo = Math.round(randomBetween(rng, 6, 16));
  return toISODate(new Date(today.getTime() - daysAgo * 86400000));
}

function applyCtrTrend(baseCtr: number, trend: CtrTrend, progress: number, recentWindow: boolean): number {
  switch (trend) {
    case "improving":
      return baseCtr * (0.75 + progress * 0.5);
    case "declining":
      return baseCtr * (1.15 - progress * 0.5);
    case "crashing":
      return recentWindow ? baseCtr * 0.55 : baseCtr * (1.05 - progress * 0.15);
    case "stable":
    default:
      return baseCtr;
  }
}

function applyCostTrend(baseCpm: number, trend: CostTrend, progress: number, recentWindow: boolean): number {
  switch (trend) {
    case "rising":
      return baseCpm * (0.9 + progress * 0.35);
    case "spiking":
      return recentWindow ? baseCpm * 1.55 : baseCpm * (0.95 + progress * 0.1);
    case "stable":
    default:
      return baseCpm;
  }
}

function getFrequencyForDay(adSetId: string, progress: number, recentWindow: boolean, rng: Rng): number {
  const isHotspot = FREQUENCY_HOTSPOT_ADSETS.has(adSetId);
  if (!isHotspot) {
    return randomBetween(rng, 1.15, 1.9);
  }
  const climb = recentWindow ? 3.0 + progress * 1.1 : 1.6 + progress * 1.6;
  return climb + randomBetween(rng, -0.15, 0.2);
}

function sampleResults(rng: Rng, expected: number): number {
  if (expected <= 0) return 0;
  const noisy = expected * randomBetween(rng, 0.55, 1.45);
  const floor = Math.floor(noisy);
  const frac = noisy - floor;
  return floor + (rng() < frac ? 1 : 0);
}

/** Factor de estacionalidad semanal: fin de semana con menor actividad B2B / mayor en viajes. */
function weekdaySeasonality(date: string, objective: Campaign["objective"]): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const isWeekend = day === 0 || day === 6;
  if (objective === "SALES" || objective === "TRAFFIC") {
    return isWeekend ? 1.15 : 0.95;
  }
  return isWeekend ? 0.7 : 1.05;
}

const GENERATION_WINDOW_DAYS = 150;

function getGenerationStart(): string {
  const today = getToday();
  return toISODate(new Date(today.getTime() - GENERATION_WINDOW_DAYS * 86400000));
}

/**
 * Genera las métricas diarias de un anuncio para una fecha concreta.
 * Es una función pura y determinista: mismo anuncio + misma fecha = mismos
 * números siempre, sin importar cuántas veces ni en qué orden se invoque.
 */
function generateAdDay(ad: Ad, adSet: AdSet, campaign: Campaign, date: string): DailyMetrics | null {
  if (date < ad.startDate) return null;
  if (campaign.status === "IN_REVIEW") return null;

  const today = getToday();
  const rangeStart = getGenerationStart();
  const totalSpan = Math.max(
    1,
    Math.round((today.getTime() - new Date(rangeStart).getTime()) / 86400000)
  );
  const dayOffset = Math.round((new Date(date).getTime() - new Date(rangeStart).getTime()) / 86400000);
  const progress = Math.min(1, Math.max(0, dayOffset / totalSpan));
  const daysFromToday = Math.round((today.getTime() - new Date(date).getTime()) / 86400000);
  const recentWindow = daysFromToday <= 12;

  const isPaused = campaign.status === "PAUSED" || adSet.status === "PAUSED" || ad.status === "PAUSED";
  if (isPaused) {
    const pausedSince = getPausedSince(campaign.id);
    if (date > pausedSince) return null;
  }

  const profile = AD_PROFILES.get(ad.id);
  if (!profile) return null;

  const rng = createRng(hashStringToSeed(`${ad.id}:${date}`));

  const seasonality = weekdaySeasonality(date, campaign.objective);
  const pacing = randomBetween(rng, 0.82, 1.12);
  const spend = Math.max(0, adSet.dailyBudget * profile.spendShare * seasonality * pacing);

  const cpm = Math.max(3, applyCostTrend(profile.baseCpm, profile.costTrend, progress, recentWindow) * randomBetween(rng, 0.92, 1.08));
  const impressions = Math.round((spend / cpm) * 1000);

  const ctr = Math.max(0.1, applyCtrTrend(profile.baseCtr, profile.ctrTrend, progress, recentWindow) * randomBetween(rng, 0.88, 1.12));
  const clicks = Math.round(impressions * (ctr / 100));

  const resultRate = profile.baseResultRate * randomBetween(rng, 0.7, 1.3);
  const results = sampleResults(rng, clicks * resultRate);

  const frequency = getFrequencyForDay(adSet.id, progress, recentWindow, rng);
  const reach = Math.max(1, Math.round(impressions / frequency));

  return {
    date,
    entityId: ad.id,
    entityType: "ad",
    spend: Math.round(spend * 100) / 100,
    impressions,
    reach,
    clicks,
    results,
  };
}

let cachedAdRows: DailyMetrics[] | null = null;

/** Todas las filas diarias a nivel de anuncio, para toda la ventana de generación. */
export function getAllAdDailyMetrics(): DailyMetrics[] {
  if (cachedAdRows) return cachedAdRows;

  const rangeStart = getGenerationStart();
  const today = getToday();
  const dates = enumerateDates({ from: rangeStart, to: toISODate(today) });

  const rows: DailyMetrics[] = [];
  for (const ad of MOCK_ADS) {
    const adSet = AD_SETS_BY_ID.get(ad.adSetId);
    const campaign = CAMPAIGNS_BY_ID.get(ad.campaignId);
    if (!adSet || !campaign) continue;
    for (const date of dates) {
      const row = generateAdDay(ad, adSet, campaign, date);
      if (row) rows.push(row);
    }
  }

  cachedAdRows = rows;
  return rows;
}

function sumRows(rows: DailyMetrics[], entityId: string, entityType: EntityType, date: string): DailyMetrics {
  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.impressions += r.impressions;
      acc.reach += r.reach;
      acc.clicks += r.clicks;
      acc.results += r.results;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 }
  );
  return {
    date,
    entityId,
    entityType,
    spend: Math.round(totals.spend * 100) / 100,
    impressions: totals.impressions,
    reach: Math.round(totals.reach * 0.9), // dedup aproximado al combinar audiencias de varios anuncios
    clicks: totals.clicks,
    results: totals.results,
  };
}

/** Métricas diarias agregadas a nivel de ad set, campaña o cuenta completa. */
export function getAggregatedDailyMetrics(
  entityType: Exclude<EntityType, "ad">,
  entityId: string
): DailyMetrics[] {
  const adRows = getAllAdDailyMetrics();

  let relevantAdIds: Set<string>;
  if (entityType === "adset") {
    relevantAdIds = new Set(MOCK_ADS.filter((a) => a.adSetId === entityId).map((a) => a.id));
  } else if (entityType === "campaign") {
    relevantAdIds = new Set(MOCK_ADS.filter((a) => a.campaignId === entityId).map((a) => a.id));
  } else {
    const campaignIds = new Set(MOCK_CAMPAIGNS.filter((c) => c.adAccountId === entityId).map((c) => c.id));
    relevantAdIds = new Set(MOCK_ADS.filter((a) => campaignIds.has(a.campaignId)).map((a) => a.id));
  }

  const byDate = new Map<string, DailyMetrics[]>();
  for (const row of adRows) {
    if (!relevantAdIds.has(row.entityId)) continue;
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  return Array.from(byDate.entries())
    .map(([date, rows]) => sumRows(rows, entityId, entityType, date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getAdProfileTier(adId: string): Tier | undefined {
  return AD_PROFILES.get(adId)?.tier;
}
