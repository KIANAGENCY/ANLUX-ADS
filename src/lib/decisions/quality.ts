import "server-only";
import type { PerformanceDecision } from "./types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { deriveMessagingTarget } from "@/lib/intelligence/target-derivation";

export async function loadExactQuality(accountId: string, from: string, to: string, service = false): Promise<Map<string, number>> {
  const client = service ? getSupabaseServiceClient() : await getSupabaseServerClient();
  if (!client) return new Map();
  const { data, error } = await client.from("campaign_quality_feedback")
    .select("campaign_id,qualified_conversations")
    .eq("ad_account_id", accountId).eq("period_from", from).eq("period_to", to);
  if (error) throw error;
  // Multiple reporters are possible. Never add their overlapping counts together.
  const grouped = new Map<string, number[]>();
  for (const row of data ?? []) {
    const values = grouped.get(row.campaign_id) ?? [];
    values.push(Number(row.qualified_conversations));
    grouped.set(row.campaign_id, values);
  }
  return new Map([...grouped].filter(([, values]) => values.length === 1).map(([id, values]) => [id, values[0]]));
}

/** Uses only verified daily campaign snapshots; insufficient history yields no baseline. */
export async function loadTypicalMessagingCost(accountId: string, through: string, service = false): Promise<number | null> {
  const client = service ? getSupabaseServiceClient() : await getSupabaseServerClient();
  if (!client) return null;
  const end = new Date(`${through}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 55);
  const from = start.toISOString().slice(0, 10);
  const { data, error } = await client.from("decision_history")
    .select("period_from,period_to,campaign_id,result_type,current_results_available,metrics_current")
    .eq("ad_account_id", accountId).eq("entity_type", "campaign")
    .gte("period_from", from).lte("period_to", through);
  if (error) throw error;
  const proposal = deriveMessagingTarget((data ?? []).map((row) => {
    const metrics = row.metrics_current && typeof row.metrics_current === "object" ? row.metrics_current as Record<string, unknown> : {};
    return {
      campaignId: row.campaign_id,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      objective: null,
      resultType: row.result_type,
      resultsAvailable: row.current_results_available,
      spend: typeof metrics.spend === "number" ? metrics.spend : null,
      results: typeof metrics.results === "number" ? metrics.results : null,
    };
  }));
  return proposal?.targetCostPerResult ?? null;
}

/** A second layer of human evidence; Meta's reported outcomes remain unchanged. */
export function applyQualityEvidence(decision: PerformanceDecision, qualified: number | undefined): PerformanceDecision {
  if (decision.entityType !== "campaign" || decision.resultType !== "onsite_conversion.messaging_conversation_started_7d" ||
      decision.currentResultsAvailable !== true || qualified === undefined || !Number.isInteger(qualified) ||
      qualified < 0 || qualified > decision.currentMetrics.results || decision.currentMetrics.results < 10) return decision;
  const rate = qualified / decision.currentMetrics.results;
  const cost = qualified > 0 ? decision.currentMetrics.spend / qualified : null;
  const signal = {
    code: "human_qualified_conversations",
    label: "Calidad confirmada manualmente",
    detail: `${qualified} de ${decision.currentMetrics.results} conversaciones calificadas; ${cost === null ? "sin costo por conversación calificada calculable" : `${cost.toFixed(2)} por conversación calificada`}.`,
    impact: rate < 0.2 ? -15 : 0,
  };
  const poor = rate < 0.2;
  return {
    ...decision,
    qualifiedConversations: qualified,
    action: poor && ["SCALE", "MAINTAIN"].includes(decision.action) ? "WATCH" : decision.action,
    suggestedChangePercent: poor ? null : decision.suggestedChangePercent,
    score: Math.max(0, decision.score + signal.impact),
    rationale: poor ? `Solo ${qualified} de ${decision.currentMetrics.results} conversaciones fueron calificadas. Revisa calidad antes de aumentar inversión.` : decision.rationale,
    signals: [signal, ...decision.signals],
  };
}
