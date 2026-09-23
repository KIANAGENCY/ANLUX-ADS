-- Restrict the membership helper to signed-in ANLUX users. RLS policies
-- still invoke it, so authenticated retains EXECUTE.
begin;
revoke execute on function public.is_anlux_member() from public, anon;
grant execute on function public.is_anlux_member() to authenticated;

-- Evaluate stable membership and auth predicates once per statement instead
-- of repeating a function call for each row. Preserve each existing policy.
do $$
declare p record;
declare expression text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check
           from pg_policies
           where schemaname = 'public' and (
             qual like '%is_anlux_member()%' or with_check like '%is_anlux_member()%'
             or qual like '%auth.uid()%' or with_check like '%auth.uid()%'
           ) loop
    if p.qual is not null then
      expression := replace(replace(replace(replace(p.qual,
        'public.is_anlux_member()', '__ANLUX_MEMBER_CHECK__'),
        'is_anlux_member()', '__ANLUX_MEMBER_CHECK__'),
        '__ANLUX_MEMBER_CHECK__', '(select public.is_anlux_member())'),
        'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on %I.%I using (%s)',
        p.policyname, p.schemaname, p.tablename, expression);
    end if;
    if p.with_check is not null then
      expression := replace(replace(replace(replace(p.with_check,
        'public.is_anlux_member()', '__ANLUX_MEMBER_CHECK__'),
        'is_anlux_member()', '__ANLUX_MEMBER_CHECK__'),
        '__ANLUX_MEMBER_CHECK__', '(select public.is_anlux_member())'),
        'auth.uid()', '(select auth.uid())');
      execute format('alter policy %I on %I.%I with check (%s)',
        p.policyname, p.schemaname, p.tablename, expression);
    end if;
  end loop;
end $$;

create index if not exists decision_feedback_reviewed_by_idx on public.decision_feedback (reviewed_by);
create index if not exists campaign_quality_feedback_reported_by_idx on public.campaign_quality_feedback (reported_by);
commit;
