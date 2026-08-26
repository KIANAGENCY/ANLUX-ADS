"use client";

import type { EntityStatus } from "@/lib/types";
import { Dropdown, DropdownItem, DropdownChevron } from "@/components/ui/dropdown";
import { Filter } from "lucide-react";

const STATUS_LABELS: Record<EntityStatus, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  IN_REVIEW: "En revisión",
  ARCHIVED: "Archivado",
};

export function StatusFilter({
  value,
  onChange,
  options,
}: {
  value: EntityStatus | "all";
  onChange: (value: EntityStatus | "all") => void;
  options: EntityStatus[];
}) {
  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm hover:bg-white/7">
          <Filter className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{value === "all" ? "Todos los estados" : STATUS_LABELS[value]}</span>
          <DropdownChevron />
        </span>
      }
    >
      {(close) => (
        <>
          <DropdownItem
            active={value === "all"}
            onClick={() => {
              onChange("all");
              close();
            }}
          >
            Todos los estados
          </DropdownItem>
          {options.map((status) => (
            <DropdownItem
              key={status}
              active={value === status}
              onClick={() => {
                onChange(status);
                close();
              }}
            >
              {STATUS_LABELS[status]}
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
