import "server-only";
import { AIAnalystError } from "./errors";

export type AIProvider = "anthropic" | "gemini";

const VALID_PROVIDERS: readonly AIProvider[] = ["anthropic", "gemini"] as const;

/** Proveedor por defecto si `AI_PROVIDER` no está definida: se conserva el comportamiento previo. */
const DEFAULT_PROVIDER: AIProvider = "anthropic";

/**
 * Proveedor de IA activo, elegido explícitamente por `AI_PROVIDER`.
 *
 * - Sin la variable → Anthropic, como hasta ahora.
 * - Con un valor no reconocido → error de configuración. **Nunca** se cae en
 *   silencio a otro proveedor: un fallback implícito haría impredecibles la
 *   facturación y la calidad del análisis.
 */
export function resolveAIProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw) return DEFAULT_PROVIDER;

  const match = VALID_PROVIDERS.find((p) => p === raw);
  if (!match) {
    throw new AIAnalystError(
      "configuration",
      `El proveedor de IA configurado no es válido. AI_PROVIDER admite: ${VALID_PROVIDERS.join(", ")}.`
    );
  }
  return match;
}

/** Claves de cada proveedor. Server-only: ninguna lleva prefijo NEXT_PUBLIC_. */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Modelo GA verificado contra la API: familia Flash, el equivalente en coste y
 * latencia a la elección de Sonnet para Claude — análisis estructurado sobre
 * datos ya organizados, no razonamiento agéntico abierto.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Modelo de Gemini a usar. `GEMINI_MODEL` permite cambiarlo sin tocar código
 * (los identificadores de modelo cambian con el tiempo); si no está definida
 * se usa el valor por defecto. Se lee en cada llamada, no al cargar el módulo,
 * para que un cambio de variable surta efecto sin necesidad de rebuild.
 */
export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/** ¿Está configurada la credencial del proveedor activo? Usado por la página de Configuración. */
export function isActiveProviderConfigured(): boolean {
  try {
    return resolveAIProvider() === "anthropic" ? isAnthropicConfigured() : isGeminiConfigured();
  } catch {
    // AI_PROVIDER inválido: la integración no está utilizable.
    return false;
  }
}
