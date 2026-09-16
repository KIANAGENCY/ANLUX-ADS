import "server-only";
import type { DecisionEngineResult, PerformanceDecision } from "@/lib/decisions/types";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";
import { isMemoryEnabled } from "./config";
import type { MemoryStatus } from "./repository";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

function unavailable(message: string): MemoryStatus {
  return { state: "unavailable", enabled: true, message };
}

function campaignTotals(decisions: PerformanceDecision[]) {
  return decisions.filter((decision) => decision.entityType === "campaign").reduce(
    (acc, decision) => ({
      spend: acc.spend + decision.currentMetrics.spend,
      impressions: acc.impressions + decision.currentMetrics.impressions,
      reach: acc.reach + decision.currentMetrics.reach,
      clicks: acc.clicks + decision.currentMetrics.clicks,
      results: acc.results + decision.currentMetrics.results,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 }
  );
}

function clientStatus(): { client: NonNullable<ReturnType<typeof getSupabaseServiceClient>> | null; status: MemoryStatus } {
  if (!isMemoryEnabled()) return { client: null, status: { state: "disabled", enabled: false, message: "Memoria histórica desactivada por configuración." } };
  const client = getSupabaseServiceClient();
  return client
    ? { client, status: { state: "ready", enabled: true, message: "Memoria histórica disponible para proceso programado." } }
    : { client: null, status: unavailable("SUPABASE_SECRET_KEY o la URL de Supabase no están configuradas para el proceso programado.") };
}

async function ensureAccount(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>, accountId: string, currency?: string | null) {
  const { error } = await client.from("meta_ad_accounts").upsert(
    { id: accountId, currency: currency ?? null, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function loadServiceBusinessGoals(accountId: string): Promise<{ goals: BusinessGoals | null; status: MemoryStatus }> {
  const auth = clientStatus();
  if (!auth.client) return { goals: null, status: auth.status };
  const { data, error } = await auth.client.from("business_goals")
    .select("target_cost_per_result,minimum_roas,monthly_budget,gross_margin_percent,risk_tolerance")
    .eq("ad_account_id", accountId).maybeSingle();
  if (error) throw error;
  if (!data) return { goals: null, status: auth.status };
  return { goals: {
    targetCostPerResult: data.target_cost_per_result == null ? null : Number(data.target_cost_per_result),
    minimumRoas: data.minimum_roas == null ? null : Number(data.minimum_roas),
    monthlyBudget: data.monthly_budget == null ? null : Number(data.monthly_budget),
    grossMarginPercent: data.gross_margin_percent == null ? null : Number(data.gross_margin_percent),
    riskTolerance: data.risk_tolerance === "conservative" || data.risk_tolerance === "growth" ? data.risk_tolerance : "balanced",
  }, status: auth.status };
}

export async function persistServiceIntelligenceMemory(decisionResult: DecisionEngineResult, suite: IntelligenceSuiteResult, _goals: BusinessGoals): Promise<MemoryStatus> {
  const auth = clientStatus();
  if (!auth.client) return auth.status;
  const totals = campaignTotals(decisionResult.decisions);
  await ensureAccount(auth.client, decisionResult.accountId, decisionResult.currency);
  const { error: observationError } = await auth.client.from("account_period_observations").upsert({
    ad_account_id: decisionResult.accountId, period_from: decisionResult.from, period_to: decisionResult.to,
    spend: totals.spend, impressions: totals.impressions, reach: totals.reach, clicks: totals.clicks, results: totals.results,
    decision_summary: decisionResult.summary, forecast: suite.forecast, captured_at: new Date().toISOString(),
  }, { onConflict: "ad_account_id,period_from,period_to" });
  if (observationError) throw observationError;
  if (decisionResult.decisions.length) {
    const rows = decisionResult.decisions.map((decision) => ({
      ad_account_id: decisionResult.accountId, period_from: decisionResult.from, period_to: decisionResult.to,
      entity_type: decision.entityType, entity_id: decision.entityId, entity_name: decision.entityName,
      campaign_id: decision.campaignId, objective: decision.objective, action: decision.action, score: decision.score,
      confidence: decision.confidence, risk: decision.risk, suggested_change_percent: decision.suggestedChangePercent,
      rationale: decision.rationale, evidence: decision.signals, metrics_current: decision.currentMetrics,
      metrics_previous: decision.previousMetrics, generated_at: decision.generatedAt,
    }));
    const { error } = await auth.client.from("decision_history").upsert(rows, {
      onConflict: "ad_account_id,period_from,period_to,entity_type,entity_id,action,score", ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  return auth.status;
}
