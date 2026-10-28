import { formatPaiseAsRupees } from '@shreeram/shared';

import { Card, EmptyState, PageHeader } from '@/components/ui';
import { listCustomers } from '@/lib/data/customers';
import { listRecentOrders } from '@/lib/data/orders';
import { listActiveProducts } from '@/lib/data/products';
import { listWorkers } from '@/lib/data/workers';
import { createClient } from '@/lib/supabase/server';

import { OrderActions } from './order-actions';
import { OrderForm } from './order-form';

export default async function OrdersPage() {
  const supabase = await createClient();
  const [customers, workers, products, orders] = await Promise.all([
    listCustomers(supabase, { status: 'active' }),
    listWorkers(supabase),
    listActiveProducts(supabase),
    listRecentOrders(supabase),
  ]);

  const activeWorkers = workers.filter((w) => w.isActive);
  const workerOptions = activeWorkers.map((w) => ({ id: w.id, label: w.fullName }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Order"
        description="One-time orders for items outside the daily milk subscription — paneer, ghee, dahi, and the rest of the price list. These aren't added to the customer's monthly bill; the assigned worker sees them as a delivery reminder."
      />

      <Card>
        {customers.length === 0 ? (
          <EmptyState
            title="No active customers"
            description="Add a customer before placing an order, or use the walk-in name field."
          />
        ) : activeWorkers.length === 0 ? (
          <EmptyState title="No active workers" description="Activate a worker before placing an order." />
        ) : products.length === 0 ? (
          <EmptyState title="No products available" description="No active items in the catalog." />
        ) : (
          <OrderForm
            customers={customers.map((c) => ({ id: c.id, label: c.full_name }))}
            workers={workerOptions}
            products={products}
          />
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-text">Recent orders</h2>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" description="Orders you place above appear here." />
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map(({ order, customerName, workerName, items, totalAmountPaise }) => {
              const quantitiesByProduct = Object.fromEntries(items.map((i) => [i.productId, i.quantity]));
              return (
                <li key={order.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-text">
                        {customerName} <span className="text-text-secondary">· {order.order_date}</span>
                        {order.status === 'cancelled' ? (
                          <span className="ml-2 text-xs font-normal text-danger">(Cancelled)</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-text-secondary">Worker: {workerName}</p>
                    </div>
                  </div>
                  <ul className="mt-2 text-sm text-text-secondary">
                    {items.map((item, idx) => (
                      <li key={idx}>
                        {item.productName} ·{' '}
                        {item.unit === 'litre' ? `${(item.quantity / 1000).toFixed(2)} L` : `${(item.quantity / 1000).toFixed(2)} Kg`}
                        {' · '}
                        {formatPaiseAsRupees(item.amountPaise)}
                      </li>
                    ))}
                  </ul>
                  {order.notes ? (
                    <p className="mt-1 text-sm text-text-secondary">Note: {order.notes}</p>
                  ) : null}
                  <p className="mt-1 text-sm font-medium text-text">
                    Total: {formatPaiseAsRupees(totalAmountPaise)}
                  </p>

                  {order.status === 'active' ? (
                    <OrderActions
                      orderId={order.id}
                      paymentStatus={order.payment_status}
                      paymentMethod={order.payment_method}
                      products={products}
                      workers={workerOptions}
                      currentQuantitiesBaseUnit={quantitiesByProduct}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
