"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { StatusFilter } from "@/components/ui/status-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/skeleton";
import { AdCard } from "@/components/ads/ad-card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useAds } from "@/hooks/use-ads";
import type { EntityStatus } from "@/lib/types";

export default function AdsPage() {
  const { loading, ads, error } = useAds();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EntityStatus | "all">("all");

  const filtered = useMemo(() => {
    return ads.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [ads, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} anuncio{filtered.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            placeholder="Buscar anuncio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
          <StatusFilter value={status} onChange={setStatus} options={["ACTIVE", "PAUSED", "IN_REVIEW", "ARCHIVED"]} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No hay anuncios para este filtro" description="Ajusta la búsqueda o el estado." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
    </div>
  );
}
