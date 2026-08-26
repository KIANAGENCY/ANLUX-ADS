"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasDemoSession } from "@/lib/supabase/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Estado de autenticación válido tanto para Supabase real como para el modo
 * demo (ver `lib/supabase/auth.ts`). Se usa en el guard del layout del
 * dashboard para decidir si redirigir a `/login`.
 */
export function useAuthState(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isSupabaseConfigured()) {
        setStatus(hasDemoSession() ? "authenticated" : "unauthenticated");
        return;
      }
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setStatus("unauthenticated");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "authenticated" : "unauthenticated");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
