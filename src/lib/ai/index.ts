import { ClaudeAIAnalystService } from "./claude-service";
import { GeminiAIAnalystService } from "./gemini-service";
import { isAnthropicConfigured, resolveAIProvider, type AIProvider } from "./config";
import { AIAnalystError, type AIAnalystErrorKind } from "./errors";
import type { AIAnalysisRequest, IAIAnalystService } from "./types";
import type { AIAnalysis } from "@/lib/types";

export type { AIAnalysisRequest, IAIAnalystService } from "./types";
export type { AIProvider } from "./config";

const instances = new Map<AIProvider, IAIAnalystService>();

const GEMINI_RETRY_DELAYS_MS = [300, 900] as const;
const RETRYABLE_GEMINI_ERRORS: ReadonlySet<AIAnalystErrorKind> = new Set([
  "rate_limited",
  "connection",
  "invalid_response",
  "unknown",
]);
const FALLBACK_GEMINI_ERRORS: ReadonlySet<AIAnalystErrorKind> = new Set([
  ...RETRYABLE_GEMINI_ERRORS,
  "auth",
]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini es el proveedor económico principal, pero los 429/5xx de capacidad
 * no deben dejar inutilizable el analista. Reintenta únicamente fallos
 * transitorios y, si persisten, usa Claude cuando su credencial está
 * disponible. Los rechazos de contenido y los errores de configuración no se
 * ocultan con un fallback.
 */
class ResilientGeminiAIAnalystService implements IAIAnalystService {
  constructor(
    private readonly primary: IAIAnalystService,
    private readonly fallback: IAIAnalystService
  ) {}

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysis> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await this.primary.analyze(request);
      } catch (error) {
        lastError = error;
        const canRetry =
          error instanceof AIAnalystError &&
          RETRYABLE_GEMINI_ERRORS.has(error.kind) &&
          attempt < GEMINI_RETRY_DELAYS_MS.length;

        if (!canRetry) break;

        console.warn(`[ai] Gemini no disponible; reintento ${attempt + 1}/${GEMINI_RETRY_DELAYS_MS.length}.`);
        await wait(GEMINI_RETRY_DELAYS_MS[attempt]);
      }
    }

    const canFallback =
      lastError instanceof AIAnalystError &&
      FALLBACK_GEMINI_ERRORS.has(lastError.kind) &&
      isAnthropicConfigured();

    if (!canFallback) throw lastError;

    console.warn("[ai] Gemini siguió sin responder; usando Claude como fallback.");
    return this.fallback.analyze(request);
  }
}

/**
 * Punto único de acceso al analista de IA. El proveedor lo elige
 * `AI_PROVIDER` (`anthropic` por defecto, `gemini` como alternativa); ver
 * `config.ts`.
 *
 * Ambas implementaciones cumplen `IAIAnalystService`, comparten el mismo
 * prompt y validan su salida contra `AIAnalysisSchema`, así que el contrato
 * de `/api/ai/analyze` y el frontend son idénticos en los dos casos.
 *
 * Cuando Gemini es el proveedor activo, los fallos transitorios se reintentan
 * y después se usa Claude como fallback si `ANTHROPIC_API_KEY` está
 * configurada. No se generan respuestas simuladas. Un `AI_PROVIDER` inválido
 * lanza un error de configuración desde `resolveAIProvider()`.
 *
 * Solo debe importarse desde código de servidor (API routes / Server
 * Actions) — ver `app/api/ai/analyze/route.ts`.
 */
export function getAIAnalystService(): IAIAnalystService {
  const provider = resolveAIProvider();

  const existing = instances.get(provider);
  if (existing) return existing;

  const instance: IAIAnalystService = provider === "gemini"
    ? new ResilientGeminiAIAnalystService(new GeminiAIAnalystService(), new ClaudeAIAnalystService())
    : new ClaudeAIAnalystService();
  instances.set(provider, instance);
  return instance;
}
