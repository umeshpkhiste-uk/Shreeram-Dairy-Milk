-- Stage 2 follow-up: lock down trigger-only functions.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default, which
-- makes these callable directly as RPCs (e.g. POST /rest/v1/rpc/handle_new_user)
-- even though they are meant to run only as triggers. Triggers invoke them as
-- the table owner regardless of grants to other roles, so revoking public/
-- anon/authenticated execute here does not break anything — it only removes
-- the unintended direct-call surface. Caught by `supabase db advisors`.

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_self_privilege_escalation() from public, anon, authenticated;
revoke all on function public.set_created_by() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;

-- Also pin search_path on set_updated_at (flagged as "mutable search_path").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
