import type { DeliveryStatus, ExtraProduct } from '../types/database';

/** `extra_products` is missing on rows a phone cached before multiple products. */
type CustomerProductFields = {
  milk_type_id: string;
  default_daily_quantity_ml: number;
  extra_products?: ExtraProduct[];
};

export type CustomerProduct = { milkTypeId: string; quantity: number };

/** Everything the customer takes daily, first product first. */
export function customerProducts(customer: CustomerProductFields): CustomerProduct[] {
  return [
    { milkTypeId: customer.milk_type_id, quantity: customer.default_daily_quantity_ml },
    ...(customer.extra_products ?? []).map((p) => ({
      milkTypeId: p.milk_type_id,
      quantity: p.quantity_ml,
    })),
  ];
}

/**
 * One customer's products for one day, each with its delivery or null. A
 * delivery of a product since taken off the customer stands in for one
 * unrecorded product, so swapping a product mid-day never asks for both.
 */
export function dayProducts<D extends { milk_type_id: string; scheduled_quantity_ml: number }>(
  customer: CustomerProductFields,
  deliveries: D[],
): (CustomerProduct & { delivery: D | null })[] {
  const products = customerProducts(customer);
  const removed = deliveries.filter(
    (d) => !products.some((p) => p.milkTypeId === d.milk_type_id),
  );
  let toReplace = removed.length;
  return [
    ...removed.map((delivery) => ({
      milkTypeId: delivery.milk_type_id,
      quantity: delivery.scheduled_quantity_ml,
      delivery,
    })),
    ...products
      .map((p) => ({
        ...p,
        delivery: deliveries.find((d) => d.milk_type_id === p.milkTypeId) ?? null,
      }))
      .filter((p) => p.delivery !== null || toReplace-- <= 0),
  ];
}

/** One status for a day's deliveries: partial when only some products were delivered. */
export function dayStatus(statuses: DeliveryStatus[]): DeliveryStatus | null {
  if (statuses.length === 0) return null;
  if (statuses.every((s) => s === statuses[0])) return statuses[0];
  return statuses.some((s) => s === 'completed' || s === 'partial') ? 'partial' : 'missed';
}
