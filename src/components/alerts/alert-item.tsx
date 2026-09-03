import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SeverityBadge } from "@/components/ui/badge";
import type { PerformanceAlert } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const SEVERITY_ICON = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_ICON_COLOR = {
  critical: "text-negative bg-negative/12",
  warning: "text-warning bg-warning/12",
  info: "text-info bg-info/10",
};

export function AlertItem({ alert }: { alert: PerformanceAlert }) {
  const Icon = SEVERITY_ICON[alert.severity];

  return (
    <Card className="flex items-start gap-3.5 p-4 transition-colors hover:border-white/12">
      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", SEVERITY_ICON_COLOR[alert.severity])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{alert.title}</p>
          <SeverityBadge severity={alert.severity} />
        </div>
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        {alert.entityName && (
          <p className="text-xs text-muted-foreground-2">
            {alert.entityType === "campaign" ? "Campaña" : alert.entityType === "adset" ? "Conjunto" : "Anuncio"}:{" "}
            {alert.entityName}
          </p>
        )}
      </div>
    </Card>
  );
}
