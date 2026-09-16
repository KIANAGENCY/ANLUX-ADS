-- optional human quality signal for Meta conversations.
-- this is additive: Meta remains the source of started conversations and this
-- table only stores an explicitly supplied assessment from an ANLUX member.

begin;

create table if not exists public.campaign_quality_feedback (
  id bigint generated always as identity primary key,
  ad_account_id text not null references public.meta_ad_accounts(id) on delete cascade,
  campaign_id text not null,
  period_to date not null,
  qualified_conversations numeric not null check (qualified_conversations >= 0),
  reported_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ad_account_id, campaign_id, period_to, reported_by)
);

create index if not exists campaign_quality_feedback_account_campaign_period_idx
  on public.campaign_quality_feedback (ad_account_id, campaign_id, period_to desc);

alter table public.campaign_quality_feedback enable row level security;

create policy quality_feedback_member_select
  on public.campaign_quality_feedback
  for select
  to authenticated
  using (public.is_anlux_member());

create policy quality_feedback_member_insert
  on public.campaign_quality_feedback
  for insert
  to authenticated
  with check (public.is_anlux_member() and reported_by = auth.uid());

create policy quality_feedback_member_update
  on public.campaign_quality_feedback
  for update
  to authenticated
  using (public.is_anlux_member() and reported_by = auth.uid())
  with check (public.is_anlux_member() and reported_by = auth.uid());

commit;
