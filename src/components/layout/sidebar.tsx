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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFilters } from "@/components/providers/filters-provider";
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

/**
 * Agrupación puramente visual del nav. Deriva de `NAV_ITEMS` por `href`, así
 * que el array exportado (que consume `topbar.tsx` para el título) no cambia
 * de forma ni de orden.
 */
const NAV_SECTIONS: { label: string; hrefs: string[] }[] = [
  { label: "Análisis", hrefs: ["/overview", "/campaigns", "/adsets", "/ads", "/creatives"] },
  { label: "Inteligencia", hrefs: ["/ai-analyst", "/alerts"] },
  { label: "Cuenta", hrefs: ["/settings"] },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isRealAccount } = useFilters();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border-subtle bg-[#070A11]">
      <div className="px-5 py-5">
        <Link href="/overview" onClick={onNavigate} className="inline-flex items-center" aria-label="ANLUX App">
          <Image
            src="/brand/anlux-app-logo-dark.png"
            alt="ANLUX App"
            width={1951}
            height={901}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <p className="mt-2 text-[10px] font-medium tracking-[0.14em] text-muted-foreground-2 uppercase">
          Ads Intelligence
        </p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((item) => section.hrefs.includes(item.href));
          if (items.length === 0) return null;

          return (
            <div key={section.label} className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">
                {section.label}
              </p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/12 text-foreground"
                        : "text-muted-foreground hover:bg-surface-2/70 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-full bg-accent" aria-hidden />
                    )}
                    <Icon className={cn("size-4 shrink-0", active ? "text-accent-light" : "text-muted-foreground-2")} />
                    {label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!isRealAccount && (
        <div className="border-t border-border-subtle px-4 py-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground-2">
            MVP en modo demo · datos simulados
          </p>
        </div>
      )}
    </aside>
  );
}
