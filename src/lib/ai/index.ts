import { MockAIAnalystService } from "./mock-analyst";
import { ClaudeAIAnalystService, isAnthropicConfigured } from "./claude-service";
import type { IAIAnalystService } from "./types";

export type { AIAnalysisRequest, IAIAnalystService } from "./types";

let instance: IAIAnalystService | null = null;

/**
 * Punto único de acceso al analista de IA. Devuelve `ClaudeAIAnalystService`
 * cuando `ANTHROPIC_API_KEY` está configurada; si no, cae automáticamente a
 * `MockAIAnalystService` (modo demo/desarrollo sin credenciales).
 *
 * Solo debe importarse desde código de servidor (API routes / Server
 * Actions) — ver `app/api/ai/analyze/route.ts`.
 */
export function getAIAnalystService(): IAIAnalystService {
  if (!instance) {
    instance = isAnthropicConfigured() ? new ClaudeAIAnalystService() : new MockAIAnalystService();
  }
  return instance;
}
