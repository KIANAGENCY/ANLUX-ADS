import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AIAnalysis } from "@/lib/types";
import type { AIAnalysisRequest, IAIAnalystService } from "./types";
import { AIAnalysisSchema } from "./schema";
import { AI_ANALYST_SYSTEM_PROMPT, buildUserPayload } from "./prompt";

/**
 * Sonnet 5: para este caso de uso (análisis estructurado sobre datos ya
 * organizados, no razonamiento agéntico abierto) rinde muy cerca de Opus 5
 * a una fracción del costo. Ver la discusión de modelo en la conversación
 * que aprobó esta integración.
 */
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2000;

export type AIAnalystErrorKind = "rate_limited" | "auth" | "connection" | "invalid_response" | "refusal" | "unknown";

/** Error tipado para fallos al hablar con Anthropic — mismo patrón que `MetaApiError`. */
export class AIAnalystError extends Error {
  readonly kind: AIAnalystErrorKind;
  constructor(kind: AIAnalystErrorKind, message: string) {
    super(message);
    this.name = "AIAnalystError";
    this.kind = kind;
  }
}

/**
 * Implementación real del AI Performance Analyst, respaldada por la API de
 * Anthropic (Claude).
 *
 * Seguridad:
 *   - `ANTHROPIC_API_KEY` es un secreto de servidor, leído únicamente por el
 *     SDK de Anthropic (nunca se referencia explícitamente en este archivo).
 *     `import "server-only"` hace fallar el build si este módulo se importa
 *     por error desde un componente cliente.
 *   - Esta llamada NO declara ningún `tools`: es de una sola vuelta
 *     (datos → JSON de análisis), sin bucle agéntico. Sin herramientas
 *     declaradas, Claude no tiene ningún mecanismo para invocar nada —
 *     mucho menos modificar una campaña de Meta. Es de solo lectura por
 *     construcción, no solo por instrucción de prompt.
 *   - El frontend nunca llama a Anthropic directamente: siempre pasa por
 *     `POST /api/ai/analyze`, que es quien invoca este servicio.
 */
export class ClaudeAIAnalystService implements IAIAnalystService {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysis> {
    const client = new Anthropic();

    let response;
    try {
      response = await client.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: AI_ANALYST_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: {
          format: zodOutputFormat(AIAnalysisSchema),
          effort: "medium",
        },
        messages: [{ role: "user", content: buildUserPayload(request) }],
      });
    } catch (err) {
      throw translateAnthropicError(err);
    }

    if (response.stop_reason === "refusal") {
      throw new AIAnalystError(
        "refusal",
        "Claude no pudo generar un análisis para esta consulta. Intenta reformular la pregunta."
      );
    }

    if (!response.parsed_output) {
      throw new AIAnalystError(
        "invalid_response",
        "Claude devolvió una respuesta que no se pudo interpretar. Intenta de nuevo."
      );
    }

    return {
      ...response.parsed_output,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Traduce excepciones del SDK de Anthropic a errores con mensaje seguro
 * para mostrar al usuario — nunca se propaga el detalle crudo de Anthropic
 * (que podría incluir metadatos internos) ni, por supuesto, la API key.
 */
function translateAnthropicError(err: unknown): AIAnalystError {
  if (err instanceof Anthropic.RateLimitError) {
    return new AIAnalystError("rate_limited", "Se alcanzó el límite de solicitudes a Claude. Intenta de nuevo en unos minutos.");
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("[ai] ANTHROPIC_API_KEY inválida o rechazada por Anthropic.");
    return new AIAnalystError("auth", "No se pudo autenticar con el servicio de IA. Contacta al administrador.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AIAnalystError("connection", "No se pudo conectar con el servicio de IA. Revisa la conexión e inténtalo de nuevo.");
  }
  if (err instanceof Anthropic.APIError) {
    console.error("[ai] error de Anthropic:", err.status, err.message);
    return new AIAnalystError("unknown", "El servicio de IA devolvió un error inesperado. Intenta de nuevo.");
  }
  console.error("[ai] error inesperado llamando a Claude:", err instanceof Error ? err.message : "desconocido");
  return new AIAnalystError("unknown", "No se pudo generar el análisis. Intenta de nuevo.");
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
