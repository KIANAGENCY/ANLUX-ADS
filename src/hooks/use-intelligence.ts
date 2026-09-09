"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";

const DEFAULT_GOALS: BusinessGoals = { riskTolerance: "balanced" };

export function useIntelligence() {
  const { clientId, dateRange } = useFilters();
  const storageKey = `anlux:goals:${clientId}`;
  const [goals, setGoalsState] = useState<BusinessGoals>(DEFAULT_GOALS);
  const [result, setResult] = useState<IntelligenceSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setGoalsState(saved ? { ...DEFAULT_GOALS, ...JSON.parse(saved) } : DEFAULT_GOALS);
    } catch { setGoalsState(DEFAULT_GOALS); }
  }, [clientId, storageKey]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ accountId: clientId, from: dateRange.from, to: dateRange.to, risk: goals.riskTolerance ?? "balanced" });
    if (goals.targetCostPerResult != null) p.set("targetCpr", String(goals.targetCostPerResult));
    if (goals.minimumRoas != null) p.set("minRoas", String(goals.minimumRoas));
    if (goals.monthlyBudget != null) p.set("monthlyBudget", String(goals.monthlyBudget));
    if (goals.grossMarginPercent != null) p.set("margin", String(goals.grossMarginPercent));
    return p.toString();
  }, [clientId, dateRange.from, dateRange.to, goals]);

  useEffect(() => {
    if (!clientId) { setResult(null); return; }
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/meta/intelligence?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "No se pudo calcular la inteligencia."); return data; })
      .then((data) => setResult(data as IntelligenceSuiteResult))
      .catch((err) => { if (err.name !== "AbortError") setError(err instanceof Error ? err.message : "Error de inteligencia."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clientId, query]);

  function setGoals(next: BusinessGoals) {
    setGoalsState(next);
    if (clientId) localStorage.setItem(storageKey, JSON.stringify(next));
  }

  return { loading, result, error, goals, setGoals };
}
