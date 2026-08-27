import "server-only";
import type { DailyMetrics } from "@/lib/types";
import { fetchCampaignObjectives } from "./campaigns";
import { fetchAccountDailyInsights, fetchCampaignDailyInsights } from "./insights";
import { getPrimaryResult, parseActionsArray, toNumber } from "./actions";

/**
 * Métricas diarias a nivel de cuenta para el rango dado.
 *
 * `spend`/`impressions`/`reach`/`clicks` se toman directamente del insight a
 * `level=account` (Meta ya los calcula deduplicados a nivel de cuenta, más
 * preciso que sumar cada campaña a mano).
 *
 * `results` es la excepción: a nivel de cuenta no existe un único "objetivo"
 * que indique qué `action_type` cuenta como resultado, y las campañas de la
 * cuenta pueden tener objetivos distintos entre sí. Sumar todos los
 * `action_type` sin distinción mezclaría leads con clics con mensajes — un
 * número sin significado. En su lugar, se piden también los insights diarios
 * a `level=campaign`, se interpreta el resultado de cada campaña con SU
 * PROPIO objetivo (`getPrimaryResult`), y se suman esos resultados ya
 * correctamente interpretados por día.
 */
export async function fetchAccountDailyMetrics(
  adAccountId: string,
  since: string,
  until: string
): Promise<DailyMetrics[]> {
  const [accountRows, campaignObjectives, campaignRows] = await Promise.all([
    fetchAccountDailyInsights(adAccountId, since, until),
    fetchCampaignObjectives(adAccountId),
    fetchCampaignDailyInsights(adAccountId, since, until),
  ]);

  const resultsByDate = new Map<string, number>();
  for (const row of campaignRows) {
    const date = row.date_start ?? since;
    const objective = (row.campaign_id && campaignObjectives.get(row.campaign_id)) || "TRAFFIC";
    const actions = parseActionsArray(row.actions);
    const result = getPrimaryResult(actions, objective) ?? 0;
    resultsByDate.set(date, (resultsByDate.get(date) ?? 0) + result);
  }

  return accountRows.map((row) => {
    const date = row.date_start ?? since;
    return {
      date,
      entityId: adAccountId,
      entityType: "account",
      spend: toNumber(row.spend),
      impressions: toNumber(row.impressions),
      reach: toNumber(row.reach),
      clicks: toNumber(row.clicks),
      results: resultsByDate.get(date) ?? 0,
    };
  });
}
