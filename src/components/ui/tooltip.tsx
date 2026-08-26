"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Tooltip ligero, sin dependencias externas, para explicar métricas en el hover. */
export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-[#181a28] px-2.5 py-1.5 text-xs text-foreground/90 shadow-xl"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#181a28]" />
        </span>
      )}
    </span>
  );
}
