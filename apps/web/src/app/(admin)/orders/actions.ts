'use server';

import { errorMessage, parseQuantityToBaseUnit, upiPayUrl, type PaymentMethod } from '@shreeram/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import QRCode from 'qrcode';

import { getBusinessSettings } from '@/lib/data/business-settings';
import { listCustomers } from '@/lib/data/customers';
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
  const customerName = String(formData.get('customerName') ?? '').trim();
  const workerId = String(formData.get('workerId') ?? '');
  const orderDate = String(formData.get('orderDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (!customerName) return { error: 'Enter a customer name.' };
  if (!workerId) return { error: 'Select a worker to deliver this order.' };
  if (!orderDate) return { error: 'Select a date.' };

  const supabase = await createClient();
  const [products, activeCustomers] = await Promise.all([
    listActiveProducts(supabase),
    listCustomers(supabase, { status: 'active' }),
  ]);
  const items = parseItemsFromFormData(formData, products);
  if ('error' in items) return items;

  // Typing a name that matches an existing active customer links the order
  // to that customer record; anything else is placed as a walk-in order —
  // same single field covers both, per the owner's request to merge them.
  const matchedCustomer = activeCustomers.find(
    (c) => c.full_name.trim().toLowerCase() === customerName.toLowerCase(),
  );
  const customerId = matchedCustomer?.id ?? null;
  const walkInCustomerName = matchedCustomer ? null : customerName;

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
    return { error: errorMessage(err, 'Failed to place the order.') };
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
  const [active, order] = await Promise.all([
    listActiveProducts(supabase),
    getOrder(supabase, orderId),
  ]);
  // What is already on the order stays editable after the item was turned off.
  const products = new Map<string, { id: string; name: string }>(
    (order?.items ?? []).map((i) => [i.productId, { id: i.productId, name: i.productName }]),
  );
  for (const product of active) products.set(product.id, product);
  const items = parseItemsFromFormData(formData, [...products.values()]);
  if ('error' in items) return items;

  try {
    await updateOrderItems(supabase, orderId, items);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to update the order.') };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function cancelOrderAction(orderId: string): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await cancelOrder(supabase, orderId);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to cancel the order.') };
  }
  revalidatePath('/orders');
  return { error: null };
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
    return { error: errorMessage(err, 'Failed to change the worker.') };
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
    return { error: errorMessage(err, 'Failed to reschedule the order.') };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function setOrderPaymentMethodAction(
  orderId: string,
  method: PaymentMethod,
): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await setOrderPaymentMethod(supabase, orderId, method);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to save the payment method.') };
  }
  revalidatePath('/orders');
  return { error: null };
}

export async function markOrderPaidAction(
  orderId: string,
  method: PaymentMethod,
): Promise<ActionState> {
  const supabase = await createClient();
  try {
    await markOrderPaid(supabase, orderId, method);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to mark the order as paid.') };
  }
  revalidatePath('/orders');
  return { error: null };
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
  let order, business;
  try {
    [order, business] = await Promise.all([getOrder(supabase, orderId), getBusinessSettings(supabase)]);
  } catch (err) {
    return { error: errorMessage(err, 'Failed to generate the QR code.') };
  }
  if (!order) return { error: 'Order not found.' };
  if (!business.upi_id) return { error: 'No UPI ID configured — add one in Settings first.' };

  const upiUri = upiPayUrl({
    upiId: business.upi_id,
    name: business.business_name,
    amountPaise: order.totalAmountPaise,
    note: `Order ${orderId.slice(0, 8)}`,
  });

  try {
    const dataUrl = await QRCode.toDataURL(upiUri, { margin: 1, width: 240 });
    return { dataUrl };
  } catch {
    return { error: 'Failed to generate the QR code.' };
  }
}
