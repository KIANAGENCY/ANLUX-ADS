"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** Estado de autenticación basado exclusivamente en una sesión real de Supabase. */
export function useAuthState(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    let unsubscribe: (() => void) | undefined;
    async function check() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!cancelled) setStatus(session ? "authenticated" : "unauthenticated");
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session ? "authenticated" : "unauthenticated");
    }

    check();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return status;
}
