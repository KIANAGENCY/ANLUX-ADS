"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { StatusFilter } from "@/components/ui/status-filter";
import { AdSetsTable } from "@/components/adsets/adsets-table";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useAdSets } from "@/hooks/use-adsets";
import type { EntityStatus } from "@/lib/types";

export default function AdSetsPage() {
  const { loading, adSets, error } = useAdSets();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EntityStatus | "all">("all");

  const filtered = useMemo(() => {
    return adSets.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [adSets, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} conjunto{filtered.length === 1 ? "" : "s"} de anuncios
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            placeholder="Buscar conjunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <StatusFilter value={status} onChange={setStatus} options={["ACTIVE", "PAUSED", "IN_REVIEW", "ARCHIVED"]} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <AdSetsTable adSets={filtered} loading={loading} />
      </Card>
    </div>
  );
}
