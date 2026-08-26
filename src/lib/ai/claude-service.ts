import type { AIAnalysis } from "@/lib/types";
import type { AIAnalysisRequest, IAIAnalystService } from "./types";

/**
 * Implementación real, pendiente de conectar con la API de Anthropic (Claude).
 *
 * IMPORTANTE — seguridad:
 *   - `ANTHROPIC_API_KEY` es un secreto de servidor. Este archivo SOLO debe
 *     ejecutarse en servidor (API routes / Server Actions), nunca en un
 *     componente "use client".
 *   - El frontend nunca debe llamar a Anthropic directamente: siempre pasa
 *     por `POST /api/ai/analyze` (ver `app/api/ai/analyze/route.ts`), que es
 *     quien invoca este servicio desde el servidor.
 *
 * Para activarlo en el futuro:
 *   1. `npm install @anthropic-ai/sdk`
 *   2. Definir `ANTHROPIC_API_KEY` en `.env.local`.
 *   3. Implementar `analyze()` construyendo un prompt a partir de
 *      `AIAnalysisRequest` (cliente, rango, campañas, ad sets, ads y
 *      métricas agregadas) y parseando la respuesta de Claude al tipo
 *      `AIAnalysis`.
 *   4. Actualizar `getAIAnalystService()` en `lib/ai/index.ts` para
 *      devolver esta clase cuando `isAnthropicConfigured()` sea `true`.
 */
export class ClaudeAIAnalystService implements IAIAnalystService {
  async analyze(_request: AIAnalysisRequest): Promise<AIAnalysis> {
    throw new Error(
      "ClaudeAIAnalystService no está implementado todavía. Configura ANTHROPIC_API_KEY y completa lib/ai/claude-service.ts."
    );
  }
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
