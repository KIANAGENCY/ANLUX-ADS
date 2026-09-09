-- ANLUX Memory v1
-- Apply manually in Supabase only after reviewing the seed step at the bottom.
-- No service_role key is required by the application: runtime access uses the
-- authenticated user's publishable-key client and Row Level Security.

begin;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'analyst' check (role in ('admin','analyst')),
  created_at timestamptz not null default now()
);

create table if not exists public.meta_ad_accounts (
  id text primary key,
  name text,
  currency text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_goals (
  ad_account_id text primary key references public.meta_ad_accounts(id) on delete cascade,
  target_cost_per_result numeric check (target_cost_per_result is null or target_cost_per_result >= 0),
  minimum_roas numeric check (minimum_roas is null or minimum_roas >= 0),
  monthly_budget numeric check (monthly_budget is null or monthly_budget >= 0),
  gross_margin_percent numeric check (gross_margin_percent is null or (gross_margin_percent >= 0 and gross_margin_percent <= 100)),
  risk_tolerance text not null default 'balanced' check (risk_tolerance in ('conservative','balanced','growth')),
  updated_at timestamptz not null default now()
);

-- One canonical observation per account + evaluated period. Re-running the same
-- period updates the observation rather than fabricating duplicate history.
create table if not exists public.account_period_observations (
  id bigint generated always as identity primary key,
  ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  spend numeric not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  results numeric not null default 0,
  decision_summary jsonb not null default '{}'::jsonb,
  forecast jsonb,
  captured_at timestamptz not null default now(),
  unique(ad_account_id, period_from, period_to),
  check (period_from <= period_to)
);

create table if not exists public.decision_history (
  id bigint generated always as identity primary key,
  ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  entity_type text not null check (entity_type in ('campaign','adset','ad')),
  entity_id text not null,
  entity_name text not null,
  campaign_id text not null,
  objective text not null,
  action text not null,
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('low','medium','high')),
  risk text not null check (risk in ('low','medium','high')),
  suggested_change_percent numeric,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  metrics_current jsonb not null,
  metrics_previous jsonb not null,
  generated_at timestamptz not null,
  stored_at timestamptz not null default now(),
  unique(ad_account_id, period_from, period_to, entity_type, entity_id, action, score)
);

create table if not exists public.decision_feedback (
  id bigint generated always as identity primary key,
  decision_id bigint not null references public.decision_history(id) on delete cascade,
  reviewed_by uuid not null references public.users(id) on delete restrict,
  outcome text not null check (outcome in ('accepted','rejected','deferred')),
  notes text check (notes is null or char_length(notes) <= 2000),
  observed_result jsonb,
  created_at timestamptz not null default now(),
  unique(decision_id, reviewed_by)
);

alter table public.users enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.business_goals enable row level security;
alter table public.account_period_observations enable row level security;
alter table public.decision_history enable row level security;
alter table public.decision_feedback enable row level security;

-- Membership is deliberately NOT self-service. A signed-in person has no data
-- access unless their auth.users UUID was explicitly seeded into public.users.
create or replace function public.is_anlux_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.users u where u.id = auth.uid());
$$;

revoke all on function public.is_anlux_member() from public;
grant execute on function public.is_anlux_member() to authenticated;

-- Users may only see their own membership record. There is no INSERT/UPDATE
-- policy: membership must be provisioned by an administrator in Supabase.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users for select to authenticated
using (id = auth.uid());

-- Internal agency members share the connected account intelligence. This is
-- suitable for ANLUX's current single-agency model and can later be narrowed
-- with an account_access join table if external client logins are introduced.
create policy meta_accounts_member_select on public.meta_ad_accounts for select to authenticated using (public.is_anlux_member());
create policy meta_accounts_member_insert on public.meta_ad_accounts for insert to authenticated with check (public.is_anlux_member());
create policy meta_accounts_member_update on public.meta_ad_accounts for update to authenticated using (public.is_anlux_member()) with check (public.is_anlux_member());

create policy business_goals_member_select on public.business_goals for select to authenticated using (public.is_anlux_member());
create policy business_goals_member_insert on public.business_goals for insert to authenticated with check (public.is_anlux_member());
create policy business_goals_member_update on public.business_goals for update to authenticated using (public.is_anlux_member()) with check (public.is_anlux_member());

create policy observations_member_select on public.account_period_observations for select to authenticated using (public.is_anlux_member());
create policy observations_member_insert on public.account_period_observations for insert to authenticated with check (public.is_anlux_member());
create policy observations_member_update on public.account_period_observations for update to authenticated using (public.is_anlux_member()) with check (public.is_anlux_member());

create policy decisions_member_select on public.decision_history for select to authenticated using (public.is_anlux_member());
create policy decisions_member_insert on public.decision_history for insert to authenticated with check (public.is_anlux_member());

create policy feedback_member_select on public.decision_feedback for select to authenticated using (public.is_anlux_member());
create policy feedback_member_insert on public.decision_feedback for insert to authenticated
with check (public.is_anlux_member() and reviewed_by = auth.uid());
create policy feedback_member_update on public.decision_feedback for update to authenticated
using (public.is_anlux_member() and reviewed_by = auth.uid())
with check (public.is_anlux_member() and reviewed_by = auth.uid());

commit;

-- REQUIRED MANUAL SEED AFTER THIS MIGRATION:
-- 1) In Supabase Authentication > Users, copy the UUID of the trusted ANLUX user.
-- 2) In SQL Editor run, replacing placeholders:
-- insert into public.users(id,email,role) values ('<AUTH_USER_UUID>','<TRUSTED_EMAIL>','admin')
-- on conflict (id) do update set email=excluded.email, role='admin';
--
-- Do not create a policy that lets authenticated users insert themselves into
-- public.users. That would turn public Supabase signup into ANLUX authorization.
