// The account search and the account page's pure parts (AW-113).
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_ORDER_COLUMNS, accountHref, accountOrdersHref, businessTypes, contactChanges, contactDraft, loadAccountOrders, matchesAccountSearch,
  ordersSummary, validateContact,
} from './accountDetail.js';

const ALPHA = {
  id: '11111111-2222-4333-8444-000000000aaa', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'Alice@Example.test', phone: '(205) 555-0101',
  state: 'AL', store_street: '1 Alpha Way', store_city: 'Birmingham', store_zip: '35203', business_type: 'Convenience Store',
};

describe('matchesAccountSearch', () => {
  it('finds the business, name, email and phone, ignoring case', () => {
    for (const text of ['alpha food', 'ALICE', 'alice@example', '555-0101', '  Food   Mart ']) expect(matchesAccountSearch(ALPHA, text), text).toBe(true);
    expect(matchesAccountSearch(ALPHA, 'bravo')).toBe(false);
    expect(matchesAccountSearch(ALPHA, '')).toBe(true);
  });

  it('finds a phone typed with other punctuation, but not digits inside words', () => {
    expect(matchesAccountSearch(ALPHA, '2055550101')).toBe(true);
    expect(matchesAccountSearch(ALPHA, '205.555')).toBe(true);
    expect(matchesAccountSearch(ALPHA, '999')).toBe(false);
    expect(matchesAccountSearch({ ...ALPHA, phone: null }, '2055550101')).toBe(false);
    expect(matchesAccountSearch(ALPHA, 'way 205')).toBe(false);
  });
});

describe('the contact and store form', () => {
  it('starts from the profile and sends only what changed, trimmed, with the state upper-cased', () => {
    const draft = contactDraft({ ...ALPHA, store_zip: null });
    expect(draft.store_zip).toBe('');
    expect(contactChanges(draft, { ...ALPHA, store_zip: null })).toEqual({});
    expect(contactChanges({ ...draft, phone: ' 205-555-0199 ', state: 'ms', store_city: '' }, ALPHA))
      .toEqual({ phone: '205-555-0199', state: 'MS', store_city: null, store_zip: null });
  });

  it('checks only the changed fields', () => {
    const draft = contactDraft(ALPHA);
    expect(validateContact({ ...draft, state: 'Alabama' }, ALPHA).errors).toEqual({ state: 'Keep it to 2 characters or fewer.' });
    expect(validateContact({ ...draft, state: 'A1' }, ALPHA).errors).toEqual({ state: 'Use the two-letter state code, such as AL.' });
    expect(validateContact({ ...draft, store_zip: '3520' }, ALPHA).errors).toEqual({ store_zip: 'Enter a 5-digit ZIP code, or ZIP+4.' });
    expect(validateContact({ ...draft, store_zip: '35203-1234' }, ALPHA).ok).toBe(true);
    expect(validateContact({ ...draft, business: '  ' }, ALPHA).errors).toEqual({ business: 'Enter the business name.' });
    expect(validateContact({ ...draft, phone: '555' }, ALPHA).errors).toEqual({ phone: 'Enter a phone number with its area code.' });
    // Cleared optional fields are fine.
    expect(validateContact({ ...draft, store_street: '' }, ALPHA)).toEqual({ ok: true, errors: {}, patch: { store_street: null } });
    // An older row's value that the rules don't accept still saves its other fields.
    const old = { ...ALPHA, state: 'Other', business: null };
    expect(validateContact({ ...contactDraft(old), phone: '205-555-0123' }, old)).toEqual({ ok: true, errors: {}, patch: { phone: '205-555-0123' } });
  });

  it('suggests the business types on file, once each', () => {
    expect(businessTypes([ALPHA, { business_type: 'Gas Station' }, { business_type: 'convenience store' }, { business_type: ' ' }, {}]))
      .toEqual(['Convenience Store', 'Gas Station']);
  });
});

describe('the account’s orders', () => {
  it('totals the priced orders that weren’t cancelled, in cents, and finds the last order', () => {
    const orders = [
      { status: 'new', subtotal: 10.1, created_at: '2026-10-01T15:00:00Z' },
      { status: 'fulfilled', subtotal: 20.2, created_at: '2026-10-08T15:00:00Z' },
      { status: 'cancelled', subtotal: 99, created_at: '2026-10-05T15:00:00Z' },
      { status: 'new', subtotal: null, created_at: '2026-09-01T15:00:00Z' },
      { status: 'quoted', subtotal: '0.7', created_at: 'not a date' },
    ];
    expect(ordersSummary(orders)).toEqual({ count: 5, lastAt: '2026-10-08T15:00:00.000Z', total: 31, priced: 3 });
    expect(ordersSummary([])).toEqual({ count: 0, lastAt: null, total: 0, priced: 0 });
  });

  it('asks again without kind on a database that doesn’t have it', async () => {
    const asked = [];
    const client = {
      from: () => {
        const q = { filters: [] };
        const builder = {
          select(columns) { q.columns = columns; return builder; },
          eq(...args) { q.filters.push(args); return builder; },
          order() { return builder; },
          limit(n) { q.limit = n; return builder; },
          then(resolve) {
            asked.push(q);
            return Promise.resolve(q.columns.includes('kind') ? { data: null, error: { code: '42703', message: 'column orders.kind does not exist' } } : { data: [{ id: 'o1' }], error: null }).then(resolve);
          },
        };
        return builder;
      },
    };
    const result = await loadAccountOrders(client, ALPHA.id);
    expect(result.data).toEqual([{ id: 'o1' }]);
    expect(asked.map((q) => q.columns)).toEqual([ACCOUNT_ORDER_COLUMNS, 'id,ref_num,status,subtotal,total_units,created_at']);
    expect(asked[0]).toMatchObject({ filters: [['user_id', ALPHA.id]], limit: 50 });
  });

  it('links to the account’s page and its orders in Admin -> Orders', () => {
    expect(accountHref(ALPHA.id)).toBe(`/admin/accounts/${ALPHA.id}`);
    expect(accountOrdersHref(ALPHA.id)).toBe(`/admin/orders?status=all&account=${ALPHA.id}`);
  });
});
