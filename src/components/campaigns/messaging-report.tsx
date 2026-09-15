"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import type { CampaignWithMetrics } from "@/hooks/use-campaigns";
import type { MessagingReport } from "@/lib/meta/messaging";
import { formatNumber } from "@/lib/utils/format";

export function CampaignMessagingReport({ campaigns, loading }: { campaigns: CampaignWithMetrics[]; loading: boolean }) {
  const { clientId, dateRange } = useFilters();
  const key = `${clientId}|${dateRange.from}|${dateRange.to}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: MessagingReport; error?: string }>();
  useEffect(() => {
    if (!clientId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ accountId: clientId, from: dateRange.from, to: dateRange.to });
    fetch(`/api/meta/messaging?${params}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudieron obtener las conversaciones.");
        if (!Array.isArray(data.campaigns) || !Array.isArray(data.warnings)) throw new Error("El informe de conversaciones no es válido.");
        return data as MessagingReport;
      })
      .then(data => { if (!controller.signal.aborted) setResult({ key, attempt, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, attempt, error: error instanceof Error ? error.message : "No se pudieron obtener las conversaciones." }); });
    return () => controller.abort();
  }, [clientId, dateRange.from, dateRange.to, key, attempt]);

  const current = result?.key === key && result.attempt === attempt ? result : undefined;
  if (!clientId) return <Card className="p-5 text-sm text-muted-foreground">Selecciona una cuenta para consultar conversaciones.</Card>;
  if (loading || !current) return <Card className="p-5 text-sm" role="status">Consultando conversaciones de Meta…</Card>;
  if (current.error) return <div className="space-y-3"><ErrorBanner message={current.error} /><button type="button" className="rounded-lg border border-border-subtle px-4 py-2 text-sm" onClick={() => setAttempt(a => a + 1)}>Reintentar</button></div>;
  const data = current.data!;
  const byId = new Map(data.campaigns.map(c => [c.campaignId, c]));
  const count = (value: number | null | undefined) => value == null ? "No disponible" : formatNumber(value);

  return <Card className="overflow-hidden">
    <div className="space-y-2 p-5">
      <h2 className="text-base font-semibold">Conversaciones por campaña</h2>
      <p className="text-sm text-muted-foreground">Conversaciones iniciadas atribuidas por Meta del {dateRange.from} al {dateRange.to}. El origen indica dónde apareció el anuncio; el destino, dónde comenzó la conversación.</p>
      <p className="text-xs text-muted-foreground">Esta cifra cuenta conversaciones, no cada mensaje dentro del chat ni clics en el botón. «No disponible» significa que Meta no devolvió la métrica; no equivale a cero.</p>
      {data.warnings.map(w => <p key={w} role="status" className="text-sm text-amber-400">{w}</p>)}
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border-subtle text-muted-foreground"><tr><th scope="col" className="px-5 py-3">Campaña</th><th scope="col" className="px-5 py-3">Origen del anuncio</th><th scope="col" className="px-5 py-3">Destino del mensaje</th><th scope="col" className="px-5 py-3 text-right">Conversaciones iniciadas</th></tr></thead>
        <tbody>{campaigns.map(c => {
          const report = byId.get(c.id);
          return <CampaignRows key={c.id} name={c.name} total={count(report?.conversations)} details={report?.details ?? []} />;
        })}</tbody>
      </table>
      {!campaigns.length && <p className="p-5 text-sm text-muted-foreground">No hay campañas para estos filtros.</p>}
    </div>
  </Card>;
}

function CampaignRows({ name, total, details }: { name: string; total: string; details: MessagingReport["campaigns"][number]["details"] }) {
  return <>
    <tr className="border-b border-border-subtle bg-surface-2"><th scope="row" className="px-5 py-3 font-medium">{name}</th><td className="px-5 py-3 text-muted-foreground" colSpan={2}>Total de la campaña</td><td className="px-5 py-3 text-right font-semibold">{total}</td></tr>
    {details.length ? details.map(d => <tr key={`${d.source}|${d.destination}`} className="border-b border-border-subtle"><td className="px-5 py-3 text-muted-foreground">Desglose</td><td className="px-5 py-3">{d.source}</td><td className="px-5 py-3">{d.destination}</td><td className="px-5 py-3 text-right">{d.conversations === null ? "No disponible" : formatNumber(d.conversations)}</td></tr>) : <tr className="border-b border-border-subtle"><td colSpan={4} className="px-5 py-3 text-xs text-muted-foreground">Meta no devolvió un desglose de conversaciones por origen y destino.</td></tr>}
  </>;
}
