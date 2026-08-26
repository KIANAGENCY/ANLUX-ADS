"use client";

import {
  LayoutDashboard,
  Megaphone,
  Layers,
  Image as ImageIcon,
  Trophy,
  Sparkles,
  BellRing,
  Settings,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campañas", icon: Megaphone },
  { href: "/adsets", label: "Conjuntos", icon: Layers },
  { href: "/ads", label: "Anuncios", icon: ImageIcon },
  { href: "/creatives", label: "Creativos", icon: Trophy },
  { href: "/ai-analyst", label: "AI Analyst", icon: Sparkles },
  { href: "/alerts", label: "Alertas", icon: BellRing },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/8 bg-[#08091200]">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg gradient-accent">
          <BarChart3 className="size-4.5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">ANLUX</p>
          <p className="text-[11px] text-muted-foreground">Ads Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/8 text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground/90"
              )}
            >
              <Icon className={cn("size-4", active && "text-[#a9a8ff]")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 px-4 py-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          MVP en modo demo · datos simulados
        </p>
      </div>
    </aside>
  );
}
