import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lee/escribe la sesión a través de las cookies de Next.js.
 * Devuelve `null` en modo demo.
 *
 * Nota: esta fase solo usa la clave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`),
 * la misma que el cliente de navegador, y por tanto respeta Row Level
 * Security. Un cliente con la clave secreta (bypass de RLS, antes llamada
 * `service_role`) se añadirá en una fase posterior solo si hace falta.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` puede fallar si se llama desde un Server Component sin
          // middleware que refresque la sesión. Es seguro ignorarlo aquí.
        }
      },
    },
  });
}
