import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import type { EntityStatus, AlertSeverity } from "@/lib/types";

export function Badge({
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "positive" | "negative" | "warning" | "accent";
}) {
  const variants: Record<string, string> = {
    neutral: "bg-white/6 text-foreground/80 border-white/10",
    positive: "bg-positive/10 text-positive border-positive/25",
    negative: "bg-negative/10 text-negative border-negative/25",
    warning: "bg-warning/10 text-warning border-warning/25",
    accent: "bg-accent/15 text-[#b3b3ff] border-accent/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

const STATUS_CONFIG: Record<EntityStatus, { label: string; variant: "positive" | "neutral" | "warning" }> = {
  ACTIVE: { label: "Activo", variant: "positive" },
  PAUSED: { label: "Pausado", variant: "neutral" },
  IN_REVIEW: { label: "En revisión", variant: "warning" },
  ARCHIVED: { label: "Archivado", variant: "neutral" },
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className="capitalize">
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "ACTIVE" && "bg-positive",
          status === "PAUSED" && "bg-foreground/40",
          status === "IN_REVIEW" && "bg-warning",
          status === "ARCHIVED" && "bg-foreground/40"
        )}
      />
      {config.label}
    </Badge>
  );
}

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; variant: "negative" | "warning" | "accent" }> = {
  critical: { label: "Crítica", variant: "negative" },
  warning: { label: "Advertencia", variant: "warning" },
  info: { label: "Información", variant: "accent" },
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
