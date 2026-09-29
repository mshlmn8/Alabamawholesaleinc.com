// Quote submission against submit_quote v2 and, on a database without it,
// the old 13-argument call (AW-049, AW-079, AW-198, AW-201, AW-014).
import { describe, expect, it, vi } from 'vitest';
import { COMPANY } from '../data/content.js';
import {
  QUOTE_ERROR_GENERIC, QUOTE_UNAVAILABLE, legacyQuoteParams, makeClientRef, quoteErrorField, quoteErrorMessage, quoteParams,
  submitOrder, todayInBirmingham,
} from './orders.js';

const FORM = {
  business: ' Test Market ', contact: 'Test Buyer', email: 'buyer@example.test', phone: '205-000-0000',
  delivery: 'delivery', preferredDate: '', notes: '  ',
  shipStreet: '1 Test Way', shipCity: 'Birmingham', shipState: 'al', shipZip: '35203',
};
const ITEMS = [{ productId: 14, variant: null, qty: 2 }, { productId: 1, variant: 'Red', qty: 1 }];
const SAVED = { id: 'o1', ref_num: 'ALW-Q-0123456789', kind: 'quote', total_units: 3, subtotal: null, priced_lines: 0, unpriced_lines: 2 };

// A supabase client whose rpc answers each call in turn.
function fakeClient(...answers) {
  const calls = [];
  return {
    calls,
    rpc: vi.fn(async (name, args) => {
      calls.push({ name, args });
      return answers.shift();
    }),
  };
}

describe('quoteParams', () => {
  it('sends the details trimmed, the state upper-case and no reference', () => {
    const params = quoteParams(FORM, ITEMS);
    expect(params).toMatchObject({
      p_business: 'Test Market', p_notes: null, p_preferred_date: null, p_ship_state: 'AL', p_delivery: 'delivery',
      p_license_no: null, p_resale_cert_no: null, p_license_attested: false,
    });
    expect(params).not.toHaveProperty('p_ref_num');
    expect(params.p_items).toEqual([{ product_id: 14, variant: null, qty: 2 }, { product_id: 1, variant: 'Red', qty: 1 }]);
  });

  it('sends no address for will-call, whatever the hidden fields hold (AW-079)', () => {
    const params = quoteParams({ ...FORM, delivery: 'willcall' }, ITEMS);
    expect([params.p_ship_street, params.p_ship_city, params.p_ship_state, params.p_ship_zip]).toEqual([null, null, null, null]);
  });

  it('sends the license details when the form asked for them (AW-014)', () => {
    expect(quoteParams(FORM, ITEMS, { licenseNo: ' TL-TEST-1 ', resaleCertNo: '', attested: true })).toMatchObject({
      p_license_no: 'TL-TEST-1', p_resale_cert_no: null, p_license_attested: true,
    });
  });
});

describe('makeClientRef', () => {
  it('is ALW-Q- and 10 hex digits from crypto.getRandomValues', () => {
    expect(makeClientRef()).toMatch(/^ALW-Q-[0-9A-F]{10}$/);
    expect(makeClientRef((bytes) => bytes.fill(0xab))).toBe('ALW-Q-ABABABABAB');
    expect(makeClientRef()).not.toBe(makeClientRef());
  });
});

describe('legacyQuoteParams', () => {
  it('adds the reference and drops the license details', () => {
    const legacy = legacyQuoteParams(quoteParams(FORM, ITEMS, { licenseNo: 'TL-TEST-1', attested: true }), 'ALW-Q-TEST000001');
    expect(legacy.p_ref_num).toBe('ALW-Q-TEST000001');
    expect(Object.keys(legacy).sort()).toEqual([
      'p_business', 'p_contact', 'p_delivery', 'p_email', 'p_items', 'p_notes', 'p_phone', 'p_preferred_date', 'p_ref_num',
      'p_ship_city', 'p_ship_state', 'p_ship_street', 'p_ship_zip',
    ]);
    expect(legacy.p_ship_street).toBe('1 Test Way');
  });

  it('sends the warehouse address for will-call, which the old function requires', () => {
    const legacy = legacyQuoteParams(quoteParams({ ...FORM, delivery: 'willcall' }, ITEMS), 'ALW-Q-TEST000002');
    expect([legacy.p_ship_street, legacy.p_ship_city, legacy.p_ship_state, legacy.p_ship_zip])
      .toEqual([COMPANY.addressStreet, COMPANY.addressCity, COMPANY.addressState, COMPANY.addressZip]);
    // The same facts as the one-line address.
    expect(COMPANY.addressShort).toBe(`${COMPANY.addressStreet}, ${COMPANY.addressCity} ${COMPANY.addressState} ${COMPANY.addressZip}`);
  });
});

