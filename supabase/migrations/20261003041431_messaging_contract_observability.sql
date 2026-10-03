-- Operational evidence only; existing service-only RLS and grants are retained.
-- NULL on older rows means not checked, never verified.
alter table public.anlux_cron_runs
  add column if not exists messaging_contract jsonb;
comment on column public.anlux_cron_runs.messaging_contract is
  'Sanitized live Meta contract checks; independent of snapshot and email success.';
