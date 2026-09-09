import type { CampaignObjective, EntityType, PerformanceMetrics } from "@/lib/types";

export type DecisionAction =
  | "SCALE"
  | "MAINTAIN"
  | "WATCH"
  | "REDUCE"
  | "PAUSE_CANDIDATE"
  | "REFRESH_CREATIVE"
  | "REVIEW_AUDIENCE"
  | "INSUFFICIENT_DATA";

export type DecisionConfidence = "low" | "medium" | "high";
export type DecisionRisk = "low" | "medium" | "high";

export interface DecisionSignal {
  code: string;
  label: string;
  detail: string;
  impact: number;
}

export interface PerformanceDecision {
  id: string;
  entityType: Exclude<EntityType, "account">;
  entityId: string;
  entityName: string;
  campaignId: string;
  campaignName: string;
  objective: CampaignObjective;
  action: DecisionAction;
  score: number;
  confidence: DecisionConfidence;
  risk: DecisionRisk;
  suggestedChangePercent: number | null;
  rationale: string;
  signals: DecisionSignal[];
  currentMetrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  generatedAt: string;
}

export interface DecisionEngineSummary {
  total: number;
  scale: number;
  maintain: number;
  watch: number;
  reduce: number;
  pauseCandidate: number;
  refreshCreative: number;
  reviewAudience: number;
  insufficientData: number;
  highConfidence: number;
}

export interface DecisionEngineResult {
  accountId: string;
  currency: string | null;
  from: string;
  to: string;
  generatedAt: string;
  summary: DecisionEngineSummary;
  decisions: PerformanceDecision[];
}

export interface DecisionEntityInput {
  entityType: "campaign" | "adset" | "ad";
  entityId: string;
  entityName: string;
  campaignId: string;
  campaignName: string;
  objective: CampaignObjective;
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
}
