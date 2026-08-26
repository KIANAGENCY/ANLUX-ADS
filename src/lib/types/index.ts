/**
 * Modelos de dominio compartidos por toda la aplicación.
 *
 * Estos tipos representan la forma "canónica" de los datos, independientemente
 * de si provienen del servicio mock (`lib/mock`) o, en el futuro, de la Meta
 * Marketing API real (`lib/meta`). Cualquier UI o lógica de negocio debe
 * consumir únicamente estos tipos, nunca la forma cruda de la respuesta de
 * un proveedor externo.
 */

// ---------------------------------------------------------------------------
// Cliente / cuenta publicitaria
// ---------------------------------------------------------------------------

export interface Client {
  id: string;
  name: string;
  slug: string;
  industry: string;
  /** Iniciales para el avatar cuando no hay logo. */
  initials: string;
  /** Color de acento por cliente, usado en pequeños detalles de UI. */
  accentColor: string;
  adAccountId: string;
}

export interface AdAccount {
  id: string;
  clientId: string;
  /** ID de cuenta en Meta, formato "act_XXXXXXXXXX". Placeholder en modo mock. */
  metaAccountId: string;
  currency: string;
  timezone: string;
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
  | "SALES";

export interface Campaign {
  id: string;
  adAccountId: string;
  name: string;
  status: EntityStatus;
  objective: CampaignObjective;
  dailyBudget: number;
  startDate: string; // YYYY-MM-DD
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  status: EntityStatus;
  dailyBudget: number;
  /** Descripción legible de la audiencia objetivo. */
  audience: string;
  optimizationGoal: string;
  startDate: string; // YYYY-MM-DD
}

export type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL";

export interface Ad {
  id: string;
  adSetId: string;
  campaignId: string;
  name: string;
  status: EntityStatus;
  creativeType: CreativeType;
  /** Gradiente/color usado como placeholder visual del creativo. */
  previewGradient: string;
  startDate: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export type EntityType = "account" | "campaign" | "adset" | "ad";

/**
 * Fila de métricas "en bruto" para un día y una entidad concreta.
 * Es la unidad mínima a partir de la cual se derivan todas las métricas
 * agregadas (PerformanceMetrics) para cualquier rango de fechas.
 */
export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  entityId: string;
  entityType: EntityType;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
}

/**
 * Métricas de performance agregadas/derivadas para un rango de fechas.
 * Se calcula siempre a partir de DailyMetrics[], nunca se almacena "a mano".
 */
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

/**
 * Compara el periodo actual contra el periodo anterior equivalente.
 * `changePercent` puede ser `null` para una métrica cuando el periodo
 * anterior no tiene datos suficientes (evita divisiones por cero).
 */
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
  createdAt: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Análisis con IA (Claude)
// ---------------------------------------------------------------------------

export type AIAnalysisPriority = "low" | "medium" | "high";

export interface AIAnalysis {
  summary: string;
  issues: string[];
  opportunities: string[];
  recommendations: string[];
  priority: AIAnalysisPriority;
  generatedAt: string; // ISO datetime
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
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}
