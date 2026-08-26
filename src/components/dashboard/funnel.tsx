import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { FunnelStage } from "@/lib/utils/funnel";
import { formatNumber, formatPercent } from "@/lib/utils/format";

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const maxValue = stages[0]?.value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel de conversión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, index) => {
          const widthPercent = Math.max(8, (stage.value / maxValue) * 100);
          return (
            <div key={stage.label}>
              {index > 0 && (
                <div className="flex items-center gap-2 py-1 pl-1 text-[11px] text-muted-foreground">
                  <span className="h-3 w-px bg-white/15" />
                  {stage.conversionFromPrevious === null
                    ? "Sin datos"
                    : `${formatPercent(stage.conversionFromPrevious, 1)} de conversión`}
                </div>
              )}
              <div className="flex items-center gap-4">
                <div
                  className="flex h-11 items-center rounded-lg gradient-accent px-4 text-sm font-medium text-white transition-all"
                  style={{ width: `${widthPercent}%`, minWidth: "fit-content", opacity: 1 - index * 0.12 }}
                >
                  {formatNumber(stage.value)}
                </div>
                <span className="text-sm text-muted-foreground">{stage.label}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
