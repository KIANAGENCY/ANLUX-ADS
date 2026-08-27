"use client";

import { ShieldCheck } from "lucide-react";
import { AlertItem } from "@/components/alerts/alert-item";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/hooks/use-alerts";

export default function AlertsPage() {
  const { loading, alerts, error } = useAlerts();
  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <SummaryPill label="Críticas" value={counts.critical} color="text-negative" />
        <SummaryPill label="Advertencias" value={counts.warning} color="text-warning" />
        <SummaryPill label="Info" value={counts.info} color="text-[#b3b3ff]" />
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Todo en orden"
          description="No se detectaron alertas de performance en el periodo seleccionado."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-3.5 text-center">
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Card>
  );
}
