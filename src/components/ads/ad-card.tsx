import { Image as ImageIcon, Video, GalleryHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import type { AdWithMetrics } from "@/hooks/use-ads";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

const CREATIVE_ICON = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  CAROUSEL: GalleryHorizontal,
};

export function AdCard({ ad }: { ad: AdWithMetrics }) {
  const Icon = CREATIVE_ICON[ad.creativeType];

  return (
    <Card className="overflow-hidden">
      <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${ad.previewGradient}`}>
        <Icon className="size-8 text-white/85" />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium text-foreground">{ad.name}</p>
          <StatusBadge status={ad.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {ad.campaignName} <span className="opacity-50">/</span> {ad.adSetName}
        </p>

        <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 border-t border-white/8 pt-3 text-xs">
          <Metric label="Gasto" value={formatCurrency(ad.metrics.spend)} />
          <Metric label="Impr." value={formatNumber(ad.metrics.impressions)} />
          <Metric label="CTR" value={`${ad.metrics.ctr.toFixed(2)}%`} />
          <Metric label="CPC" value={formatCurrency(ad.metrics.cpc)} />
          <Metric label="Resultados" value={formatNumber(ad.metrics.results)} />
          <Metric label="Costo/res." value={ad.metrics.results > 0 ? formatCurrency(ad.metrics.costPerResult) : "—"} />
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground/90">{value}</p>
    </div>
  );
}
