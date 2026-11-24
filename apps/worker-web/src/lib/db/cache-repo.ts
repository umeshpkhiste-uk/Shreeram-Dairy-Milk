import { db, type CachedCustomer, type CachedMilkType } from './db';

/** Replaces the cached customer/route list with a fresh pull from the server. */
export async function replaceCachedCustomers(customers: CachedCustomer[]) {
  await db.transaction('rw', db.cached_customers, async () => {
    await db.cached_customers.clear();
    await db.cached_customers.bulkPut(customers);
  });
}

export async function replaceCachedMilkTypes(milkTypes: CachedMilkType[]) {
  await db.transaction('rw', db.cached_milk_types, async () => {
    await db.cached_milk_types.clear();
    await db.cached_milk_types.bulkPut(milkTypes);
  });
}

/** Route order: sequenced customers first, then by name. */
export async function listCachedCustomers(): Promise<CachedCustomer[]> {
  const customers = await db.cached_customers.toArray();
  return customers.sort(
    (a, b) =>
      (a.route_sequence ?? Infinity) - (b.route_sequence ?? Infinity) ||
      a.full_name.localeCompare(b.full_name),
  );
}

export async function getCachedCustomer(id: string): Promise<CachedCustomer | null> {
  return (await db.cached_customers.get(id)) ?? null;
}

/** Milk type id → name. */
export async function getCachedMilkTypeNames(): Promise<Record<string, string>> {
  const rows = await db.cached_milk_types.toArray();
  return Object.fromEntries(rows.map((m) => [m.id, m.name]));
}
