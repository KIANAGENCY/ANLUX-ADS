"use client";

import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setError("Supabase Auth no está disponible.");
        return;
      }

      try {
        // Supabase puede procesar automáticamente el callback de recuperación
        // antes de que este efecto se ejecute. Si ya existe sesión, no debemos
        // intentar canjear el mismo código una segunda vez.
        const { data: existingData, error: existingError } = await supabase.auth.getSession();
        if (existingError) throw existingError;
        if (existingData.session) {
          if (!cancelled) setReady(true);
          return;
        }

        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // En una carrera con el procesamiento automático, el canje manual
            // puede fallar aunque la sesión ya haya quedado creada. Verificamos
            // de nuevo antes de declarar el enlace inválido.
            const { data: recoveredData } = await supabase.auth.getSession();
            if (recoveredData.session) {
              if (!cancelled) setReady(true);
              return;
            }
            throw exchangeError;
          }
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          if (!cancelled) {
            setError("El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.");
          }
          return;
        }

        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError("No pudimos validar el enlace de recuperación. Solicita uno nuevo.");
        }
      }
    }

    prepareRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase Auth no está disponible.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No se pudo actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.");
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    window.setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-surface p-6 shadow-2xl shadow-black/40">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Crear nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define una contraseña nueva para tu acceso a ANLUX.</p>
        </div>

        {!ready && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Validando enlace seguro…
          </div>
        )}

        {error && !ready && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-negative/25 bg-negative/10 px-3 py-2 text-xs text-negative">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
            <Button type="button" className="w-full" onClick={() => router.push("/forgot-password")}>Solicitar otro enlace</Button>
          </div>
        )}

        {ready && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground/80">Nueva contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-xs font-medium text-foreground/80">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-negative/25 bg-negative/10 px-3 py-2 text-xs text-negative">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Guardar nueva contraseña"}
            </Button>
          </form>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground/80">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            <span>Contraseña actualizada. Te llevamos al inicio de sesión…</span>
          </div>
        )}
      </div>
    </div>
  );
}
