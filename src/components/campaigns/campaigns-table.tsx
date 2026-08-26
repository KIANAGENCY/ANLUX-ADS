"use client";

import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { CampaignWithMetrics } from "@/hooks/use-campaigns";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { OBJECTIVE_LABELS } from "@/lib/utils/labels";

export function CampaignsTable({ campaigns, loading }: { campaigns: CampaignWithMetrics[]; loading: boolean }) {
  const router = useRouter();

  const columns: DataTableColumn<CampaignWithMetrics>[] = [
    {
      key: "name",
      label: "Nombre",
      sortValue: (c) => c.name,
      render: (c) => <span className="font-medium text-foreground">{c.name}</span>,
      className: "max-w-72 truncate",
    },
    {
      key: "status",
      label: "Estado",
      sortValue: (c) => c.status,
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "objective",
      label: "Objetivo",
      sortValue: (c) => c.objective,
      render: (c) => <span className="text-muted-foreground">{OBJECTIVE_LABELS[c.objective]}</span>,
    },
    {
      key: "dailyBudget",
      label: "Presupuesto/día",
      align: "right",
      sortValue: (c) => c.dailyBudget,
      render: (c) => formatCurrency(c.dailyBudget),
    },
    {
      key: "spend",
      label: "Gasto",
      align: "right",
      sortValue: (c) => c.metrics.spend,
      render: (c) => formatCurrency(c.metrics.spend),
    },
    {
      key: "impressions",
      label: "Impresiones",
      align: "right",
      sortValue: (c) => c.metrics.impressions,
      render: (c) => formatNumber(c.metrics.impressions),
    },
    {
      key: "ctr",
      label: "CTR",
      align: "right",
      sortValue: (c) => c.metrics.ctr,
      render: (c) => formatPercent(c.metrics.ctr),
    },
    {
      key: "cpc",
      label: "CPC",
      align: "right",
      sortValue: (c) => c.metrics.cpc,
      render: (c) => formatCurrency(c.metrics.cpc),
    },
    {
      key: "results",
      label: "Resultados",
      align: "right",
      sortValue: (c) => c.metrics.results,
      render: (c) => formatNumber(c.metrics.results),
    },
    {
      key: "costPerResult",
      label: "Costo/resultado",
      align: "right",
      sortValue: (c) => c.metrics.costPerResult,
      render: (c) => (c.metrics.results > 0 ? formatCurrency(c.metrics.costPerResult) : "—"),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={campaigns}
      keyExtractor={(c) => c.id}
      onRowClick={(c) => router.push(`/campaigns/${c.id}`)}
      loading={loading}
      defaultSortKey="spend"
      emptyState={
        <EmptyState
          icon={Megaphone}
          title="No hay campañas para este filtro"
          description="Ajusta la búsqueda o el filtro de estado para ver más resultados."
        />
      }
    />
  );
}
