import type { PerformanceDecision, PortfolioRecommendation } from "./types";

/**
 * Compares only independent campaign totals with the same Meta outcome.
 * An ad and its parent campaign must never be counted as competing investments.
 */
export function recommendPortfolio(decisions: readonly PerformanceDecision[], currency: string | null): PortfolioRecommendation[] {
  const campaigns = decisions.filter((decision) =>
    decision.entityType === "campaign" &&
    decision.resultType && decision.currentResultsAvailable !== false &&
    decision.currentMetrics.results >= 10 && decision.currentMetrics.spend > 0 &&
    decision.currentMetrics.costPerResult > 0 &&
    decision.confidence !== "low" &&
    (!decision.startDate || Date.now() - new Date(decision.startDate).getTime() >= 3 * 86_400_000)
  );
  const groups = new Map<string, PerformanceDecision[]>();
  for (const campaign of campaigns) {
    const key = `${campaign.objective}:${campaign.resultType}`;
    groups.set(key, [...(groups.get(key) ?? []), campaign]);
  }
  const recommendations: PortfolioRecommendation[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => a.currentMetrics.costPerResult - b.currentMetrics.costPerResult);
    const to = ranked[0];
    const from = ranked.at(-1)!;
    const gap = (from.currentMetrics.costPerResult - to.currentMetrics.costPerResult) / from.currentMetrics.costPerResult;
    if (gap < 0.25) continue;
    const hasComparableHistory = [to, from].every((campaign) =>
      campaign.previousResultType === campaign.resultType &&
      campaign.previousResultsAvailable !== false &&
      campaign.previousMetrics.results >= 5 && campaign.previousMetrics.costPerResult > 0
    );
    const stable = hasComparableHistory &&
      to.previousMetrics.costPerResult <= from.previousMetrics.costPerResult * 1.1;
    // Meta-only cost does not establish the quality of the conversations.
    // A budget test is allowed only when both campaigns have comparable human evidence.
    const toQualified = to.qualifiedConversations ?? null;
    const fromQualified = from.qualifiedConversations ?? null;
    const comparableQuality = toQualified !== null && fromQualified !== null && toQualified >= 5 && fromQualified >= 5 &&
      to.currentMetrics.spend / toQualified < from.currentMetrics.spend / fromQualified * 0.8;
    const action = stable && comparableQuality ? "TEST_REALLOCATION" : "COMPARE_QUALITY";
    const money = (amount: number) => `${amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${currency ?? "en moneda de la cuenta"}`;
    recommendations.push({
      id: `portfolio:${from.entityId}:${to.entityId}`,
      action,
      fromCampaignId: from.entityId,
      fromCampaignName: from.entityName,
      toCampaignId: to.entityId,
      toCampaignName: to.entityName,
      resultType: to.resultType!,
      currentFromCost: from.currentMetrics.costPerResult,
      currentToCost: to.currentMetrics.costPerResult,
      currentFromResults: from.currentMetrics.results,
      currentToResults: to.currentMetrics.results,
      relativeCostGapPercent: Math.round(gap * 100),
      explanation: `${to.entityName} obtuvo ${to.currentMetrics.results} resultados a ${money(to.currentMetrics.costPerResult)} cada uno; ${from.entityName} obtuvo ${from.currentMetrics.results} a ${money(from.currentMetrics.costPerResult)}. El costo de la primera fue ${Math.round(gap * 100)}% menor para el mismo tipo de resultado reportado por Meta.`,
      nextStep: stable
        ? `Si la calidad de ambos resultados es comparable, prueba mover como máximo 10% del presupuesto de ${from.entityName} hacia ${to.entityName} y compara costo y calidad durante siete días.`
        : `Comprueba la calidad de los resultados y el periodo anterior de ambas campañas antes de mover presupuesto. Si son comparables, prueba una reasignación de hasta 10% y revisa siete días después.`,
      safeguard: "Comparar costos no demuestra que los clientes finales tengan la misma calidad. ANLUX no cambia presupuestos ni asegura más ventas.",
    });
  }
  return recommendations.sort((a, b) => b.relativeCostGapPercent - a.relativeCostGapPercent).slice(0, 3);
}
