"use client";

import { LogOut, Menu, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ClientSwitcher } from "./client-switcher";
import { DateRangeFilter } from "./date-range-filter";
import { NAV_ITEMS } from "./sidebar";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { signOut } from "@/lib/supabase/auth";

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const title = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "ANLUX";

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/8 bg-background/85 px-4 py-3 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/6 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden sm:block">
          <ClientSwitcher />
        </div>
        <DateRangeFilter />
        <Dropdown
          align="right"
          trigger={
            <span className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">
              <User className="size-4 text-muted-foreground" />
            </span>
          }
        >
          {(close) => (
            <>
              <div className="px-3.5 py-2 text-xs text-muted-foreground">Sesión de agencia</div>
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
