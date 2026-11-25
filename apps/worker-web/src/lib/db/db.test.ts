import 'fake-indexeddb/auto';
import Dexie from 'dexie';

import { db } from './db';

it('upgrading a phone from one product per day keeps its records and unsent events', async () => {
  const old = new Dexie('shreeram_daily_milk');
  old.version(1).stores({
    cached_customers: 'id',
    cached_milk_types: 'id',
    local_deliveries: 'delivery_id, &[customer_id+delivery_date], delivery_date',
    sync_outbox: 'event_id, delivery_id, status, created_at',
    sync_meta: 'key',
  });
  const delivery = { customer_id: 'c1', delivery_date: '2026-11-24' };
  await old.table('local_deliveries').add({ ...delivery, delivery_id: 'd1', milk_type_id: 'milk' });
  await old.table('sync_outbox').add({ event_id: 'e1', delivery_id: 'd1', status: 'pending' });
  old.close();

  expect(await db.local_deliveries.get('d1')).toMatchObject({ milk_type_id: 'milk' });
  expect(await db.sync_outbox.count()).toBe(1);
  const add = (delivery_id: string, milk_type_id: string) =>
    db.table('local_deliveries').add({ ...delivery, delivery_id, milk_type_id });
  await add('d2', 'curd');
  await expect(add('d3', 'curd')).rejects.toThrow();
});
