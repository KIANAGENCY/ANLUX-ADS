"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

/**
 * Cliente de Supabase para uso en componentes cliente ("use client").
 * Devuelve `null` en modo demo (sin variables de entorno configuradas) —
 * quien lo consuma debe manejar ese caso, ver `lib/supabase/auth.ts`.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(supabaseUrl!, supabasePublishableKey!);
}
