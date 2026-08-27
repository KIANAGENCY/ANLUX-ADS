"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { AdSetsTable } from "@/components/adsets/adsets-table";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useCampaignDetail } from "@/hooks/use-campaign-detail";
import { OBJECTIVE_LABELS } from "@/lib/utils/labels";
import { formatCurrency } from "@/lib/utils/format";
import { formatDateLong } from "@/lib/utils/dates";
import type { MetricKey } from "@/lib/types";

const SUMMARY_METRICS: MetricKey[] = ["spend", "results", "costPerResult", "ctr", "cpc"];

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading, campaign, comparison, dailyRows, adSets } = useCampaignDetail(id);

  return (
    <div className="space-y-6">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver a campañas
      </Link>

      {loading || !campaign ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold text-foreground">{campaign.name}</h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {OBJECTIVE_LABELS[campaign.objective]}
              {campaign.dailyBudget !== null && <> · Presupuesto {formatCurrency(campaign.dailyBudget)}/día</>}
              {campaign.startDate && <> · Iniciada el {formatDateLong(campaign.startDate)}</>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {SUMMARY_METRICS.map((metric) => (
              <MetricCard
                key={metric}
                metric={metric}
                value={comparison!.current[metric]}
                changePercent={comparison!.changePercent[metric]}
              />
            ))}
          </div>

          <PerformanceChart rows={dailyRows} loading={false} />

          <Card>
            <CardHeader>
              <CardTitle>Conjuntos de anuncios de esta campaña</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <AdSetsTable
                adSets={adSets.map((a) => ({ ...a, campaignName: campaign.name }))}
                loading={false}
                showCampaignColumn={false}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
