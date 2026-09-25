import "server-only";
import type { PerformanceDecision } from "./types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

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
