import type { DecisionConfidence, PerformanceDecision } from "@/lib/decisions/types";

export interface BusinessGoals {
  targetCostPerResult?: number | null;
  minimumRoas?: number | null;
  monthlyBudget?: number | null;
  grossMarginPercent?: number | null;
  riskTolerance?: "conservative" | "balanced" | "growth";
}

export interface IntelligenceAnomaly {
  entityId: string;
  entityName: string;
  severity: "info" | "warning" | "critical";
  metric: string;
  changePercent: number;
  message: string;
}

export interface BudgetRecommendation {
  fromEntityId: string | null;
  fromEntityName: string | null;
  toEntityId: string;
  toEntityName: string;
  suggestedPercent: number;
  confidence: DecisionConfidence;
  rationale: string;
}

export interface CreativeInsight {
  adId: string;
  adName: string;
  status: "winner" | "healthy" | "fatigue_risk" | "needs_refresh";
  score: number;
  message: string;
}

export interface ExperimentProposal {
  id: string;
  entityId: string;
  entityName: string;
  hypothesis: string;
  variable: "creative" | "audience" | "budget";
  guardrail: string;
  successMetric: string;
}

export interface Forecast {
  basis: "current_period_run_rate" | "insufficient_data";
  projectedResults: number | null;
  projectedSpend: number | null;
  uncertaintyPercent: number;
  warning: string | null;
}

export interface LearningGuard {
  entityId: string;
  entityName: string;
  blocked: boolean;
  reason: string | null;
}

export interface MorningBrief {
  headline: string;
  attention: string[];
  healthy: string[];
}

export interface IntelligenceSuiteResult {
  generatedAt: string;
  goals: BusinessGoals;
  decisions: PerformanceDecision[];
  anomalies: IntelligenceAnomaly[];
  budgetRecommendations: BudgetRecommendation[];
  creativeInsights: CreativeInsight[];
  experiments: ExperimentProposal[];
  learningGuards: LearningGuard[];
  forecast: Forecast;
  brief: MorningBrief;
  executionMode: "recommend_only";
  limitations: string[];
}
