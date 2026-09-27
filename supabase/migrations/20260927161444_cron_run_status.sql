-- Private operational heartbeat for the daily job. Service role only.
create table public.anlux_cron_runs (
  period date primary key,
  started_at timestamptz not null default now(),
  snapshot_success_at timestamptz,
  finished_at timestamptz,
  last_error text,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'skipped', 'failed')),
  email_id text
);

alter table public.anlux_cron_runs enable row level security;
revoke all on public.anlux_cron_runs from public, anon, authenticated;
grant select, insert, update on public.anlux_cron_runs to service_role;
comment on table public.anlux_cron_runs is 'Daily job health, separated from account observations and email delivery.';
