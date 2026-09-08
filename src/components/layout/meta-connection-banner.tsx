"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { MetaHealthReport } from "@/lib/meta/real/health";

/**
 * Aviso global de problema de conexión con Meta.
 *
 * Existe para evitar la confusión más costosa de este panel: una conexión rota
 * y una cuenta sin actividad producen la misma pantalla vacía. Cuando la causa
 * es la conexión, el aviso lo dice explícitamente antes de que el usuario
 * interprete los ceros como una realidad de negocio.
 *
 * Solo consulta `/api/meta/health` cuando ya hay indicio de problema (error al
 * listar cuentas, o ninguna cuenta accesible): en el camino sano no añade
 * ninguna petición.
 */
export function MetaConnectionBanner() {
  const { realAccounts, realAccountsLoading, realAccountsError } = useFilters();
  const pathname = usePathname();
  const [health, setHealth] = useState<MetaHealthReport | null>(null);

  const noAccounts = !realAccountsLoading && !realAccountsError && realAccounts.length === 0;
  const hasProblem = Boolean(realAccountsError) || noAccounts;

  useEffect(() => {
    if (!hasProblem) return;
    let cancelled = false;

    fetch("/api/meta/health", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<MetaHealthReport>) : null))
      .then((report) => {
        if (!cancelled) setHealth(report);
      })
      .catch(() => {
        // El aviso ya se muestra con el mensaje de /api/meta/accounts; el
        // diagnóstico detallado es una mejora, no un requisito.
      });

    return () => {
      cancelled = true;
      // Al dejar de haber problema, el informe anterior deja de usarse: el
      // aviso no se renderiza, y una nueva incidencia dispara otra consulta.
    };
  }, [hasProblem]);

  if (realAccountsLoading || !hasProblem) return null;

  // El informe de salud nombra la causa exacta (token vencido, permisos,
  // negocio inaccesible...); si no llegó, se usa el error de /api/meta/accounts.
  const cause =
    health?.summary ??
    realAccountsError ??
    "El token de Meta no da acceso a ninguna cuenta publicitaria.";

  const critical = Boolean(realAccountsError) || (health !== null && health.status !== "no_accounts");

  return (
    <div
      role="alert"
      className={
        critical
          ? "flex flex-wrap items-start gap-3 rounded-xl border border-negative/30 bg-negative/8 px-4 py-3 text-sm"
          : "flex flex-wrap items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm"
      }
    >
      <AlertTriangle className={critical ? "mt-0.5 size-4 shrink-0 text-negative" : "mt-0.5 size-4 shrink-0 text-warning"} />
      <div className={critical ? "min-w-0 flex-1 space-y-1 text-negative" : "min-w-0 flex-1 space-y-1 text-warning"}>
        <p className="font-medium">Problema de conexión con Meta, no ausencia de métricas.</p>
        <p className="opacity-90">{cause}</p>
        <p className="text-xs opacity-75">
          Mientras la conexión no se restablezca, las secciones aparecerán vacías: eso no significa que las
          campañas no tengan actividad.
        </p>
      </div>
      {pathname !== "/settings" && (
        <Link
          href="/settings"
          className={
            critical
              ? "shrink-0 rounded-lg border border-negative/30 px-2.5 py-1.5 text-xs font-medium text-negative transition-colors hover:bg-negative/10"
              : "shrink-0 rounded-lg border border-warning/30 px-2.5 py-1.5 text-xs font-medium text-warning transition-colors hover:bg-warning/10"
          }
        >
          Ver estado de la conexión
        </Link>
      )}
    </div>
  );
}
