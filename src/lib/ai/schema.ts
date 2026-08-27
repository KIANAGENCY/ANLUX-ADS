import "server-only";
import { z } from "zod";

/**
 * Schema del `AIAnalysis` que le pedimos a Claude que produzca (vía
 * `output_config.format` / `messages.parse`, ver `claude-service.ts`).
 * Se valida automáticamente contra la respuesta — si Claude no puede
 * producir algo que cumpla este schema, `parsed_output` viene `null` y lo
 * tratamos como una respuesta inválida (ver manejo de errores).
 *
 * No incluye `generatedAt`: ese campo lo genera nuestro propio código con la
 * hora del servidor, nunca se le pide al modelo (evita depender de que
 * Claude "sepa" la fecha/hora exacta).
 */
export const AIAnalysisSchema = z.object({
  summary: z.string().describe("Resumen ejecutivo del análisis, en español, 2-4 frases."),
  issues: z.array(z.string()).describe("Problemas concretos detectados en los datos. Vacío si no hay ninguno."),
  opportunities: z
    .array(z.string())
    .describe("Oportunidades de mejora concretas detectadas en los datos. Vacío si no hay ninguna."),
  recommendations: z
    .array(z.string())
    .describe("Acciones concretas recomendadas, en orden de impacto esperado. Vacío si no aplica ninguna."),
  priority: z
    .enum(["low", "medium", "high"])
    .describe("Urgencia de actuar sobre lo encontrado: high (gasto desperdiciado o caída fuerte), medium, low (estable)."),
});
