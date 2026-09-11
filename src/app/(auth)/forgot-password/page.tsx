"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const RECOVERY_REDIRECT_URL = "https://anlux-ads.vercel.app/reset-password";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const authConfigured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);

    if (!email) {
      setError("Introduce tu email.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase Auth no está disponible.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_REDIRECT_URL,
    });
    setLoading(false);

    if (resetError) {
      const details = [
        resetError.message,
        "code" in resetError && resetError.code ? `código: ${String(resetError.code)}` : null,
        resetError.status ? `HTTP ${resetError.status}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      setError(`Supabase rechazó la solicitud: ${details}`);
      console.error("[ANLUX][password-recovery]", resetError);
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-surface p-6 shadow-2xl shadow-black/40">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace seguro para crear una contraseña nueva.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-foreground/80">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!authConfigured || loading}
                className="w-full rounded-lg border border-white/10 bg-white/4 py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-negative/25 bg-negative/10 px-3 py-2 text-xs text-negative">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {sent && (
            <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground/80">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              <span>Correo enviado. Abre el enlace de recuperación en este mismo navegador.</span>
            </div>
          )}

          <Button type="submit" disabled={!authConfigured || loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Enviar enlace"}
          </Button>
        </form>

        <Link href="/login" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
