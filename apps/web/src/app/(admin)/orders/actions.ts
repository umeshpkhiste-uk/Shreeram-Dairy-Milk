'use server';

import { parseQuantityToBaseUnit, type PaymentMethod } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import QRCode from 'qrcode';

import { getBusinessSettings } from '@/lib/data/business-settings';
import { listActiveProducts } from '@/lib/data/products';
import {
  cancelOrder,
  changeOrderWorker,
  createOrder,
  getOrder,
  markOrderPaid,
  rescheduleOrder,
  setOrderPaymentMethod,
  updateOrderItems,
} from '@/lib/data/orders';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error: string | null };

function parseItemsFromFormData(
  formData: FormData,
  products: { id: string; name: string }[],
): { productId: string; quantity: number }[] | { error: string } {
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
  return items;
}

export async function createOrderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const customerId = String(formData.get('customerId') ?? '').trim();
  const walkInCustomerName = String(formData.get('walkInCustomerName') ?? '').trim();
  const workerId = String(formData.get('workerId') ?? '');
  const orderDate = String(formData.get('orderDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (!customerId && !walkInCustomerName) {
    return { error: 'Select a customer, or type a name for a walk-in order.' };
  }
  if (customerId && walkInCustomerName) {
    return { error: 'Select a customer OR type a walk-in name, not both.' };
  }
  if (!workerId) return { error: 'Select a worker to deliver this order.' };
  if (!orderDate) return { error: 'Select a date.' };

  const supabase = await createClient();
  const products = await listActiveProducts(supabase);
  const items = parseItemsFromFormData(formData, products);
  if ('error' in items) return items;

  try {
    await createOrder(supabase, {
      customerId: customerId || null,
      walkInCustomerName: walkInCustomerName || null,
      workerId,
      orderDate,
      notes: notes || null,
      items,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to place the order.' };
  }

  revalidatePath('/orders');
  redirect('/orders');
}

export async function updateOrderItemsAction(
  orderId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const products = await listActiveProducts(supabase);
  const items = parseItemsFromFormData(formData, products);
  if ('error' in items) return items;

  try {
    await updateOrderItems(supabase, orderId, items);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update the order.' };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function cancelOrderAction(orderId: string) {
  const supabase = await createClient();
  await cancelOrder(supabase, orderId);
  revalidatePath('/orders');
}

export async function changeWorkerAction(
  orderId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const workerId = String(formData.get('workerId') ?? '');
  if (!workerId) return { error: 'Select a worker.' };
  const supabase = await createClient();
  try {
    await changeOrderWorker(supabase, orderId, workerId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to change the worker.' };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function rescheduleOrderAction(
  orderId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orderDate = String(formData.get('orderDate') ?? '');
  if (!orderDate) return { error: 'Select a date.' };
  const supabase = await createClient();
  try {
    await rescheduleOrder(supabase, orderId, orderDate);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reschedule the order.' };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function setOrderPaymentMethodAction(orderId: string, method: PaymentMethod) {
  const supabase = await createClient();
  await setOrderPaymentMethod(supabase, orderId, method);
  revalidatePath('/orders');
}

export async function markOrderPaidAction(orderId: string, method: PaymentMethod) {
  const supabase = await createClient();
  await markOrderPaid(supabase, orderId, method);
  revalidatePath('/orders');
}

/**
 * Generates a UPI-deep-link QR code (`upi://pay?...`) for this order's total
 * server-side — no payment gateway, admin confirms payment manually (Mark as
 * paid). Returns a data: URL so the client just renders an <img>.
 */
export async function generateOrderPaymentQrAction(
  orderId: string,
): Promise<{ dataUrl: string } | { error: string }> {
  const supabase = await createClient();
  const [order, business] = await Promise.all([getOrder(supabase, orderId), getBusinessSettings(supabase)]);
  if (!order) return { error: 'Order not found.' };
  if (!business.upi_id) return { error: 'No UPI ID configured — add one in Settings first.' };

  const amountRupees = (order.totalAmountPaise / 100).toFixed(2);
  const upiUri =
    `upi://pay?pa=${encodeURIComponent(business.upi_id)}` +
    `&pn=${encodeURIComponent(business.business_name)}` +
    `&am=${encodeURIComponent(amountRupees)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Order ${orderId.slice(0, 8)}`)}`;

  try {
    const dataUrl = await QRCode.toDataURL(upiUri, { margin: 1, width: 240 });
    return { dataUrl };
  } catch {
    return { error: 'Failed to generate the QR code.' };
  }
}
