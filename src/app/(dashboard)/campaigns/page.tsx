"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { StatusFilter } from "@/components/ui/status-filter";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { EntityStatus } from "@/lib/types";

export default function CampaignsPage() {
  const { loading, campaigns } = useCampaigns();
  const [search, setSearch] = useState("");
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

      <Card>
        <CampaignsTable campaigns={filtered} loading={loading} />
      </Card>
    </div>
  );
}
