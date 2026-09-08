/**
 * Modelos de dominio compartidos por toda la aplicación.
 *
 * Estos tipos representan la forma "canónica" de los datos, independientemente
 * de si provienen de Meta Marketing API o de futuras fuentes de datos.
 */

// ---------------------------------------------------------------------------
// Cliente / cuenta publicitaria
// ---------------------------------------------------------------------------

export interface Client {
  id: string;
  name: string;
  slug: string;
  industry: string;
  initials: string;
  accentColor: string;
  adAccountId: string;
}

export interface AdAccount {
  id: string;
  clientId: string;
  metaAccountId: string;
  currency: string;
  timezone: string;
}

export interface MetaAdAccountSummary {
  id: string;
  name: string;
  accountStatus: number;
  /** Código ISO real devuelto por Meta; null si el proveedor lo omite. */
  currency: string | null;
}

// ---------------------------------------------------------------------------
// Jerarquía de campañas (Campaign > AdSet > Ad)
// ---------------------------------------------------------------------------

export type EntityStatus = "ACTIVE" | "PAUSED" | "IN_REVIEW" | "ARCHIVED";

export type CampaignObjective =
  | "LEAD_GENERATION"
  | "MESSAGES"
  | "CONVERSIONS"
  | "TRAFFIC"
  | "BRAND_AWARENESS"
  | "SALES"
  | "UNKNOWN";

export interface Campaign {
  id: string;
  adAccountId: string;
  name: string;
  status: EntityStatus;
  effectiveStatus?: string;
  objective: CampaignObjective;
  /** Valor crudo de Meta antes de normalizar; se conserva para diagnóstico. */
  rawObjective?: string;
  dailyBudget: number | null;
  lifetimeBudget?: number | null;
  startDate?: string;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  status: EntityStatus;
  effectiveStatus?: string;
  dailyBudget: number | null;
  lifetimeBudget?: number | null;
  audience: string;
  optimizationGoal: string;
  startDate?: string;
}

export type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL";

export interface Ad {
  id: string;
  adSetId: string;
  campaignId: string;
  name: string;
  status: EntityStatus;
  effectiveStatus?: string;
  creativeType: CreativeType;
  previewGradient: string;
  startDate?: string;
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export type EntityType = "account" | "campaign" | "adset" | "ad";

export interface DailyMetrics {
  date: string;
  entityId: string;
  entityType: EntityType;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
}

export interface PerformanceMetrics {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  results: number;
  frequency: number;
  cpm: number;
  ctr: number;
  cpc: number;
  costPerResult: number;
}

export type MetricKey = keyof PerformanceMetrics;

export interface MetricComparison {
  current: PerformanceMetrics;
  previous: PerformanceMetrics;
  changePercent: Record<MetricKey, number | null>;
}

// ---------------------------------------------------------------------------
// Alertas de performance
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";

export interface PerformanceAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  metric?: MetricKey;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Análisis con IA
// ---------------------------------------------------------------------------

export type AIAnalysisPriority = "low" | "medium" | "high";

export interface AIAnalysis {
  summary: string;
  issues: string[];
  opportunities: string[];
  recommendations: string[];
  priority: AIAnalysisPriority;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Filtros de fecha
// ---------------------------------------------------------------------------

export type DateRangePreset =
  | "today"
  | "last7"
  | "last14"
  | "last30"
  | "thisMonth"
  | "lastMonth";

export interface DateRange {
  from: string;
  to: string;
}
