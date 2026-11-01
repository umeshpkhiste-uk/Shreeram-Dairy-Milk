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

export type CustomerOrderItem = WorkerOrderItem & { amountPaise: number };

export type CustomerOrder = {
  order: OrderRow;
  items: CustomerOrderItem[];
  totalAmountPaise: number;
};

/**
 * Admin-only: a customer's one-time orders (Paneer, ghee, etc.), shown as
 * their own section on the customer detail screen — kept separate from
 * monthly_bills, never added to that total (see apps/web's equivalent,
 * lib/data/orders.ts#listOrdersForCustomer — orders deliberately bypass the
 * milk billing/payment flow, see migration 20261029090000).
 */
export async function listOrdersForCustomer(customerId: string): Promise<CustomerOrder[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false });
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
  const itemsByOrderId = new Map<string, CustomerOrderItem[]>();
  for (const item of itemsRes.data ?? []) {
    const product = productById.get(item.product_id);
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({
      productName: product?.name ?? 'Item',
      unit: product?.unit ?? 'kg',
      quantity: item.quantity,
      amountPaise: item.amount_paise,
    });
    itemsByOrderId.set(item.order_id, list);
  }

  return orders.map((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    return { order, items, totalAmountPaise: items.reduce((sum, i) => sum + i.amountPaise, 0) };
  });
}
