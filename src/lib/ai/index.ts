import { ClaudeAIAnalystService } from "./claude-service";
import type { IAIAnalystService } from "./types";

export type { AIAnalysisRequest, IAIAnalystService } from "./types";

let instance: IAIAnalystService | null = null;

/**
 * Punto único de acceso al analista de IA: siempre Claude sobre datos reales
 * de Meta. No existe implementación simulada — si `ANTHROPIC_API_KEY` no está
 * configurada, la llamada falla con un error explícito en vez de devolver un
 * análisis inventado.
 *
 * Solo debe importarse desde código de servidor (API routes / Server
 * Actions) — ver `app/api/ai/analyze/route.ts`.
 */
export function getAIAnalystService(): IAIAnalystService {
  if (!instance) {
    instance = new ClaudeAIAnalystService();
  }
  return instance;
}
