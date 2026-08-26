"use client";

import { getSupabaseBrowserClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface AuthResult {
  success: boolean;
  error?: string;
  /** `true` cuando la sesión se simuló localmente por no haber Supabase configurado. */
  demo?: boolean;
}

const DEMO_SESSION_KEY = "anlux_demo_session";

/**
 * Inicia sesión con email/contraseña.
 *
 * - Si Supabase está configurado, usa `signInWithPassword` real.
 * - Si no, entra en "modo demo": acepta cualquier email/contraseña con
 *   formato válido y guarda una sesión simulada en `localStorage`, para que
 *   el resto de la app (que solo necesita saber "hay usuario / no hay
 *   usuario") funcione igual en ambos casos.
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    return { success: false, error: "Introduce tu email y contraseña." };
  }

  if (!isSupabaseConfigured()) {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return { success: false, error: "Introduce un email válido." };
    }
    if (password.length < 4) {
      return { success: false, error: "La contraseña debe tener al menos 4 caracteres." };
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ email }));
    }
    return { success: true, demo: true };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { success: false, error: "No se pudo inicializar Supabase." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: translateAuthError(error.message) };
  }
  return { success: true };
}

/**
 * Supabase Auth devuelve sus mensajes de error en inglés. Traducimos los
 * casos más comunes para que el login siempre muestre un error claro en
 * español; el resto cae en un mensaje genérico (nunca se expone el mensaje
 * crudo del proveedor).
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada.";
  }
  if (normalized.includes("user not found")) {
    return "No existe ninguna cuenta con ese email.";
  }
  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  }
  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch")
  ) {
    return "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }

  return "No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.";
}

export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
  }
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
  }
}

export function hasDemoSession(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(DEMO_SESSION_KEY));
}
