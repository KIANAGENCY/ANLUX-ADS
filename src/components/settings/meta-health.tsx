"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MetaHealthReport, MetaHealthStatus } from "@/lib/meta/real/health";

/** Etiqueta y color de cada estado. Los tres grados se distinguen a simple vista. */
const STATUS_UI: Record<
  MetaHealthStatus,
  { label: string; variant: "positive" | "negative" | "warning"; icon: typeof CheckCircle2 }
> = {
  ok: { label: "Conectado", variant: "positive", icon: CheckCircle2 },
  missing_token: { label: "Sin configurar", variant: "negative", icon: XCircle },
  token_expired: { label: "Token vencido", variant: "negative", icon: XCircle },
  insufficient_permissions: { label: "Permisos insuficientes", variant: "negative", icon: XCircle },
  business_unreachable: { label: "Negocio inaccesible", variant: "negative", icon: XCircle },
  no_accounts: { label: "Sin cuentas asignadas", variant: "warning", icon: AlertTriangle },
  temporary_error: { label: "Error temporal de Meta", variant: "warning", icon: AlertTriangle },
  blocked_by_network: { label: "Bloqueado por la red", variant: "negative", icon: XCircle },
};

function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Monitor de salud de la conexión con Meta. Consulta `/api/meta/health`, que
 * hace dos GET de solo lectura y nunca devuelve la credencial: aquí solo
 * llegan estados y mensajes ya saneados.
 */
export function MetaHealth() {
  const [report, setReport] = useState<MetaHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Se incrementa al pulsar "Comprobar ahora": dispara una comprobación nueva. */
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/meta/health", { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo completar la comprobación.");
        const data = (await res.json()) as MetaHealthReport;
        if (cancelled) return;
        setReport(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setReport(null);
        setError(err instanceof Error ? err.message : "No se pudo completar la comprobación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const check = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  const ui = report ? STATUS_UI[report.status] : null;
  const StatusIcon = ui?.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de la conexión con Meta</CardTitle>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Comprobar ahora
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && !report ? (
          <p className="text-sm text-muted-foreground-2">Comprobando la conexión…</p>
        ) : error ? (
          <p className="text-sm text-negative">{error}</p>
        ) : report && ui ? (
          <>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant={ui.variant}>
                {StatusIcon && <StatusIcon className="size-3" />}
                {ui.label}
              </Badge>
              <span className="text-[11px] text-muted-foreground-2">
                Última comprobación: {formatCheckedAt(report.checkedAt)}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">{report.summary}</p>

            <div className="space-y-2">
              {report.checks.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2.5 rounded-lg border border-border-subtle bg-background/40 p-3"
                >
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-negative" />
                  )}
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground-2">{c.detail}</p>
                  </div>
                </div>
              ))}
              {!report.businessConfigured && (
                <p className="text-[11px] text-muted-foreground-2">
                  No hay <code className="font-mono">META_BUSINESS_ID</code> configurado: no se comprueba el acceso
                  al Business Manager, y las cuentas de cliente administradas desde un negocio no aparecerán en el
                  selector.
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground-2 uppercase">
                Cuentas publicitarias accesibles ({report.accounts.length})
              </p>
              {report.accounts.length === 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground-2">
                  Ninguna cuenta accesible con el token actual.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {report.accounts.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">{a.name}</span>
                      <code className="font-mono text-muted-foreground-2">{a.id}</code>
                      <span className="text-muted-foreground-2">· {a.currency}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
