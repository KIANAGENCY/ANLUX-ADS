import { persistSnapshot } from "./persist-snapshot";
import "server-only";
import type { DecisionEngineResult } from "@/lib/decisions/types";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";
import { isMemoryEnabled } from "./config";
import type { MemoryStatus } from "./repository";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

function unavailable(message: string): MemoryStatus {
  return { state: "unavailable", enabled: true, message };
}

function clientStatus(): { client: NonNullable<ReturnType<typeof getSupabaseServiceClient>> | null; status: MemoryStatus } {
  if (!isMemoryEnabled()) return { client: null, status: { state: "disabled", enabled: false, message: "Memoria histórica desactivada por configuración." } };
  const client = getSupabaseServiceClient();
  return client
    ? { client, status: { state: "ready", enabled: true, message: "Memoria histórica disponible para proceso programado." } }
    : { client: null, status: unavailable("SUPABASE_SECRET_KEY o la URL de Supabase no están configuradas para el proceso programado.") };
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
  await persistSnapshot(auth.client, decisionResult, suite);
  return auth.status;
}
