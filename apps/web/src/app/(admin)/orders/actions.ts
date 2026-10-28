'use server';

import { parseQuantityToBaseUnit } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { listActiveProducts } from '@/lib/data/products';
import { cancelOrder, createOrder } from '@/lib/data/orders';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null };

export async function createOrderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const customerId = String(formData.get('customerId') ?? '');
  const workerId = String(formData.get('workerId') ?? '');
  const orderDate = String(formData.get('orderDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (!customerId) return { error: 'Select a customer.' };
  if (!workerId) return { error: 'Select a worker to deliver this order.' };
  if (!orderDate) return { error: 'Select a date.' };

  const supabase = await createClient();
  const products = await listActiveProducts(supabase);

  const items: { productId: string; quantity: number }[] = [];
  for (const product of products) {
    const raw = String(formData.get(`quantity_${product.id}`) ?? '').trim();
    if (!raw) continue;
    const quantity = parseQuantityToBaseUnit(raw);
    if (quantity === null) {
      return { error: `Enter a valid quantity for ${product.name} (e.g. 1 or 0.5).` };
    }
    items.push({ productId: product.id, quantity });
  }

  if (items.length === 0) return { error: 'Select a quantity for at least one item.' };

  try {
    await createOrder(supabase, { customerId, workerId, orderDate, notes: notes || null, items });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to place the order.' };
  }

  revalidatePath('/orders');
  redirect('/orders');
}

export async function cancelOrderAction(orderId: string) {
  const supabase = await createClient();
  await cancelOrder(supabase, orderId);
  revalidatePath('/orders');
}
