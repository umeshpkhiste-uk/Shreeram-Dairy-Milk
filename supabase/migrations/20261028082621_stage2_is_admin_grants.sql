-- Supabase grants EXECUTE on new public-schema functions directly to the
-- `anon`, `authenticated`, and `service_role` API roles (not only to PUBLIC),
-- so revoking from PUBLIC alone left `anon` still able to call is_admin().
-- Lock it to `authenticated` only — an unauthenticated caller has no use for
-- it (auth.uid() is null, it would just always return false), and least
-- privilege is still worth it even though it's not an exploitable path.

revoke all on function public.is_admin() from anon;
