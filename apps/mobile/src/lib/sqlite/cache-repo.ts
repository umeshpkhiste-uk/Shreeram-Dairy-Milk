import { getDb } from './db';

export type CachedCustomer = {
  id: string;
  full_name: string;
  mobile_number: string;
  address: string;
  locality: string | null;
  milk_type_id: string;
  default_daily_quantity_ml: number;
  route_sequence: number | null;
  preferred_delivery_window: string | null;
};

export type CachedMilkType = { id: string; name: string };

/** Replaces the cached customer/route list with a fresh pull from the server. */
export function replaceCachedCustomers(customers: CachedCustomer[]) {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync('delete from cached_customers');
    for (const c of customers) {
      db.runSync(
        `insert into cached_customers
          (id, full_name, mobile_number, address, locality, milk_type_id,
           default_daily_quantity_ml, route_sequence, preferred_delivery_window)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.full_name,
          c.mobile_number,
          c.address,
          c.locality,
          c.milk_type_id,
          c.default_daily_quantity_ml,
          c.route_sequence,
          c.preferred_delivery_window,
        ],
      );
    }
  });
}

export function replaceCachedMilkTypes(milkTypes: CachedMilkType[]) {
  const db = getDb();
  db.withTransactionSync(() => {
    db.execSync('delete from cached_milk_types');
    for (const m of milkTypes) {
      db.runSync('insert into cached_milk_types (id, name) values (?, ?)', [m.id, m.name]);
    }
  });
}

export function listCachedCustomers(): CachedCustomer[] {
  return getDb().getAllSync<CachedCustomer>(
    'select * from cached_customers order by route_sequence is null, route_sequence, full_name',
  );
}

export function getCachedCustomer(id: string): CachedCustomer | null {
  return (
    getDb().getFirstSync<CachedCustomer>('select * from cached_customers where id = ?', [id]) ??
    null
  );
}

export function getCachedMilkTypeName(milkTypeId: string): string | null {
  const row = getDb().getFirstSync<{ name: string }>(
    'select name from cached_milk_types where id = ?',
    [milkTypeId],
  );
  return row?.name ?? null;
}
