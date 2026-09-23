"use client";

import { useState } from "react";

const ACCOUNT_ID = "act_1574477574179117";
const PERIODS = [
  ["2026-08-18", "2026-09-16"],
  ["2026-08-19", "2026-09-17"],
  ["2026-08-21", "2026-09-19"],
  ["2026-08-22", "2026-09-20"],
  ["2026-08-23", "2026-09-21"],
  ["2026-08-24", "2026-09-22"],
] as const;

export default function MaintenancePage() {
  const [working, setWorking] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});

  async function recalculate(index: number) {
    const [from, to] = PERIODS[index];
    setWorking(index);
    setResults((current) => ({ ...current, [index]: "Consultando Meta…" }));
    try {
      const params = new URLSearchParams({ accountId: ACCOUNT_ID, from, to });
      const response = await fetch(`/api/meta/intelligence?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Meta no devolvió el análisis.");
      if (payload.memory?.state !== "ready") throw new Error(payload.memory?.message ?? "No se guardó el histórico.");
      setResults((current) => ({ ...current, [index]: `Guardado · ${payload.decisions?.length ?? 0} decisiones` }));
    } catch (error) {
      setResults((current) => ({ ...current, [index]: `Error: ${error instanceof Error ? error.message : "desconocido"}` }));
    } finally {
      setWorking(null);
    }
  }

  return <main className="mx-auto max-w-2xl space-y-5">
    <h1 className="text-2xl font-semibold">Recalcular histórico de Hotel Expert</h1>
    <p className="text-sm text-muted-foreground">Cada periodo consulta métricas reales de Meta y actualiza una observación de ANLUX. Ejecuta uno a la vez.</p>
    <ul className="space-y-3">
      {PERIODS.map(([from, to], index) => <li key={from} className="flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface p-4">
        <span className="text-sm">{from} al {to}<span className="block text-xs text-muted-foreground" role="status">{results[index] ?? "Pendiente"}</span></span>
        <button type="button" disabled={working !== null} onClick={() => void recalculate(index)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-60">
          {working === index ? "Consultando…" : "Recalcular"}
        </button>
      </li>)}
    </ul>
  </main>;
}
