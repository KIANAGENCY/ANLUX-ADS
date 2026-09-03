"use client";

import { LogOut, Menu, Sparkles, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ClientSwitcher } from "./client-switcher";
import { DateRangeFilter } from "./date-range-filter";
import { NAV_ITEMS } from "./sidebar";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useAIDrawer } from "@/components/ai/ai-drawer";
import { signOut } from "@/lib/supabase/auth";

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { open: openAIDrawer } = useAIDrawer();
  const title = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "ANLUX";

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-subtle bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:block">
          <ClientSwitcher />
        </div>

        <DateRangeFilter />

        {/* Abre el drawer del AI Analyst — misma llamada a /api/ai/analyze que la página. */}
        <button
          type="button"
          onClick={openAIDrawer}
          className="hidden items-center gap-1.5 rounded-lg border border-accent-ai/30 bg-accent-ai/12 px-3 py-2 text-xs font-semibold text-accent-ai transition-colors hover:bg-accent-ai/20 md:flex"
        >
          <Sparkles className="size-3.5" />
          Analizar
        </button>

        <Dropdown
          align="right"
          trigger={
            <span className="flex size-9 items-center justify-center rounded-full border border-border-subtle bg-surface hover:bg-surface-2">
              <User className="size-4 text-muted-foreground" />
            </span>
          }
        >
          {(close) => (
            <>
              <div className="px-3.5 py-2 text-xs text-muted-foreground-2">Sesión de agencia</div>
              <DropdownItem
                onClick={() => {
                  close();
                  handleLogout();
                }}
              >
                <LogOut className="size-3.5" />
                Cerrar sesión
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
