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
  /** Exact Meta action used as this period's primary result. */
  resultType?: string | null;
  previousResultType?: string | null;
  action: DecisionAction;
  score: number;
  confidence: DecisionConfidence;
  risk: DecisionRisk;
  suggestedChangePercent: number | null;
  rationale: string;
  signals: DecisionSignal[];
  currentMetrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  /** True only when Meta returned the objective-specific primary result action. */
  currentResultsAvailable?: boolean;
  previousResultsAvailable?: boolean;
  /** Fecha de inicio informada por Meta, para proteger la fase de aprendizaje. */
  startDate?: string | null;
  generatedAt: string;
}

export interface PortfolioRecommendation {
  id: string;
  action: "COMPARE_QUALITY" | "TEST_REALLOCATION";
  fromCampaignId: string;
  fromCampaignName: string;
  toCampaignId: string;
  toCampaignName: string;
  resultType: string;
  currentFromCost: number;
  currentToCost: number;
  currentFromResults: number;
  currentToResults: number;
  relativeCostGapPercent: number;
  explanation: string;
  nextStep: string;
  safeguard: string;
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
  portfolioRecommendations: PortfolioRecommendation[];
  /** Verified account-level totals from Meta; absent when Meta omits the account row. */
  accountMetrics?: Pick<PerformanceMetrics, "spend" | "impressions" | "reach" | "clicks" | "results">;
}

export interface DecisionEntityInput {
  entityType: "campaign" | "adset" | "ad";
  entityId: string;
  entityName: string;
  campaignId: string;
  campaignName: string;
  objective: CampaignObjective;
  resultType?: string | null;
  previousResultType?: string | null;
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
  /** False means results is structural only and must never be read as a zero. */
  currentResultsAvailable?: boolean;
  previousResultsAvailable?: boolean;
  /** Start date supplied by Meta for the parent campaign or the entity itself. */
  startDate?: string | null;
  /** A human-confirmed target; never an unconfirmed automatic proposal. */
  targetCostPerResult?: number | null;
  /** Typical confirmed account cost when historical memory is available. */
  typicalCostPerResult?: number | null;
  /** Account comparison value, present only when it comes from real account data. */
  accountAverageCpc?: number | null;
}
