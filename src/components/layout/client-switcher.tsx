"use client";

import { Radio } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";
import { Dropdown, DropdownItem, DropdownChevron } from "@/components/ui/dropdown";
import { MOCK_CLIENTS } from "@/lib/mock/entities";

const META_ACCOUNT_COLOR = "#1877F2";

function accountInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "MA";
}

export function ClientSwitcher() {
  const { clientId, setClientId, isRealAccount, realAccounts } = useFilters();

  const mockClient = MOCK_CLIENTS.find((c) => c.id === clientId);
  const realAccount = realAccounts.find((a) => a.id === clientId);

  const current = isRealAccount
    ? {
        name: realAccount?.name ?? "Cuenta Meta",
        subtitle: realAccount ? realAccount.id : "Meta Real",
        initials: accountInitials(realAccount?.name ?? "MA"),
        color: META_ACCOUNT_COLOR,
      }
    : {
        name: mockClient?.name ?? MOCK_CLIENTS[0].name,
        subtitle: mockClient?.industry ?? MOCK_CLIENTS[0].industry,
        initials: mockClient?.initials ?? MOCK_CLIENTS[0].initials,
        color: mockClient?.accentColor ?? MOCK_CLIENTS[0].accentColor,
      };

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2">
          <span
            className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
            style={{ backgroundColor: current.color }}
          >
            {current.initials}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="font-medium text-foreground">{current.name}</span>
            <span className="text-[11px] text-muted-foreground-2">{current.subtitle}</span>
          </span>
          <span
            className={
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] " +
              (isRealAccount
                ? "bg-positive/12 text-positive ring-1 ring-positive/25"
                : "bg-warning/12 text-warning ring-1 ring-warning/25")
            }
          >
            {isRealAccount ? "REAL" : "DEMO"}
          </span>
          <DropdownChevron />
        </span>
      }
    >
      {(close) => (
        <>
          <p className="px-3.5 pb-1.5 pt-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">
            Clientes (demo)
          </p>
          {MOCK_CLIENTS.map((client) => (
            <DropdownItem
              key={client.id}
              active={client.id === clientId}
              onClick={() => {
                setClientId(client.id);
                close();
              }}
            >
              <span
                className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
                style={{ backgroundColor: client.accentColor }}
              >
                {client.initials}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span>{client.name}</span>
                <span className="text-[11px] text-muted-foreground-2">{client.industry}</span>
              </span>
            </DropdownItem>
          ))}

          {realAccounts.length > 0 && (
            <>
              <p className="mt-1 flex items-center gap-1.5 border-t border-border-subtle px-3.5 pb-1.5 pt-2.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground-2 uppercase">
                <Radio className="size-3" />
                Cuentas Meta (real)
              </p>
              {realAccounts.map((account) => (
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
              ))}
            </>
          )}
        </>
      )}
    </Dropdown>
  );
}
