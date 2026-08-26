"use client";

import { AlertCircle, BarChart3, Loader2, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { signInWithPassword } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInWithPassword(email, password);

    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo iniciar sesión.");
      return;
    }
    router.push("/overview");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(600px circle at 15% 15%, rgba(109,109,246,0.18), transparent 60%), radial-gradient(600px circle at 85% 85%, rgba(156,92,240,0.16), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl gradient-accent">
            <BarChart3 className="size-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">ANLUX Ads Intelligence</h1>
            <p className="text-sm text-muted-foreground">Panel interno de performance marketing</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-surface p-6 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground/80">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@agencia.com"
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-foreground/80">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-white/10 bg-white/4 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
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
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Iniciar sesión"}
            </Button>
          </form>

          {!isSupabaseConfigured() && (
            <p className="mt-4 border-t border-white/8 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Modo demo: Supabase no está configurado. Cualquier email válido y contraseña de 4+
              caracteres inician sesión.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
