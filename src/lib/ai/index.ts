import { ClaudeAIAnalystService } from "./claude-service";
import { GeminiAIAnalystService } from "./gemini-service";
import { resolveAIProvider, type AIProvider } from "./config";
import type { IAIAnalystService } from "./types";

export type { AIAnalysisRequest, IAIAnalystService } from "./types";
export type { AIProvider } from "./config";

const instances = new Map<AIProvider, IAIAnalystService>();

/**
 * Punto único de acceso al analista de IA. El proveedor lo elige
 * `AI_PROVIDER` (`anthropic` por defecto, `gemini` como alternativa); ver
 * `config.ts`.
 *
 * Ambas implementaciones cumplen `IAIAnalystService`, comparten el mismo
 * prompt y validan su salida contra `AIAnalysisSchema`, así que el contrato
 * de `/api/ai/analyze` y el frontend son idénticos en los dos casos.
 *
 * No hay fallback entre proveedores ni implementación simulada: si el
 * proveedor activo falla, el error se propaga tal cual. Un `AI_PROVIDER`
 * inválido lanza un error de configuración desde `resolveAIProvider()`.
 *
 * Solo debe importarse desde código de servidor (API routes / Server
 * Actions) — ver `app/api/ai/analyze/route.ts`.
 */
export function getAIAnalystService(): IAIAnalystService {
  const provider = resolveAIProvider();

  const existing = instances.get(provider);
  if (existing) return existing;

  const instance: IAIAnalystService =
    provider === "gemini" ? new GeminiAIAnalystService() : new ClaudeAIAnalystService();
  instances.set(provider, instance);
  return instance;
}
