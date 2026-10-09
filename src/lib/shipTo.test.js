// The ship-to address a buyer last used (AW-102), read from their newest
// delivery order with a fake client (no network). Addresses are test values.
import { describe, expect, it } from 'vitest';
import { createFakeSupabase } from '../pages/admin/fakeSupabase.js';
import { SHIP_TO_COLUMNS, loadLastShipTo, shipToFromOrder } from './shipTo.js';

const ORDER = { ship_street: '4100 Test Rd', ship_city: 'Hoover', ship_state: 'AL', ship_zip: '35244' };
const SHIP_TO = { shipStreet: '4100 Test Rd', shipCity: 'Hoover', shipState: 'AL', shipZip: '35244' };

describe('loadLastShipTo', () => {
  it('asks for the newest of the account’s own delivery orders with an address, and only its ship_* columns', async () => {
    const fake = createFakeSupabase();
    fake.reset();
    fake.respond = () => ({ data: [ORDER], error: null });
    const controller = new AbortController();
    expect(await loadLastShipTo(fake.client, 'u1', { signal: controller.signal })).toEqual(SHIP_TO);
    const [call] = fake.calls;
    expect(call).toMatchObject({ table: 'orders', op: 'select', columns: SHIP_TO_COLUMNS });
    expect(SHIP_TO_COLUMNS.split(',').every((c) => c.startsWith('ship_'))).toBe(true);
    expect(call.filters).toEqual([['eq', 'user_id', 'u1'], ['eq', 'delivery', 'delivery'], ['not', 'ship_street', 'is', null]]);
    expect(call.modifiers).toEqual([['order', 'created_at', { ascending: false }], ['limit', 1], ['abortSignal', controller.signal]]);
  });

  it('is null, silently, without a client, an account, an order, or when the request fails', async () => {
    const fake = createFakeSupabase();
    fake.reset();
    expect(await loadLastShipTo(null, 'u1')).toBeNull();
    expect(await loadLastShipTo(fake.client, null)).toBeNull();
    expect(fake.calls).toHaveLength(0);
    fake.respond = () => ({ data: [], error: null });
    expect(await loadLastShipTo(fake.client, 'u1')).toBeNull();
    fake.respond = () => ({ data: null, error: { code: '42501', message: 'permission denied for table orders' } });
    expect(await loadLastShipTo(fake.client, 'u1')).toBeNull();
    fake.respond = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await loadLastShipTo(fake.client, 'u1')).toBeNull();
    const throwing = { from() { throw new Error('boom'); } };
    expect(await loadLastShipTo(throwing, 'u1')).toBeNull();
  });
});

describe('shipToFromOrder', () => {
  it('takes a whole address in the form’s shapes, trimmed, with the state in capitals', () => {
    expect(shipToFromOrder({ ...ORDER, ship_street: ' 4100 Test Rd ', ship_state: 'al' })).toEqual(SHIP_TO);
    expect(shipToFromOrder({ ...ORDER, ship_zip: '35244-1234' })).toEqual({ ...SHIP_TO, shipZip: '35244-1234' });
  });

  it('refuses a part of one, or one the form would refuse', () => {
    expect(shipToFromOrder({ ...ORDER, ship_city: null })).toBeNull();
    expect(shipToFromOrder({ ...ORDER, ship_street: '  ' })).toBeNull();
    expect(shipToFromOrder({ ...ORDER, ship_state: 'Alabama' })).toBeNull();
    expect(shipToFromOrder({ ...ORDER, ship_zip: '3524' })).toBeNull();
    expect(shipToFromOrder(null)).toBeNull();
  });
});
