import "server-only";
import type { PerformanceMetrics } from "@/lib/types";
import type { AIAnalysisRequest, AIPerformanceRequest } from "./types";

/**
 * Tope de entidades que se envían al proveedor, ordenadas por gasto.
 * Controla el tamaño (y costo) del contexto en cuentas grandes sin perder
 * las entidades que más importan para el análisis.
 */
const MAX_ENTITIES = 20;

export const AI_ANALYST_SYSTEM_PROMPT = `Eres el "AI Performance Analyst" de ANLUX Ads Intelligence, un panel interno de agencia de marketing. Respondes en español a un gestor de cuentas publicitarias de Meta Ads que ya conoce el dashboard.

Trabajas en dos modos, indicados por el campo "modo" del mensaje del usuario:

MODO "performance" — el mensaje incluye datos reales de una cuenta (cliente, moneda cuando está disponible, periodo, métricas de cuenta, campañas, conjuntos de anuncios, anuncios destacados y alertas deterministas de ANLUX):
- Basa cada afirmación únicamente en esos datos estructurados. Nunca inventes cifras, nombres de campaña ni resultados que no aparezcan ahí.
- Interpreta todos los importes monetarios (gasto, CPC, CPM y costo por resultado) en la moneda indicada por "moneda_cuenta". Si "moneda_cuenta" es null, no asumas ninguna moneda ni presentes un símbolo monetario inventado.
- Las "alertas_anlux" son hallazgos calculados por reglas deterministas sobre los mismos datos reales. Úsalas como evidencia prioritaria, pero no inventes alertas adicionales como si las hubiera calculado el sistema.
- Prioriza hallazgos concretos y accionables (campañas, conjuntos de anuncios o anuncios específicos por nombre) sobre observaciones genéricas.
- "priority": "high" si hay gasto significativo sin resultados o una caída fuerte de performance; "medium" si hay un problema puntual pero acotado; "low" si el desempeño se mantiene estable.

MODO "general" — no hay ninguna cuenta seleccionada y NO dispones de ningún dato de campaña:
- Responde solo con criterio estratégico general sobre Meta Ads: estructura de campañas, objetivos, segmentación, creatividades, presupuesto, medición.
- No dispones de métricas. No inventes cifras, benchmarks numéricos, nombres de campaña ni resultados, y no des a entender que estás analizando datos de una cuenta.
- Si la pregunta exige datos concretos de una cuenta (por ejemplo "¿cuál es mi mejor anuncio?" o "¿dónde estoy desperdiciando presupuesto?"), dilo abiertamente en "summary": explica que hace falta seleccionar una cuenta y un periodo, y ofrece a continuación la orientación general que sí puedas dar.
- "priority" refleja la urgencia de lo que recomiendas, normalmente "low" o "medium": sin datos no puedes afirmar que algo sea crítico.

Reglas comunes a ambos modos:
- Eres exclusivamente de lectura y análisis: nunca digas ni sugieras que vas a crear, pausar, activar, editar o eliminar campañas, conjuntos de anuncios o anuncios — tus recomendaciones son para que la persona las ejecute, tú no ejecutas nada.
- Si el usuario incluyó una pregunta puntual, respóndela directamente en "summary" antes que nada.
- Los arreglos "issues", "opportunities" y "recommendations" pueden quedar vacíos si genuinamente no hay nada que reportar en esa categoría — no rellenes con relleno.`;

function hasActivity(metrics?: PerformanceMetrics): boolean {
  return Boolean(metrics && (metrics.spend > 0 || metrics.impressions > 0 || metrics.clicks > 0 || metrics.results > 0));
}

function topBySpend<T extends { id: string; status: string }>(
  items: T[],
  metricsById: Record<string, PerformanceMetrics>,
  limit: number
): T[] {
  return items
    .filter((item) => item.status !== "ARCHIVED" && (item.status === "ACTIVE" || hasActivity(metricsById[item.id])))
    .sort((a, b) => (metricsById[b.id]?.spend ?? 0) - (metricsById[a.id]?.spend ?? 0))
    .slice(0, limit);
}

function buildPerformancePayload(request: AIPerformanceRequest): object {
  const topCampaigns = topBySpend(request.campaigns, request.campaignMetrics, MAX_ENTITIES);
  const topAdSets = topBySpend(request.adSets, request.adSetMetrics, MAX_ENTITIES);
  const topAds = topBySpend(request.ads, request.adMetrics, MAX_ENTITIES);

  return {
    modo: "performance",
    cliente: request.client.name,
    industria: request.client.industry,
    moneda_cuenta: request.currency,
    periodo: request.dateRange,
    metricas_cuenta_periodo_actual: request.currentMetrics,
    metricas_cuenta_periodo_anterior: request.previousMetrics,
    alertas_anlux: request.alerts.map((alert) => ({
      severidad: alert.severity,
      titulo: alert.title,
      descripcion: alert.description,
      tipo_entidad: alert.entityType,
      entidad_id: alert.entityId ?? null,
      entidad_nombre: alert.entityName ?? null,
      metrica: alert.metric ?? null,
    })),
    campañas: topCampaigns.map((c) => ({
      id: c.id,
      nombre: c.name,
      estado: c.status,
      objetivo: c.objective,
      fecha_inicio: c.startDate ?? null,
      metricas: request.campaignMetrics[c.id],
    })),
    conjuntos_de_anuncios_destacados: topAdSets.map((a) => ({
      id: a.id,
      nombre: a.name,
      campaña_id: a.campaignId,
      estado: a.status,
      objetivo_optimizacion: a.optimizationGoal,
      fecha_inicio: a.startDate ?? null,
      metricas: request.adSetMetrics[a.id],
    })),
    anuncios_destacados: topAds.map((a) => ({
      id: a.id,
      nombre: a.name,
      estado: a.status,
      metricas: request.adMetrics[a.id],
    })),
    campañas_totales_en_la_cuenta: request.campaigns.length,
    conjuntos_de_anuncios_totales_en_la_cuenta: request.adSets.length,
    anuncios_totales_en_la_cuenta: request.ads.length,
    pregunta_usuario: request.question ?? "Analiza el performance general de la cuenta en este periodo.",
  };
}

/**
 * Payload que recibe el proveedor en el mensaje `user`, como JSON compacto.
 *
 * En modo general el payload deja constancia explícita de que no hay datos
 * disponibles, en vez de omitir los campos: así el modelo no puede
 * interpretar la ausencia como "no me los pasaron pero existen".
 */
export function buildUserPayload(request: AIAnalysisRequest): string {
  const payload =
    request.mode === "performance"
      ? buildPerformancePayload(request)
      : {
          modo: "general",
          cuenta_seleccionada: null,
          datos_de_campaña_disponibles: false,
          nota: "No hay ninguna cuenta de Meta Ads seleccionada. No dispones de métricas, campañas ni anuncios: responde solo con criterio estratégico general y no inventes cifras.",
          pregunta_usuario: request.question,
        };

  return JSON.stringify(payload, null, 2);
}
