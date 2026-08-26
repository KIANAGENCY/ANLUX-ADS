import { MockAIAnalystService } from "./mock-analyst";
import type { IAIAnalystService } from "./types";

export type { AIAnalysisRequest, IAIAnalystService } from "./types";

let instance: IAIAnalystService | null = null;

/**
 * Punto único de acceso al analista de IA. Igual que `getMetaAdsService()`,
 * hoy siempre devuelve la implementación mock. Cuando `lib/ai/claude-service.ts`
 * esté completo, este es el único lugar que hay que tocar:
 *
 *   if (isAnthropicConfigured()) return new ClaudeAIAnalystService();
 *
 * Solo debe importarse desde código de servidor (API routes / Server Actions).
 */
export function getAIAnalystService(): IAIAnalystService {
  if (!instance) {
    instance = new MockAIAnalystService();
  }
  return instance;
}
