import type { Ad, AdSet, AIAnalysis, Campaign, Client, DateRange, PerformanceMetrics } from "@/lib/types";

/**
 * Todo lo que el analista de IA necesita para razonar sobre una cuenta.
 * Se construye en el servidor (ver `app/api/ai/analyze/route.ts`) a partir
 * de `getMetaAdsService()` y se pasa tal cual a la implementación de
 * `IAIAnalystService` (mock o Claude real).
 */
export interface AIAnalysisRequest {
  client: Client;
  dateRange: DateRange;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  currentMetrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics;
  /** Métricas del periodo actual por campaña y por anuncio, para poder señalar casos concretos. */
  campaignMetrics: Record<string, PerformanceMetrics>;
  adMetrics: Record<string, PerformanceMetrics>;
  /** Pregunta puntual del usuario en el chat, si la hay (modo libre vs "analiza todo"). */
  question?: string;
}

export interface IAIAnalystService {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysis>;
}
