"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LineChart as LineChartIcon } from "lucide-react";
import type { DailyMetrics } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils/format";
import { formatDateShort } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type ChartMetric = "spend" | "ctr" | "cpc" | "results";

const METRIC_OPTIONS: { key: ChartMetric; label: string }[] = [
  { key: "spend", label: "Inversión" },
  { key: "ctr", label: "CTR" },
  { key: "cpc", label: "CPC" },
  { key: "results", label: "Resultados" },
];

function computeValue(row: DailyMetrics, metric: ChartMetric): number {
  switch (metric) {
    case "spend":
      return row.spend;
    case "results":
      return row.results;
    case "ctr":
      return row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    case "cpc":
      return row.clicks > 0 ? row.spend / row.clicks : 0;
  }
}

function formatValue(metric: ChartMetric, value: number): string {
  switch (metric) {
    case "spend":
      return formatCurrency(value);
    case "results":
      return formatNumber(value);
    case "ctr":
      return formatPercent(value);
    case "cpc":
      return formatCurrency(value);
  }
}

export function PerformanceChart({ rows, loading }: { rows: DailyMetrics[]; loading: boolean }) {
  const [metric, setMetric] = useState<ChartMetric>("spend");

  const data = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row) => ({ date: row.date, value: Math.round(computeValue(row, metric) * 100) / 100 })),
    [rows, metric]
  );

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
        <CardTitle>Evolución de performance</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setMetric(option.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                metric === option.key
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="h-72 px-2 pb-5">
        {loading ? (
          <div className="h-full px-3">
            <Skeleton className="h-full w-full" />
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon={LineChartIcon} title="Sin datos en este rango" description="Prueba a ampliar el rango de fechas." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#141C28" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={{ stroke: "#1D2635" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => (metric === "spend" || metric === "cpc" ? `$${v}` : String(v))}
              />
              <RechartsTooltip
                cursor={{ stroke: "#2C3A4F" }}
                contentStyle={{
                  background: "#111827",
                  border: "1px solid #2C3A4F",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelFormatter={(label) => formatDateShort(String(label))}
                formatter={(value) => [
                  formatValue(metric, Number(value)),
                  METRIC_OPTIONS.find((o) => o.key === metric)?.label,
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#areaFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#2563EB", stroke: "#0D121C", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
