"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";

interface RequestState { key: string; result: IntelligenceSuiteResult | null; error: string | null }
interface GoalsState { accountId: string; goals: BusinessGoals }
const EMPTY_GOALS: BusinessGoals = {};

export function useIntelligence() {
  const { clientId, dateRange } = useFilters();
  const [goalsState, setGoalsState] = useState<GoalsState | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [memorySavedKey, setMemorySavedKey] = useState<string | null>(null);
  const goals = goalsState?.accountId === clientId ? goalsState.goals : EMPTY_GOALS;
  const goalsLoaded = goalsState?.accountId === clientId;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    fetch(`/api/meta/memory/goals?accountId=${encodeURIComponent(clientId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las metas guardadas.");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setGoalsState({ accountId: clientId, goals: payload.goals ?? {} });
        setGoalsError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setGoalsError(error instanceof Error ? error.message : "Error al cargar metas.");
      });
    return () => { cancelled = true; };
  }, [clientId]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ accountId: clientId, from: dateRange.from, to: dateRange.to });
    if (goals.riskTolerance) params.set("risk", goals.riskTolerance);
    if (goals.targetCostPerResult != null) params.set("targetCpr", String(goals.targetCostPerResult));
    if (goals.minimumRoas != null) params.set("minRoas", String(goals.minimumRoas));
    if (goals.monthlyBudget != null) params.set("monthlyBudget", String(goals.monthlyBudget));
    if (goals.grossMarginPercent != null) params.set("margin", String(goals.grossMarginPercent));
    return params.toString();
  }, [clientId, dateRange.from, dateRange.to, goals]);
  const key = `${clientId}|${query}`;
  const [state, setState] = useState<RequestState | null>(null);
  useEffect(() => {
    if (!clientId || !goalsLoaded) return;
    let cancelled = false;
    fetch(`/api/meta/intelligence?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "No se pudo calcular la inteligencia.");
        return payload as IntelligenceSuiteResult;
      })
      .then((result) => { if (!cancelled) setState({ key, result, error: null }); })
      .catch((error: unknown) => {
        if (!cancelled) setState({ key, result: null, error: error instanceof Error ? error.message : "Error de inteligencia." });
      });
    return () => { cancelled = true; };
  }, [clientId, goalsLoaded, query, key]);

  function setGoals(next: BusinessGoals) {
    setGoalsState({ accountId: clientId, goals: next });
  }
  async function saveGoals() {
    if (!clientId || !goalsLoaded) return;
    setSavingGoals(true);
    setGoalsError(null);
    try {
      const response = await fetch("/api/meta/memory/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: clientId, goals }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? payload.status?.message ?? "No se pudieron guardar las metas.");
      setGoalsState({ accountId: clientId, goals: payload.goals });
    } catch (error) {
      setGoalsError(error instanceof Error ? error.message : "Error al guardar metas.");
    } finally {
      setSavingGoals(false);
    }
  }
  async function saveMemory() {
    if (!clientId || !goalsLoaded || savingMemory) return;
    setSavingMemory(true);
    try {
      const response = await fetch(`/api/meta/intelligence?${query}`, { method: "POST", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar la memoria.");
      if (payload.memory?.state !== "ready") throw new Error(payload.memory?.message ?? "No se pudo guardar la memoria.");
      setState({ key, result: payload as IntelligenceSuiteResult, error: null });
      setMemorySavedKey(key);
    } catch (error) {
      setMemorySavedKey(null);
      setState((current) => ({ key, result: current?.key === key ? current.result : null,
        error: error instanceof Error ? error.message : "Error al guardar la memoria." }));
    } finally {
      setSavingMemory(false);
    }
  }
  async function refresh() {
    if (!clientId || !goalsLoaded) return;
    const response = await fetch(`/api/meta/intelligence?${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el análisis.");
    setState({ key, result: payload as IntelligenceSuiteResult, error: null });
  }
  return { loading: Boolean(clientId) && (!goalsLoaded || state?.key !== key), result: goalsLoaded && state?.key === key ? state.result : null,
    error: goalsError ?? (goalsLoaded && state?.key === key ? state.error : null), goals, setGoals, saveGoals, savingGoals, saveMemory, savingMemory, refresh,
    memorySaved: memorySavedKey === key };
}
