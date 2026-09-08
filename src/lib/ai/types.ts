import type { Ad, AdSet, AIAnalysis, Campaign, Client, DateRange, PerformanceMetrics } from "@/lib/types";

/**
 * Análisis de rendimiento sobre una cuenta concreta. Se construye en el
 * servidor (ver `app/api/ai/analyze/route.ts`) a partir de Meta Marketing
 * API: todas las cifras que llegan aquí son reales.
 */
export interface AIPerformanceRequest {
  mode: "performance";
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

/**
 * Consulta estratégica general, sin cuenta seleccionada. No lleva ninguna
 * métrica porque no se consulta Meta: el proveedor solo dispone de la
 * pregunta y debe responder con criterio general, nunca con cifras.
 *
 * La pregunta es obligatoria: sin datos y sin pregunta no habría nada que
 * responder.
 */
export interface AIGeneralRequest {
  mode: "general";
  question: string;
}

/**
 * Los dos modos son excluyentes por construcción: es imposible construir una
 * petición "general" que arrastre métricas, o una de "performance" sin ellas.
 */
export type AIAnalysisRequest = AIPerformanceRequest | AIGeneralRequest;

export interface IAIAnalystService {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysis>;
}
