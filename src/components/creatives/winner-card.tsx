import { Image as ImageIcon, Video, GalleryHorizontal, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CreativeWinner } from "@/lib/utils/creatives";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";

const CREATIVE_ICON = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  CAROUSEL: GalleryHorizontal,
};

export function WinnerCard({ winner }: { winner: CreativeWinner }) {
  const { ad, tags } = winner;
  const Icon = CREATIVE_ICON[ad.creativeType];

  return (
    <Card className="overflow-hidden border-accent/25">
      <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${ad.previewGradient}`}>
        <Icon className="size-8 text-white/85" />
        <div className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
          <Trophy className="size-3.5 text-amber-300" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{ad.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ad.campaignName} <span className="opacity-50">/</span> {ad.adSetName}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="accent">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 border-t border-white/8 pt-3 text-xs">
          <Metric label="CTR" value={formatPercent(ad.metrics.ctr)} />
          <Metric label="CPC" value={formatCurrency(ad.metrics.cpc)} />
          <Metric label="Resultados" value={formatNumber(ad.metrics.results)} />
          <Metric
            label="Costo/resultado"
            value={ad.metrics.results > 0 ? formatCurrency(ad.metrics.costPerResult) : "—"}
          />
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
