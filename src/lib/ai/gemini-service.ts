import "server-only";
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import type { AIAnalysis } from "@/lib/types";
import type { AIAnalysisRequest, IAIAnalystService } from "./types";
import { AIAnalysisSchema } from "./schema";
import { AI_ANALYST_SYSTEM_PROMPT, buildUserPayload } from "./prompt";
import { AIAnalystError } from "./errors";
import { geminiModel, isGeminiConfigured } from "./config";

const MAX_OUTPUT_TOKENS = 2000;

/**
 * El mismo `AIAnalysisSchema` que usa Claude, traducido a JSON Schema para
 * `responseJsonSchema`. Se deriva del schema Zod en vez de escribirse a mano:
 * así hay una sola fuente de verdad y es imposible que ambos proveedores
 * diverjan en el shape. Se calcula una vez por proceso.
 */
const RESPONSE_JSON_SCHEMA = z.toJSONSchema(AIAnalysisSchema);

/**
 * Implementación del AI Performance Analyst respaldada por Google Gemini.
 *
 * Seguridad — mismas garantías que la implementación de Anthropic:
 *   - `GEMINI_API_KEY` es un secreto de servidor, sin prefijo `NEXT_PUBLIC_`.
 *     `import "server-only"` hace fallar el build si este módulo se importa
 *     desde un componente cliente.
 *   - Esta llamada NO declara `tools` ni function calling: es de una sola
 *     vuelta (datos → JSON de análisis). Sin herramientas declaradas, el
 *     modelo no tiene ningún mecanismo para invocar nada — mucho menos
 *     modificar una campaña de Meta. Read-only por construcción.
 *   - El frontend nunca llama a Google directamente: siempre pasa por
 *     `POST /api/ai/analyze`.
 */
export class GeminiAIAnalystService implements IAIAnalystService {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysis> {
    if (!isGeminiConfigured()) {
      throw new AIAnalystError(
        "auth",
        "El servicio de IA no está configurado en el servidor. Contacta al administrador."
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let response;
    try {
      response = await ai.models.generateContent({
        model: geminiModel(),
        contents: buildUserPayload(request),
        config: {
          systemInstruction: AI_ANALYST_SYSTEM_PROMPT,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
          // Análoga al `effort: "medium"` de Anthropic: la tarea está acotada
          // y el formato de salida es fijo, no necesita razonamiento profundo.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (err) {
      throw translateGeminiError(err);
    }

    // Prompt bloqueado antes de generar: llega en promptFeedback, sin candidatos.
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      console.error("[ai] Gemini bloqueó la petición:", blockReason);
      throw new AIAnalystError(
        "refusal",
        "El servicio de IA no pudo procesar esta consulta. Intenta reformular la pregunta."
      );
    }

    // Respuesta interrumpida después de generar: llega en el candidato.
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === FinishReason.SAFETY || finishReason === FinishReason.RECITATION) {
      console.error("[ai] Gemini interrumpió la respuesta:", finishReason);
      throw new AIAnalystError(
        "refusal",
        "El servicio de IA no pudo generar un análisis para esta consulta. Intenta reformular la pregunta."
      );
    }
    if (finishReason === FinishReason.MAX_TOKENS) {
      throw new AIAnalystError(
        "invalid_response",
        "El análisis se cortó antes de completarse. Intenta de nuevo o reduce el rango de fechas."
      );
    }

    const text = response.text;
    if (!text) {
      throw new AIAnalystError(
        "invalid_response",
        "El servicio de IA devolvió una respuesta vacía. Intenta de nuevo."
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AIAnalystError(
        "invalid_response",
        "El servicio de IA devolvió una respuesta que no se pudo interpretar. Intenta de nuevo."
      );
    }

    // Misma validación final que Anthropic: `AIAnalysisSchema` es la única
    // fuente de verdad del contrato con el frontend.
    const parsed = AIAnalysisSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[ai] la respuesta de Gemini no cumple AIAnalysisSchema.");
      throw new AIAnalystError(
        "invalid_response",
        "El servicio de IA devolvió una respuesta que no cumple el formato esperado. Intenta de nuevo."
      );
    }

    return {
      ...parsed.data,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Traduce excepciones del SDK de Google a la misma taxonomía que usa
 * Anthropic, para que `/api/ai/analyze` devuelva los mismos códigos HTTP sea
 * cual sea el proveedor. Nunca propaga el detalle crudo ni, por supuesto, la
 * API key.
 */
function translateGeminiError(err: unknown): AIAnalystError {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return new AIAnalystError(
        "rate_limited",
        "Se alcanzó el límite de solicitudes del servicio de IA. Intenta de nuevo en unos minutos."
      );
    }
    // Google responde a una clave inválida con 400 API_KEY_INVALID, no con
    // 401 — verificado contra la API real. Sin este caso, un problema de
    // credencial se reportaría como error genérico 500 en vez de 503, que es
    // lo que devuelve Anthropic ante el mismo fallo.
    const isKeyProblem =
      err.status === 401 ||
      err.status === 403 ||
      (err.status === 400 && /API_KEY_INVALID|API key not valid/i.test(err.message));
    if (isKeyProblem) {
      console.error("[ai] GEMINI_API_KEY inválida o rechazada por Google.");
      return new AIAnalystError("auth", "No se pudo autenticar con el servicio de IA. Contacta al administrador.");
    }
    console.error("[ai] error de Gemini:", err.status, err.message);
    return new AIAnalystError("unknown", "El servicio de IA devolvió un error inesperado. Intenta de nuevo.");
  }

  // El SDK de Google no envuelve los fallos de red en su clase de error.
  if (err instanceof Error && /fetch failed|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message)) {
    return new AIAnalystError(
      "connection",
      "No se pudo conectar con el servicio de IA. Revisa la conexión e inténtalo de nuevo."
    );
  }

  console.error("[ai] error inesperado llamando a Gemini:", err instanceof Error ? err.message : "desconocido");
  return new AIAnalystError("unknown", "No se pudo generar el análisis. Intenta de nuevo.");
}
