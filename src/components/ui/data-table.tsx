"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { TableSkeleton } from "./skeleton";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowClick,
  loading,
  emptyState,
  defaultSortKey,
  defaultSortDirection = "desc",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    const factor = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "string" || typeof bv === "string") {
        return factor * String(av).localeCompare(String(bv));
      }
      return factor * ((av as number) - (bv as number));
    });
  }, [rows, columns, sortKey, sortDirection]);

  function handleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDirection("desc");
    }
  }

  if (loading) return <TableSkeleton />;
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-xs font-medium text-muted-foreground select-none whitespace-nowrap",
                  column.align === "right" && "text-right",
                  column.sortValue && "cursor-pointer hover:text-foreground"
                )}
                onClick={() => handleSort(column)}
              >
                <span className={cn("inline-flex items-center gap-1", column.align === "right" && "flex-row-reverse")}>
                  {column.label}
                  {column.sortValue &&
                    (sortKey === column.key ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3 opacity-40" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-white/5 last:border-0",
                onRowClick && "cursor-pointer hover:bg-white/4"
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 whitespace-nowrap text-foreground/90",
                    column.align === "right" && "text-right",
                    column.className
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
