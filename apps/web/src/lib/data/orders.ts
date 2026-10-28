import type { Database, PaymentMethod } from '@shreeram/shared';

import type { SupabaseServerClient } from './types';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type OrderWithDetails = {
  order: OrderRow;
  customerName: string;
  workerName: string;
  items: {
    productId: string;
    productName: string;
    unit: Database['public']['Tables']['products']['Row']['unit'];
    quantity: number;
    pricePaise: number;
    amountPaise: number;
  }[];
  totalAmountPaise: number;
};

async function joinOrders(
  supabase: SupabaseServerClient,
  orders: OrderRow[],
): Promise<OrderWithDetails[]> {
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter((id): id is string => !!id))];
  const workerIds = [...new Set(orders.map((o) => o.worker_id))];

  const [itemsRes, customersRes, profilesRes, productsRes] = await Promise.all([
    supabase.from('order_items').select('*').in('order_id', orderIds),
    customerIds.length > 0
      ? supabase.from('customers').select('id, full_name').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('profiles').select('id, full_name').in('id', workerIds),
    supabase.from('products').select('id, name, unit'),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (customersRes.error) throw customersRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (productsRes.error) throw productsRes.error;

  const customerNameById = new Map((customersRes.data ?? []).map((c) => [c.id, c.full_name]));
  const workerNameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
  const productById = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const itemsByOrderId = new Map<string, OrderItemRow[]>();
  for (const item of itemsRes.data ?? []) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrderId.set(item.order_id, list);
  }

  return orders.map((order) => {
    const items = (itemsByOrderId.get(order.id) ?? []).map((item) => {
      const product = productById.get(item.product_id);
      return {
        productId: item.product_id,
        productName: product?.name ?? 'Unknown item',
        unit: product?.unit ?? ('kg' as const),
        quantity: item.quantity,
        pricePaise: item.price_paise,
        amountPaise: item.amount_paise,
      };
    });
    return {
      order,
      customerName: order.customer_id
        ? (customerNameById.get(order.customer_id) ?? 'Unknown customer')
        : (order.walk_in_customer_name ?? 'Walk-in customer'),
      workerName: workerNameById.get(order.worker_id) ?? 'Unknown worker',
      items,
      totalAmountPaise: items.reduce((sum, i) => sum + i.amountPaise, 0),
    };
  });
}

/** Joined client-side (orders + order_items + products + customers + profiles) — same approach as listWorkers. */
export async function listRecentOrders(
  supabase: SupabaseServerClient,
  limit = 50,
): Promise<OrderWithDetails[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (ordersError) throw ordersError;
  return joinOrders(supabase, orders ?? []);
}

export async function getOrder(
  supabase: SupabaseServerClient,
  orderId: string,
): Promise<OrderWithDetails | null> {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const [withDetails] = await joinOrders(supabase, [order]);
  return withDetails ?? null;
}

export async function createOrder(
  supabase: SupabaseServerClient,
  input: {
    customerId: string | null;
    walkInCustomerName: string | null;
    workerId: string;
    orderDate: string;
    notes: string | null;
    items: { productId: string; quantity: number }[];
  },
): Promise<OrderRow> {
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_id: input.customerId,
    p_worker_id: input.workerId,
    p_order_date: input.orderDate,
    p_notes: input.notes,
    p_items: input.items,
    p_walk_in_customer_name: input.walkInCustomerName,
  });
  if (error) throw error;
  return data;
}

export async function updateOrderItems(
  supabase: SupabaseServerClient,
  orderId: string,
  items: { productId: string; quantity: number }[],
): Promise<OrderRow> {
  const { data, error } = await supabase.rpc('update_order_items', {
    p_order_id: orderId,
    p_items: items,
  });
  if (error) throw error;
  return data;
}

export async function cancelOrder(supabase: SupabaseServerClient, orderId: string): Promise<void> {
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (error) throw error;
}

export async function changeOrderWorker(
  supabase: SupabaseServerClient,
  orderId: string,
  workerId: string,
): Promise<void> {
  const { error } = await supabase.from('orders').update({ worker_id: workerId }).eq('id', orderId);
  if (error) throw error;
}

export async function rescheduleOrder(
  supabase: SupabaseServerClient,
  orderId: string,
  orderDate: string,
): Promise<void> {
  const { error } = await supabase.from('orders').update({ order_date: orderDate }).eq('id', orderId);
  if (error) throw error;
}

export async function markOrderPaid(
  supabase: SupabaseServerClient,
  orderId: string,
  method: PaymentMethod,
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', payment_method: method, paid_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

export async function setOrderPaymentMethod(
  supabase: SupabaseServerClient,
  orderId: string,
  method: PaymentMethod,
): Promise<void> {
  const { error } = await supabase.from('orders').update({ payment_method: method }).eq('id', orderId);
  if (error) throw error;
}
