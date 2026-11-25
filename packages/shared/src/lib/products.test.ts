import { customerProducts, dayProducts, dayStatus } from './products';

const customer = {
  milk_type_id: 'cow',
  default_daily_quantity_ml: 1000,
  extra_products: [{ milk_type_id: 'curd', quantity_ml: 500 }],
};
const delivery = (milk_type_id: string) => ({ milk_type_id, scheduled_quantity_ml: 1 });

describe('customerProducts', () => {
  it('lists the first product, then the extras', () => {
    expect(customerProducts(customer)).toEqual([
      { milkTypeId: 'cow', quantity: 1000 },
      { milkTypeId: 'curd', quantity: 500 },
    ]);
  });

  it('works on a row cached before extra products existed', () => {
    const { extra_products, ...old } = customer;
    expect(extra_products).toHaveLength(1);
    expect(customerProducts(old)).toEqual([{ milkTypeId: 'cow', quantity: 1000 }]);
  });
});

describe('dayProducts', () => {
  it('pairs each product with its own delivery', () => {
    const curd = delivery('curd');
    expect(dayProducts(customer, [curd]).map((p) => p.delivery)).toEqual([null, curd]);
  });

  it('keeps a delivery of a removed product, in place of one unrecorded product', () => {
    const rows = dayProducts(customer, [delivery('buffalo')]);
    expect(rows.map((p) => p.milkTypeId)).toEqual(['buffalo', 'curd']);
  });

  it('never drops a recorded product for a removed one', () => {
    const rows = dayProducts(customer, ['buffalo', 'cow', 'curd'].map(delivery));
    expect(rows.every((p) => p.delivery !== null)).toBe(true);
    expect(rows).toHaveLength(3);
  });
});

describe('dayStatus', () => {
  it.each([
    [[], null],
    [['completed', 'completed'], 'completed'],
    [['completed', 'missed'], 'partial'],
    [['missed', 'skipped'], 'missed'],
    [['skipped', 'skipped'], 'skipped'],
  ] as const)('%j → %s', (statuses, expected) => {
    expect(dayStatus([...statuses])).toBe(expected);
  });
});