describe('submitOrder', () => {
  it('calls submit_quote v2 once and returns what it saved', async () => {
    const client = fakeClient({ data: SAVED, error: null });
    const r = await submitOrder({ formData: FORM, items: ITEMS }, { client });
    expect(r).toEqual({ source: 'supabase', ok: true, order: SAVED, legacy: false });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].name).toBe('submit_quote');
    expect(client.calls[0].args).not.toHaveProperty('p_ref_num');
  });

  it.each(['PGRST202', '42883'])('on a database without v2 (%s), sends it once more the old way', async (code) => {
    const legacySaved = { id: 'o2', ref_num: 'ALW-Q-FROMCLIENT', total_units: 3, subtotal: null };
    const client = fakeClient({ data: null, error: { code, message: 'Could not find the function' } }, { data: legacySaved, error: null });
    const r = await submitOrder({ formData: { ...FORM, delivery: 'willcall' }, items: ITEMS, license: { licenseNo: 'TL-TEST-1' } }, { client });
    expect(r).toMatchObject({ ok: true, order: legacySaved, legacy: true });
    expect(client.calls).toHaveLength(2);
    const { args } = client.calls[1];
    expect(args.p_ref_num).toMatch(/^ALW-Q-[0-9A-F]{10}$/);
    expect(args).not.toHaveProperty('p_license_no');
    expect(args.p_ship_street).toBe(COMPANY.addressStreet);
  });

  it('throws what the server refused, without trying the old way', async () => {
    const refused = { code: 'P0001', message: 'Enter a valid ZIP code', hint: 'invalid_zip' };
    const client = fakeClient({ data: null, error: refused });
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client })).rejects.toBe(refused);
    expect(client.calls).toHaveLength(1);
  });

  it('throws when the old way fails too, and when nothing was saved', async () => {
    const failed = { code: 'P0001', message: 'This quote was already submitted' };
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client: fakeClient({ error: { code: 'PGRST202' } }, { error: failed }) }))
      .rejects.toBe(failed);
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client: fakeClient({ data: null, error: null }) }))
      .rejects.toThrow('The quote was not saved.');
  });

  it('says quote requests can’t be saved without a backend', async () => {
    const err = await submitOrder({ formData: FORM, items: ITEMS }, { client: null }).catch((e) => e);
    expect(err.code).toBe('unavailable');
    expect(quoteErrorMessage(err)).toBe(QUOTE_UNAVAILABLE);
  });
});

describe('quoteErrorMessage', () => {
  it.each([
    ['account_suspended', /^Ordering is paused on this account\. Call/],
    ['rate_limited', /^Too many quote requests in a short time/],
    ['field_too_long', /too long/],
    ['invalid_email', /valid email/],
    ['invalid_zip', /ZIP code/],
    ['invalid_state', /2-letter state code/],
    ['delivery_state', /^Delivery routes cover AL, MS and GA\. For another state, choose will-call pickup\.$/],
    ['past_date', /from today on/],
    ['address_required', /or choose will-call pickup/],
    ['license_required', /license and resale certificate/],
    ['contact_required', /business, contact, email and phone/],
  ])('words the %s hint', (hint, text) => {
    const message = quoteErrorMessage({ code: 'P0001', message: 'server text', hint });
    expect(typeof message === 'string' ? message : message.before).toMatch(text);
  });

  it('falls back to "call the trade desk", with no reference number', () => {
    for (const err of [new Error('TypeError: Failed to fetch'), { code: 'P0001', hint: 'something_new' }, null]) {
      const message = quoteErrorMessage(err);
      expect(message).toBe(QUOTE_ERROR_GENERIC);
      expect(`${message.before}${message.after}`).not.toMatch(/ALW-|reference/);
    }
  });

  it('names the field a hint is about', () => {
    expect(quoteErrorField({ hint: 'invalid_zip' })).toBe('shipZip');
    expect(quoteErrorField({ hint: 'delivery_state' })).toBe('shipState');
    expect(quoteErrorField({ hint: 'rate_limited' })).toBeNull();
    expect(quoteErrorField(new Error('x'))).toBeNull();
  });
});

describe('todayInBirmingham', () => {
  it('is the date in Birmingham, not UTC', () => {
    // 03:00 UTC on 1 Oct is still 30 Sep in Birmingham (UTC-5 in October).
    expect(todayInBirmingham(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09-30');
    expect(todayInBirmingham(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10-01');
  });
});
