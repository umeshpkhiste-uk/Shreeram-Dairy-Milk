-- prevent_self_privilege_escalation also blocked direct database access
-- (Supabase CLI / dashboard SQL editor / psql), because those sessions have
-- no `auth.uid()` — the same signal as "not an admin". That's wrong: direct
-- DB access already requires the project's database password or Supabase
-- account/project membership, a *stronger* trust boundary than a REST API
-- JWT. It's exactly the legitimate way to bootstrap the very first admin
-- account (there is no admin yet to do it through the API).
--
-- Only block the self-escalation attempt when there IS an authenticated API
-- caller (auth.uid() is not null) who isn't an admin. A null auth.uid()
-- means "not coming through the authenticated REST API at all" — allow it.

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'Only an admin can change role or active status';
  end if;
  return new;
end;
$$;
