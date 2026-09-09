import "server-only";
import type { DecisionEngineResult, PerformanceDecision } from "@/lib/decisions/types";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isMemoryEnabled } from "./config";

export type MemoryState = "disabled" | "unavailable" | "unauthorized" | "ready";

export interface MemoryStatus {
  state: MemoryState;
  enabled: boolean;
  message: string;
}

type AuthorizedClient = NonNullable<Awaited<ReturnType<typeof getAuthorizedClient>>["client"]>;

async function getAuthorizedClient() {
  if (!isMemoryEnabled()) {
    return {
      client: null,
      userId: null,
      status: { state: "disabled", enabled: false, message: "Memoria histórica desactivada por configuración." } satisfies MemoryStatus,
    };
  }

  const client = await getSupabaseServerClient();
  if (!client) {
    return {
      client: null,
      userId: null,
      status: { state: "unavailable", enabled: true, message: "Supabase no está configurado." } satisfies MemoryStatus,
    };
  }

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) {
    return {
      client: null,
      userId: null,
      status: { state: "unauthorized", enabled: true, message: "No existe una sesión válida para memoria histórica." } satisfies MemoryStatus,
    };
  }

  const { data: member, error: memberError } = await client
    .from("users")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (memberError || !member) {
    return {
      client: null,
      userId: authData.user.id,
      status: { state: "unauthorized", enabled: true, message: "El usuario autenticado no está autorizado como miembro de ANLUX." } satisfies MemoryStatus,
    };
  }

  return {
    client,
    userId: authData.user.id,
    status: { state: "ready", enabled: true, message: "Memoria histórica disponible." } satisfies MemoryStatus,
  };
}

export async function getMemoryStatus(): Promise<MemoryStatus> {
  return (await getAuthorizedClient()).status;
}

async function ensureAccount(client: AuthorizedClient, accountId: string, currency?: string | null) {
  const { error } = await client.from("meta_ad_accounts").upsert(
    { id: accountId, currency: currency ?? null, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (error) throw error;
}

function campaignTotals(decisions: PerformanceDecision[]) {
  return decisions
    .filter((decision) => decision.entityType === "campaign")
    .reduce(
      (acc, decision) => {
        acc.spend += decision.currentMetrics.spend;
        acc.impressions += decision.currentMetrics.impressions;
        acc.reach += decision.currentMetrics.reach;
        acc.clicks += decision.currentMetrics.clicks;
        acc.results += decision.currentMetrics.results;
        return acc;
      },
      { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 }
    );
}

export async function saveBusinessGoals(accountId: string, goals: BusinessGoals): Promise<MemoryStatus> {
  const auth = await getAuthorizedClient();
  if (!auth.client) return auth.status;

  await ensureAccount(auth.client, accountId);
  const { error } = await auth.client.from("business_goals").upsert(
    {
      ad_account_id: accountId,
      target_cost_per_result: goals.targetCostPerResult ?? null,
      minimum_roas: goals.minimumRoas ?? null,
      monthly_budget: goals.monthlyBudget ?? null,
      gross_margin_percent: goals.grossMarginPercent ?? null,
      risk_tolerance: goals.riskTolerance ?? "balanced",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ad_account_id" }
  );
  if (error) throw error;
  return auth.status;
}

export async function persistIntelligenceMemory(
  decisionResult: DecisionEngineResult,
  suite: IntelligenceSuiteResult,
  goals: BusinessGoals
): Promise<MemoryStatus> {
  const auth = await getAuthorizedClient();
  if (!auth.client) return auth.status;

  const accountId = decisionResult.accountId;
  const totals = campaignTotals(decisionResult.decisions);
  await ensureAccount(auth.client, accountId, decisionResult.currency);

  const hasGoalValue =
    goals.targetCostPerResult != null ||
    goals.minimumRoas != null ||
    goals.monthlyBudget != null ||
    goals.grossMarginPercent != null ||
    goals.riskTolerance != null;
  if (hasGoalValue) await saveBusinessGoals(accountId, goals);

  const { error: observationError } = await auth.client.from("account_period_observations").upsert(
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
      captured_at: new Date().toISOString(),
    },
    { onConflict: "ad_account_id,period_from,period_to" }
  );
  if (observationError) throw observationError;

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
    }));

    const { error: decisionsError } = await auth.client.from("decision_history").upsert(rows, {
      onConflict: "ad_account_id,period_from,period_to,entity_type,entity_id,action,score",
      ignoreDuplicates: true,
    });
    if (decisionsError) throw decisionsError;
  }

  return auth.status;
}

export async function loadBusinessGoals(accountId: string): Promise<{ goals: BusinessGoals | null; status: MemoryStatus }> {
  const auth = await getAuthorizedClient();
  if (!auth.client) return { goals: null, status: auth.status };

  const { data, error } = await auth.client
    .from("business_goals")
    .select("target_cost_per_result,minimum_roas,monthly_budget,gross_margin_percent,risk_tolerance")
    .eq("ad_account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { goals: null, status: auth.status };

  return {
    goals: {
      targetCostPerResult: data.target_cost_per_result == null ? null : Number(data.target_cost_per_result),
      minimumRoas: data.minimum_roas == null ? null : Number(data.minimum_roas),
      monthlyBudget: data.monthly_budget == null ? null : Number(data.monthly_budget),
      grossMarginPercent: data.gross_margin_percent == null ? null : Number(data.gross_margin_percent),
      riskTolerance:
        data.risk_tolerance === "conservative" || data.risk_tolerance === "growth" ? data.risk_tolerance : "balanced",
    },
    status: auth.status,
  };
}

export async function saveDecisionFeedback(input: {
  decisionId: number;
  outcome: "accepted" | "rejected" | "deferred";
  notes?: string;
  observedResult?: Record<string, unknown> | null;
}): Promise<MemoryStatus> {
  const auth = await getAuthorizedClient();
  if (!auth.client || !auth.userId) return auth.status;

  const { error } = await auth.client.from("decision_feedback").upsert(
    {
      decision_id: input.decisionId,
      reviewed_by: auth.userId,
      outcome: input.outcome,
      notes: input.notes?.trim() || null,
      observed_result: input.observedResult ?? null,
    },
    { onConflict: "decision_id,reviewed_by" }
  );
  if (error) throw error;
  return auth.status;
}
