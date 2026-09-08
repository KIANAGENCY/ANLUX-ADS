"use client";

import { getSupabaseBrowserClient } from "./client";
import { isSupabaseConfigured } from "./config";

export interface AuthResult {
  success: boolean;
  error?: string;
}

/**
 * Inicia sesión exclusivamente contra Supabase Auth real.
 * Si Supabase no está configurado, falla de forma explícita: ANLUX nunca crea
 * sesiones locales simuladas ni acepta credenciales de prueba.
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    return { success: false, error: "Introduce tu email y contraseña." };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "La autenticación de Supabase no está configurada. Revisa las variables de entorno del proyecto.",
    };
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

/** Traduce los errores comunes de Supabase Auth sin exponer mensajes crudos. */
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
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseBrowserClient();
  await supabase?.auth.signOut();
}
