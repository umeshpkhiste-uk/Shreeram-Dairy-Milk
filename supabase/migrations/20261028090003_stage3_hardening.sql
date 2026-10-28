-- Stage 3: security hardening pass (after supabase db advisors --linked).
--
-- resolve_milk_price_paise is an internal helper used only inside
-- submit_delivery_event's SECURITY DEFINER context — it has no business
-- being directly callable over /rest/v1/rpc/resolve_milk_price_paise.
-- submit_delivery_event itself staying callable by `authenticated` is
-- intentional (it is the one write path), same documented exception as
-- is_admin() from Stage 2.

revoke execute on function public.resolve_milk_price_paise(uuid, uuid, date)
  from authenticated;
