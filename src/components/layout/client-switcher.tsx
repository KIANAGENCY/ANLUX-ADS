"use client";

import { useFilters } from "@/components/providers/filters-provider";
import { Dropdown, DropdownItem, DropdownChevron } from "@/components/ui/dropdown";
import { MOCK_CLIENTS } from "@/lib/mock/entities";

export function ClientSwitcher() {
  const { clientId, setClientId } = useFilters();
  const current = MOCK_CLIENTS.find((c) => c.id === clientId) ?? MOCK_CLIENTS[0];

  return (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm hover:bg-white/7">
          <span
            className="flex size-6 items-center justify-center rounded-md text-[11px] font-semibold text-white"
            style={{ backgroundColor: current.accentColor }}
          >
            {current.initials}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="font-medium text-foreground">{current.name}</span>
            <span className="text-[11px] text-muted-foreground">{current.industry}</span>
          </span>
          <DropdownChevron />
        </span>
      }
    >
      {(close) => (
        <>
          <p className="px-3.5 pb-1.5 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Clientes
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
                <span className="text-[11px] text-muted-foreground">{client.industry}</span>
              </span>
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
