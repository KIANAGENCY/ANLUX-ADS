"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FiltersProvider } from "@/components/providers/filters-provider";
import { AIDrawerProvider } from "@/components/ai/ai-drawer";
import { useAuthState } from "@/hooks/use-auth-state";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ClientSwitcher } from "./client-switcher";

export function DashboardShell({ children }: { children: ReactNode }) {
  const authStatus = useAuthState();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  if (authStatus !== "authenticated") {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
      </div>
    );
  }

  return (
    <FiltersProvider>
      <AIDrawerProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          <div className="hidden lg:block">
            <Sidebar />
          </div>

          {mobileOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
              <div className="relative flex h-full w-72 flex-col border-r border-border-subtle bg-[#070A11]">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2"
                  aria-label="Cerrar menú"
                >
                  <X className="size-5" />
                </button>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
                <div className="border-t border-border-subtle p-4">
                  <ClientSwitcher />
                </div>
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <Topbar onOpenSidebar={() => setMobileOpen(true)} />
            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </AIDrawerProvider>
    </FiltersProvider>
  );
}
