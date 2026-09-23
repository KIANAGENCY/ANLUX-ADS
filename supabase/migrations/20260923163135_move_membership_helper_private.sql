-- Keep the SECURITY DEFINER membership check available to RLS while removing
-- its public Data API RPC surface. ALTER FUNCTION preserves the OID used by
-- existing policy expressions.
begin;
create schema if not exists anlux_private;
revoke all on schema anlux_private from public, anon;
grant usage on schema anlux_private to authenticated;

alter function public.is_anlux_member() set schema anlux_private;
revoke all on function anlux_private.is_anlux_member() from public, anon;
grant execute on function anlux_private.is_anlux_member() to authenticated;
commit;
