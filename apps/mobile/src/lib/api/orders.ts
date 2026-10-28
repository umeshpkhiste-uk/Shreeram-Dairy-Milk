import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type OrderRow = Database['public']['Tables']['orders']['Row'];

export type WorkerOrderItem = {
  productName: string;
  unit: 'litre' | 'kg';
  quantity: number;
};

export type WorkerOrder = {
  order: OrderRow;
  items: WorkerOrderItem[];
};

/**
 * Orders assigned to the signed-in worker — RLS already restricts `orders`
 * to rows where `worker_id = auth.uid()`, so no extra filter is needed here.
 * Read-only: the worker app never writes to orders/order_items (no
 * fulfilment action from the worker side, per owner decision).
 */
export async function listOrdersForWorker(): Promise<WorkerOrder[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'active')
    .order('order_date', { ascending: false });
  if (ordersError) throw ordersError;
  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [itemsRes, productsRes] = await Promise.all([
    supabase.from('order_items').select('*').in('order_id', orderIds),
    supabase.from('products').select('id, name, unit'),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (productsRes.error) throw productsRes.error;

  const productById = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const itemsByOrderId = new Map<string, WorkerOrderItem[]>();
  for (const item of itemsRes.data ?? []) {
    const product = productById.get(item.product_id);
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({
      productName: product?.name ?? 'Item',
      unit: product?.unit ?? 'kg',
      quantity: item.quantity,
    });
    itemsByOrderId.set(item.order_id, list);
  }

  return orders.map((order) => ({ order, items: itemsByOrderId.get(order.id) ?? [] }));
}
