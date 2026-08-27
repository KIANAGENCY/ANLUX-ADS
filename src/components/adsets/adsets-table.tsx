"use client";

import { Layers } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { AdSetWithMetrics } from "@/hooks/use-adsets";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export function AdSetsTable({
  adSets,
  loading,
  showCampaignColumn = true,
}: {
  adSets: AdSetWithMetrics[];
  loading: boolean;
  showCampaignColumn?: boolean;
}) {
  const columns: DataTableColumn<AdSetWithMetrics>[] = [
    {
      key: "name",
      label: "Nombre",
      sortValue: (a) => a.name,
      render: (a) => <span className="font-medium text-foreground">{a.name}</span>,
      className: "max-w-64 truncate",
    },
    ...(showCampaignColumn
      ? [
          {
            key: "campaign",
            label: "Campaña",
            sortValue: (a: AdSetWithMetrics) => a.campaignName,
            render: (a: AdSetWithMetrics) => <span className="text-muted-foreground">{a.campaignName}</span>,
            className: "max-w-56 truncate",
          } satisfies DataTableColumn<AdSetWithMetrics>,
        ]
      : []),
    {
      key: "status",
      label: "Estado",
      sortValue: (a) => a.status,
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "dailyBudget",
      label: "Presupuesto/día",
      align: "right",
      sortValue: (a) => a.dailyBudget ?? -1,
      render: (a) => (a.dailyBudget !== null ? formatCurrency(a.dailyBudget) : "—"),
    },
    {
      key: "audience",
      label: "Audiencia",
      render: (a) => <span className="text-xs text-muted-foreground">{a.audience}</span>,
      className: "max-w-72 whitespace-normal text-xs",
    },
    {
      key: "spend",
      label: "Gasto",
      align: "right",
      sortValue: (a) => a.metrics.spend,
      render: (a) => formatCurrency(a.metrics.spend),
    },
    {
      key: "cpm",
      label: "CPM",
      align: "right",
      sortValue: (a) => a.metrics.cpm,
      render: (a) => formatCurrency(a.metrics.cpm),
    },
    {
      key: "ctr",
      label: "CTR",
      align: "right",
      sortValue: (a) => a.metrics.ctr,
      render: (a) => `${a.metrics.ctr.toFixed(2)}%`,
    },
    {
      key: "cpc",
      label: "CPC",
      align: "right",
      sortValue: (a) => a.metrics.cpc,
      render: (a) => formatCurrency(a.metrics.cpc),
    },
    {
      key: "results",
      label: "Resultados",
      align: "right",
      sortValue: (a) => a.metrics.results,
      render: (a) => formatNumber(a.metrics.results),
    },
    {
      key: "costPerResult",
      label: "Costo/resultado",
      align: "right",
      sortValue: (a) => a.metrics.costPerResult,
      render: (a) => (a.metrics.results > 0 ? formatCurrency(a.metrics.costPerResult) : "—"),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={adSets}
      keyExtractor={(a) => a.id}
      loading={loading}
      defaultSortKey="spend"
      emptyState={
        <EmptyState icon={Layers} title="No hay conjuntos de anuncios" description="Ajusta los filtros para ver más resultados." />
      }
    />
  );
}
