-- The current decision for one entity and evaluated period is updated on each
-- recalculation. A changing action/score does not create a second "current" row.
begin;

do $$
begin
  if exists (select 1 from public.decision_feedback) then
    raise exception 'Review decision_feedback before deduplicating decision_history';
  end if;
end $$;

-- Preserve superseded rows before collapsing the former action/score versions.
create table if not exists anlux_private.decision_history_revisions (
  original_id bigint primary key,
  decision jsonb not null,
  archived_at timestamptz not null default now()
);
alter table anlux_private.decision_history_revisions enable row level security;
revoke all on anlux_private.decision_history_revisions from public, anon, authenticated;

with ranked as (
  select id, row_number() over (
    partition by ad_account_id, period_from, period_to, entity_type, entity_id
    order by generated_at desc, stored_at desc, id desc
  ) as ordinal
  from public.decision_history
)
insert into anlux_private.decision_history_revisions (original_id, decision)
select d.id, to_jsonb(d)
from public.decision_history as d
join ranked as r on d.id = r.id
where r.ordinal > 1
on conflict (original_id) do nothing;

with ranked as (
  select id, row_number() over (
    partition by ad_account_id, period_from, period_to, entity_type, entity_id
    order by generated_at desc, stored_at desc, id desc
  ) as ordinal
  from public.decision_history
)
delete from public.decision_history as d
using ranked as r
where d.id = r.id and r.ordinal > 1;

alter table public.decision_history
  drop constraint decision_history_ad_account_id_period_from_period_to_entity_key;
alter table public.decision_history
  add constraint decision_history_entity_period_key
  unique (ad_account_id, period_from, period_to, entity_type, entity_id);

create policy decisions_member_update on public.decision_history
for update to authenticated
using ((select anlux_private.is_anlux_member()))
with check ((select anlux_private.is_anlux_member()));

commit;
