"use client";

import { ArrowLeft, LineChart as LineChartIcon, Megaphone } from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AdSetsTable } from "@/components/adsets/adsets-table";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useAdSets } from "@/hooks/use-adsets";
import { OBJECTIVE_LABELS } from "@/lib/utils/labels";
import { formatCurrency } from "@/lib/utils/format";
import { formatDateLong } from "@/lib/utils/dates";
import type { MetricKey } from "@/lib/types";

const SUMMARY_METRICS: MetricKey[] = ["spend", "results", "costPerResult", "ctr", "cpc"];

/**
 * Detalle de una campaña, servido íntegramente con datos reales de Meta.
 *
 * Reutiliza los endpoints existentes: la campaña y sus métricas del periodo
 * salen de `/api/meta/campaigns`, y sus conjuntos de `/api/meta/adsets`
 * filtrados por `campaignId`. No hay ningún dato simulado.
 *
 * Lo que todavía no puede mostrarse es la serie diaria de una campaña
 * concreta: hoy `/api/meta/overview` solo devuelve la serie a nivel de
 * cuenta. Esa sección muestra un estado vacío explícito en lugar de
 * rellenarse con datos derivados o inventados.
 */
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: campaignsLoading, campaigns, error: campaignsError } = useCampaigns();
  const { loading: adSetsLoading, adSets, error: adSetsError } = useAdSets();

  const campaign = useMemo(() => campaigns.find((c) => c.id === id), [campaigns, id]);
  const campaignAdSets = useMemo(() => adSets.filter((a) => a.campaignId === id), [adSets, id]);

  const error = campaignsError ?? adSetsError;

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a campañas
      </Link>

      {error && <ErrorBanner message={error} />}

      {campaignsLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !campaign ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Campaña no encontrada"
            description="Esta campaña no está entre las de la cuenta y el periodo seleccionados. Prueba a cambiar el rango de fechas o vuelve al listado."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{campaign.name}</h2>
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
                value={campaign.metrics[metric]}
                // La comparación con el periodo anterior es a nivel de cuenta:
                // no se infiere una variación por campaña que Meta no ha dado.
                changePercent={null}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evolución de performance</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <EmptyState
                icon={LineChartIcon}
                title="Serie diaria por campaña no disponible"
                description="El detalle día a día de una campaña concreta aún no está disponible. La evolución a nivel de cuenta puede consultarse en Overview."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conjuntos de anuncios de esta campaña</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <AdSetsTable adSets={campaignAdSets} loading={adSetsLoading} showCampaignColumn={false} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
