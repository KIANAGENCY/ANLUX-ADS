import Link from "next/link";
import { ArrowRight, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PortfolioRecommendation } from "@/lib/decisions/types";

export function PortfolioCard({ recommendation }: { recommendation: PortfolioRecommendation }) {
  return <Card className="p-4 sm:p-5">
    <div className="flex items-start gap-3"><WalletCards className="mt-0.5 size-5 shrink-0 text-accent-light"/><div>
      <h3 className="font-semibold">{recommendation.action === "TEST_REALLOCATION" ? "Probar una reasignación pequeña" : "Comparar calidad antes de reasignar"}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.explanation}</p>
      <p className="mt-3 text-sm leading-6 text-foreground"><strong>Decisión sugerida:</strong> {recommendation.nextStep}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{recommendation.safeguard}</p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm"><Link className="inline-flex min-h-11 items-center gap-1 text-accent-light" href={`/campaigns/${encodeURIComponent(recommendation.toCampaignId)}`}>Ver campaña más eficiente <ArrowRight className="size-4"/></Link><Link className="inline-flex min-h-11 items-center gap-1 text-accent-light" href={`/campaigns/${encodeURIComponent(recommendation.fromCampaignId)}`}>Ver campaña a revisar <ArrowRight className="size-4"/></Link></div>
    </div></div>
  </Card>;
}
