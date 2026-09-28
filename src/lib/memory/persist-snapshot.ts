import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionEngineResult } from "@/lib/decisions/types";
import type { IntelligenceSuiteResult } from "@/lib/intelligence/types";

/** Caller supplies its already-authorized client; this module never creates credentials. */
export async function persistSnapshot(client: SupabaseClient, decisionResult: DecisionEngineResult, suite: IntelligenceSuiteResult): Promise<void> {
  const accountId = decisionResult.accountId;
  const totals = decisionResult.accountMetrics;
  if (!totals) throw new Error("No hay métricas agregadas verificadas de la cuenta; se omitió el snapshot histórico.");
  const { error: accountError } = await client.from("meta_ad_accounts").upsert(
    { id: accountId, currency: decisionResult.currency ?? null, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (accountError) throw accountError;

  const capturedAt = new Date().toISOString();
  if (decisionResult.decisions.length > 0) {
    const rows = decisionResult.decisions.map((decision) => ({
      ad_account_id: accountId,
      period_from: decisionResult.from,
      period_to: decisionResult.to,
      entity_type: decision.entityType,
      entity_id: decision.entityId,
      entity_name: decision.entityName,
      campaign_id: decision.campaignId,
      objective: decision.objective,
      result_type: decision.resultType ?? null,
      previous_result_type: decision.previousResultType ?? null,
      current_results_available: decision.currentResultsAvailable === true,
      previous_results_available: decision.previousResultsAvailable === true,
      action: decision.action,
      score: decision.score,
      confidence: decision.confidence,
      risk: decision.risk,
      suggested_change_percent: decision.suggestedChangePercent,
      rationale: decision.rationale,
      evidence: decision.signals,
      metrics_current: decision.currentMetrics,
      metrics_previous: decision.previousMetrics,
      generated_at: decision.generatedAt,
      stored_at: capturedAt,
    }));

    const { error: decisionsError } = await client.from("decision_history").upsert(rows, {
      onConflict: "ad_account_id,period_from,period_to,entity_type,entity_id",
    });
    if (decisionsError) throw decisionsError;
  }

  const { error: observationError } = await client.from("account_period_observations").upsert(
    {
      ad_account_id: accountId,
      period_from: decisionResult.from,
      period_to: decisionResult.to,
      spend: totals.spend,
      impressions: totals.impressions,
      reach: totals.reach,
      clicks: totals.clicks,
      results: totals.results,
      decision_summary: decisionResult.summary,
      forecast: suite.forecast,
      captured_at: capturedAt,
    },
    { onConflict: "ad_account_id,period_from,period_to" }
  );
  if (observationError) throw observationError;

}
