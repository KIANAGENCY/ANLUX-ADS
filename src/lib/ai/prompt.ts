import "server-only";
import type { PerformanceMetrics } from "@/lib/types";
import type { AIAnalysisRequest } from "./types";

/**
 * Tope de campañas/anuncios que se envían a Claude, ordenados por gasto.
 * Controla el tamaño (y costo) del contexto en cuentas grandes sin perder
 * las entidades que más importan para el análisis.
 */
const MAX_ENTITIES = 20;

export const AI_ANALYST_SYSTEM_PROMPT = `Eres el "AI Performance Analyst" de ANLUX Ads Intelligence, un panel interno de agencia de marketing. Analizas métricas de campañas de Meta Ads (reales o de demostración) y devuelves un análisis útil y accionable en español, dirigido a un gestor de cuentas publicitarias que ya conoce el dashboard.

Reglas estrictas:
- Basa cada afirmación únicamente en los datos estructurados del mensaje del usuario (JSON con cliente, periodo, métricas de cuenta, campañas y anuncios destacados). Nunca inventes cifras, nombres de campaña ni resultados que no aparezcan ahí.
- Eres exclusivamente de lectura y análisis: nunca dijas ni sugieras que vas a crear, pausar, activar, editar o eliminar campañas, conjuntos de anuncios o anuncios — tus recomendaciones son para que la persona las ejecute, tú no ejecutas nada.
- Si el usuario incluyó una pregunta puntual, respóndela directamente en "summary" antes que nada; si no, da un resumen general del periodo.
- Prioriza hallazgos concretos y accionables (campañas o anuncios específicos por nombre) sobre observaciones genéricas.
- "priority": "high" si hay gasto significativo sin resultados o una caída fuerte de performance; "medium" si hay un problema puntual pero acotado; "low" si el desempeño se mantiene estable.
- Los arreglos "issues", "opportunities" y "recommendations" pueden quedar vacíos si genuinamente no hay nada que reportar en esa categoría — no rellenes con relleno.`;

function topBySpend<T extends { id: string }>(
  items: T[],
  metricsById: Record<string, PerformanceMetrics>,
  limit: number
): T[] {
  return [...items]
    .sort((a, b) => (metricsById[b.id]?.spend ?? 0) - (metricsById[a.id]?.spend ?? 0))
    .slice(0, limit);
}

/** Payload de datos que recibe Claude en el mensaje `user`, como JSON compacto. */
export function buildUserPayload(request: AIAnalysisRequest): string {
  const topCampaigns = topBySpend(request.campaigns, request.campaignMetrics, MAX_ENTITIES);
  const topAds = topBySpend(request.ads, request.adMetrics, MAX_ENTITIES);

  const payload = {
    cliente: request.client.name,
    industria: request.client.industry,
    periodo: request.dateRange,
    metricas_cuenta_periodo_actual: request.currentMetrics,
    metricas_cuenta_periodo_anterior: request.previousMetrics,
    campañas: topCampaigns.map((c) => ({
      id: c.id,
      nombre: c.name,
      estado: c.status,
      objetivo: c.objective,
      metricas: request.campaignMetrics[c.id],
    })),
    anuncios_destacados: topAds.map((a) => ({
      id: a.id,
      nombre: a.name,
      estado: a.status,
      metricas: request.adMetrics[a.id],
    })),
    campañas_totales_en_la_cuenta: request.campaigns.length,
    pregunta_usuario: request.question ?? "Analiza el performance general de la cuenta en este periodo.",
  };

  return JSON.stringify(payload, null, 2);
}
