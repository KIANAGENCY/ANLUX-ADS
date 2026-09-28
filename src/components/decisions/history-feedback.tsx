"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Outcome = "accepted" | "rejected" | "deferred";
interface Row { id: number; entity_name: string; action: string; rationale: string; period_from: string; period_to: string; result_type: string | null; feedback: { outcome: Outcome; notes: string | null } | null }
export function HistoryFeedback() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/meta/memory/feedback", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el historial.");
      setRows(data.decisions);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cargar el historial."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl border border-border-subtle bg-surface p-5">
    <h2 className="font-semibold">Tu revisión de decisiones guardadas</h2>
    <p className="text-sm text-muted-foreground">Acepta, rechaza o deja pendiente una recomendación del historial. Esto registra tu criterio y no ejecuta cambios en Meta. Se muestran hasta 20 evaluaciones de campañas, con sus periodos originales.</p>
    <Button variant="secondary" onClick={load} disabled={busy}>{busy ? "Cargando…" : "Consultar historial"}</Button>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {rows?.length === 0 && <p className="text-sm">Todavía no hay decisiones guardadas.</p>}
    {rows?.map(row => <Review key={row.id} row={row} />)}
  </section>;
}
function Review({ row }: { row: Row }) {
  const [outcome, setOutcome] = useState<Outcome>(row.feedback?.outcome ?? "deferred");
  const [notes, setNotes] = useState(row.feedback?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/meta/memory/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decisionId: row.id, outcome, notes }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");
      setMessage("Revisión guardada.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }
  return <details className="rounded-lg border border-border-subtle p-3 text-sm">
    <summary className="cursor-pointer">{row.entity_name} · {row.period_from} a {row.period_to}</summary>
    <div className="mt-3 space-y-3">
      <p>{row.rationale}</p>
      {!row.result_type && <p className="text-muted-foreground">Registro sin tipo de resultado verificable. Tu revisión no valida sus métricas.</p>}
      <label className="block">Tu decisión<select className="ml-2 rounded border border-border-subtle bg-surface p-2" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)} disabled={busy}><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="deferred">Pendiente</option></select></label>
      <label className="block">Notas<textarea className="mt-1 block w-full rounded border border-border-subtle bg-surface p-2" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></label>
      <Button onClick={save} disabled={busy} size="sm">{busy ? "Guardando…" : "Guardar revisión"}</Button>
      <p role="status">{message}</p>
    </div>
  </details>;
}
