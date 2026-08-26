"use client";

import { Calendar } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";
import { Dropdown, DropdownItem, DropdownChevron } from "@/components/ui/dropdown";
import { DATE_RANGE_PRESETS, DATE_RANGE_PRESET_LABELS } from "@/lib/utils/dates";

export function DateRangeFilter() {
  const { dateRangePreset, setDateRangePreset } = useFilters();

  return (
    <Dropdown
      align="right"
      trigger={
        <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm hover:bg-white/7">
          <Calendar className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{DATE_RANGE_PRESET_LABELS[dateRangePreset]}</span>
          <DropdownChevron />
        </span>
      }
    >
      {(close) => (
        <>
          {DATE_RANGE_PRESETS.map((preset) => (
            <DropdownItem
              key={preset}
              active={preset === dateRangePreset}
              onClick={() => {
                setDateRangePreset(preset);
                close();
              }}
            >
              {DATE_RANGE_PRESET_LABELS[preset]}
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
