import Link from 'next/link';

import { Badge, Card, EmptyState, PageHeader, Table } from '@/components/ui';
import { listCustomers, type CustomerFilters } from '@/lib/data/customers';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams: Promise<{ status?: string; search?: string }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const { status, search } = await searchParams;
  const supabase = await createClient();

  const filters: CustomerFilters = {
    status: status === 'inactive' ? 'inactive' : status === 'all' ? 'all' : 'active',
    search,
  };
  const customers = await listCustomers(supabase, filters);

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${customers.length} ${filters.status === 'all' ? '' : filters.status} customer${customers.length === 1 ? '' : 's'}`}
        actions={
          <Link
            href="/customers/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover"
          >
            Add customer
          </Link>
        }
      />

      <Card className="mb-6">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Search
            <input
              name="search"
              defaultValue={search}
              placeholder="Name or mobile number"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-text">
            Status
            <select
              name="status"
              defaultValue={status ?? 'active'}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
          >
            Apply
          </button>
        </form>
      </Card>

      {customers.length === 0 ? (
        <EmptyState title="No customers match these filters" />
      ) : (
        <Table>
          <thead className="bg-surface-muted text-xs font-medium uppercase text-text-secondary">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Daily qty</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-surface-muted">
                <td className="px-4 py-3">
                  <Link href={`/customers/${customer.id}`} className="font-medium text-primary">
                    {customer.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">{customer.mobile_number}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {customer.default_daily_quantity_ml} ml
                </td>
                <td className="px-4 py-3">
                  <Badge
                    label={customer.status === 'active' ? 'Active' : 'Inactive'}
                    tone={customer.status === 'active' ? 'success' : 'neutral'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
