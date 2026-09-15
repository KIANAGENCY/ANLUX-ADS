"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { StatusFilter } from "@/components/ui/status-filter";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { CampaignMessagingReport } from "@/components/campaigns/messaging-report";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { EntityStatus } from "@/lib/types";

export default function CampaignsPage() {
  const { loading, campaigns, error } = useCampaigns();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"performance" | "messaging">("performance");
  const [status, setStatus] = useState<EntityStatus | "all">("all");

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [campaigns, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="Vista de campañas">
        <button type="button" aria-pressed={view === "performance"} onClick={() => setView("performance")} className={`rounded-lg border px-4 py-2 text-sm ${view === "performance" ? "border-accent text-accent-light" : "border-border-subtle text-muted-foreground"}`}>Rendimiento</button>
        <button type="button" aria-pressed={view === "messaging"} onClick={() => setView("messaging")} className={`rounded-lg border px-4 py-2 text-sm ${view === "messaging" ? "border-accent text-accent-light" : "border-border-subtle text-muted-foreground"}`}>Conversaciones</button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} campaña{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            placeholder="Buscar campaña..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <StatusFilter value={status} onChange={setStatus} options={["ACTIVE", "PAUSED", "IN_REVIEW", "ARCHIVED"]} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {view === "messaging" ? <CampaignMessagingReport campaigns={filtered} loading={loading} /> : <Card>
        <CampaignsTable campaigns={filtered} loading={loading} />
      </Card>}
    </div>
  );
}
