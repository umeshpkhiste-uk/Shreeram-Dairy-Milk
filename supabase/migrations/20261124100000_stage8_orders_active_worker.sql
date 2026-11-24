-- Stage 8: close the same gap Stage 6 closed for customers/routes/deliveries
-- (20261028120000_stage6_security_hardening.sql). orders/order_items were
-- added later and checked only "is this assigned to me?", so a deactivated
-- worker could keep reading their orders until their token expired.

alter policy "orders_select_admin_or_assigned_worker" on public.orders
  using (
    public.is_admin()
    or (worker_id = (select auth.uid()) and public.is_active_worker())
  );

alter policy "order_items_select_admin_or_assigned_worker" on public.order_items
  using (
    public.is_admin()
    or (
      public.is_active_worker()
      and exists (
        select 1 from public.orders o
        where o.id = order_items.order_id and o.worker_id = (select auth.uid())
      )
    )
  );
