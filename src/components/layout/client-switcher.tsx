"use client";

import { Radio } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";
import { Dropdown, DropdownItem, DropdownChevron } from "@/components/ui/dropdown";

const META_ACCOUNT_COLOR = "#1877F2";

function accountInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "MA";
}

export function ClientSwitcher() {
  const { clientId, setClientId, realAccounts, realAccountsLoading } = useFilters();

  const current = realAccounts.find((a) => a.id === clientId);
  const label = current?.name ?? (realAccountsLoading ? "Cargando cuentas…" : "Sin cuentas de Meta");
  const subtitle = current?.id ?? (realAccountsLoading ? "" : "Revisa la conexión con Meta");

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2">
          <span
            className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
            style={{ backgroundColor: META_ACCOUNT_COLOR }}
          >
            {accountInitials(current?.name ?? "MA")}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="font-medium text-foreground">{label}</span>
            {subtitle && <span className="text-[11px] text-muted-foreground-2">{subtitle}</span>}
          </span>
          <DropdownChevron />
        </span>
      }
    >
      {(close) => (
        <>
          <p className="flex items-center gap-1.5 px-3.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">
            <Radio className="size-3" />
            Cuentas Meta
          </p>

          {realAccounts.length === 0 ? (
            <p className="px-3.5 py-2 text-xs text-muted-foreground-2">
              {realAccountsLoading
                ? "Cargando cuentas…"
                : "No hay cuentas disponibles con el token actual."}
            </p>
          ) : (
            realAccounts.map((account) => (
              <DropdownItem
                key={account.id}
                active={account.id === clientId}
                onClick={() => {
                  setClientId(account.id);
                  close();
                }}
              >
                <span
                  className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
                  style={{ backgroundColor: META_ACCOUNT_COLOR }}
                >
                  {accountInitials(account.name)}
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span>{account.name}</span>
                  <span className="text-[11px] text-muted-foreground-2">
                    {account.id} · {account.currency}
                  </span>
                </span>
              </DropdownItem>
            ))
          )}
        </>
      )}
    </Dropdown>
  );
}
