"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { WinnerCard } from "@/components/creatives/winner-card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAds } from "@/hooks/use-ads";
import { computeCreativeWinners } from "@/lib/utils/creatives";

export default function CreativesPage() {
  const { loading, ads } = useAds();
  const winners = useMemo(() => computeCreativeWinners(ads), [ads]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Anuncios que lideran en al menos una métrica clave durante el periodo seleccionado.
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : winners.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sin datos suficientes"
          description="No hay anuncios con resultados en este periodo para identificar ganadores."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {winners.map((winner) => (
            <WinnerCard key={winner.ad.id} winner={winner} />
          ))}
        </div>
      )}
    </div>
  );
}
