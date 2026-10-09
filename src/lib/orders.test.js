// Quote submission against the current submit_quote and, on an older
// database, PR #12's 16-argument call and the 13-argument one (AW-049,
// AW-079, AW-198, AW-201, AW-014), its time limit (AW-194) and the text for
// every refusal (AW-200). No network: a fake client answers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPANY } from '../data/content.js';
import { QUOTE_SUBMIT_TIMEOUT_MS } from './network.js';
import {
  QUOTE_ERROR_GENERIC, QUOTE_OFFLINE, QUOTE_UNAVAILABLE, isTransportFailure, legacyQuoteParams, licensedQuoteParams, makeClientRef, quoteConnectionMessage,
  quoteErrorField, quoteErrorMessage, quoteParams, quoteTimeoutMessage, resetQuoteSignatureForTests, submitOrder, todayInBirmingham,
} from './orders.js';

const FORM = {
  business: ' Test Market ', contact: 'Test Buyer', email: 'buyer@example.test', phone: '205-000-0000',
  delivery: 'delivery', preferredDate: '', notes: '  ',
  shipStreet: '1 Test Way', shipCity: 'Birmingham', shipState: 'al', shipZip: '35203',
  licenseNo: '', resaleCert: '', purchasers21: false,
};
const LICENSED = { ...FORM, notes: 'Dock B', licenseNo: ' TL-123 ', resaleCert: 'RC-456', purchasers21: true };
const ITEMS = [{ productId: 14, variant: null, qty: 2 }, { productId: 1, variant: 'Red', qty: 1 }];
const SAVED = { id: 'o1', ref_num: 'ALW-Q-0123456789', kind: 'quote', total_units: 3, subtotal: null, priced_lines: 0, unpriced_lines: 2 };
const MISSING = { code: 'PGRST202', message: 'Could not find the function public.submit_quote(p_business, …) in the schema cache' };

// A supabase client whose rpc answers each call in turn, like
// supabase-js's builder: .abortSignal(signal) and then await. An answer
// 'stall' never comes, unless the signal aborts, when it resolves the way
// postgrest-js does for an aborted fetch.
function fakeClient(...answers) {
  const calls = [];
  return {
    calls,
    rpc: vi.fn((name, args) => {
      const call = { name, args, signal: null };
      calls.push(call);
      const answer = answers.shift();
      const respond = () => (answer === 'stall'
        ? new Promise((resolve) => {
          call.signal?.addEventListener('abort', () => resolve({
            data: null, error: { message: `${call.signal.reason.name}: ${call.signal.reason.message}`, code: '', hint: '', details: '' },
          }));
        })
        : Promise.resolve(answer));
      return {
        abortSignal(signal) { call.signal = signal; return respond(); },
        then(resolve, reject) { return respond().then(resolve, reject); },
      };
    }),
  };
}

beforeEach(() => resetQuoteSignatureForTests());
afterEach(() => vi.useRealTimers());

describe('quoteParams', () => {
  it('sends the details trimmed, the state upper-case and no reference', () => {
    const params = quoteParams(FORM, ITEMS);
    expect(params).toMatchObject({
      p_business: 'Test Market', p_notes: null, p_preferred_date: null, p_ship_state: 'AL', p_delivery: 'delivery',
      p_license_no: null, p_resale_cert: null, p_purchasers_21: false,
    });
    expect(params).not.toHaveProperty('p_ref_num');
    expect(params.p_items).toEqual([{ product_id: 14, variant: null, qty: 2 }, { product_id: 1, variant: 'Red', qty: 1 }]);
  });

  it('sends no address for will-call, whatever the hidden fields hold (AW-079)', () => {
    const params = quoteParams({ ...FORM, delivery: 'willcall' }, ITEMS);
    expect([params.p_ship_street, params.p_ship_city, params.p_ship_state, params.p_ship_zip]).toEqual([null, null, null, null]);
  });

  it('sends the license answers trimmed (AW-014)', () => {
    expect(quoteParams(LICENSED, ITEMS)).toMatchObject({ p_license_no: 'TL-123', p_resale_cert: 'RC-456', p_purchasers_21: true });
  });
});

describe('makeClientRef', () => {
  it('is ALW-Q- and 10 hex digits from crypto.getRandomValues', () => {
    expect(makeClientRef()).toMatch(/^ALW-Q-[0-9A-F]{10}$/);
    expect(makeClientRef((bytes) => bytes.fill(0xab))).toBe('ALW-Q-ABABABABAB');
    expect(makeClientRef()).not.toBe(makeClientRef());
  });
});

describe('older signatures', () => {
  it('16 arguments: adds the reference and keeps the license answers', () => {
    const args = licensedQuoteParams(quoteParams(LICENSED, ITEMS), 'ALW-Q-TEST000001');
    expect(args).toMatchObject({ p_ref_num: 'ALW-Q-TEST000001', p_license_no: 'TL-123', p_resale_cert: 'RC-456', p_purchasers_21: true });
    expect(Object.keys(args)).toHaveLength(16);
  });

  it('13 arguments: adds the reference and keeps the license answers in the notes', () => {
    const legacy = legacyQuoteParams(quoteParams(LICENSED, ITEMS), 'ALW-Q-TEST000001');
    expect(legacy.p_ref_num).toBe('ALW-Q-TEST000001');
    expect(Object.keys(legacy).sort()).toEqual([
      'p_business', 'p_contact', 'p_delivery', 'p_email', 'p_items', 'p_notes', 'p_phone', 'p_preferred_date', 'p_ref_num',
      'p_ship_city', 'p_ship_state', 'p_ship_street', 'p_ship_zip',
    ]);
    expect(legacy.p_notes).toBe([
      'Dock B',
      'State tobacco/retail license #: TL-123',
      'Sales-tax / resale certificate #: RC-456',
      'Confirmed: valid tobacco retail license and purchasers are 21+.',
    ].join('\n'));
    // Nothing is added for a quote without answers.
    expect(legacyQuoteParams(quoteParams(FORM, ITEMS), 'ALW-Q-TEST000003').p_notes).toBeNull();
  });

  it('both send the warehouse address for will-call, which they require', () => {
    for (const make of [legacyQuoteParams, licensedQuoteParams]) {
      const args = make(quoteParams({ ...FORM, delivery: 'willcall' }, ITEMS), 'ALW-Q-TEST000002');
      expect([args.p_ship_street, args.p_ship_city, args.p_ship_state, args.p_ship_zip])
        .toEqual([COMPANY.addressStreet, COMPANY.addressCity, COMPANY.addressState, COMPANY.addressZip]);
    }
    // The same facts as the one-line address.
    expect(COMPANY.addressShort).toBe(`${COMPANY.addressStreet}, ${COMPANY.addressCity} ${COMPANY.addressState} ${COMPANY.addressZip}`);
  });
});

describe('submitOrder', () => {
  it('calls the current submit_quote once and returns what it saved', async () => {
    const client = fakeClient({ data: SAVED, error: null });
    const r = await submitOrder({ formData: LICENSED, items: ITEMS }, { client });
    expect(r).toEqual({ ok: true, order: SAVED, legacy: false });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].name).toBe('submit_quote');
    expect(client.calls[0].args).not.toHaveProperty('p_ref_num');
    expect(client.calls[0].args).toMatchObject({ p_license_no: 'TL-123', p_resale_cert: 'RC-456', p_purchasers_21: true });
  });

  it.each(['PGRST202', '42883'])('on a database with only PR #12 (%s), sends the 16-argument call', async (code) => {
    const saved = { id: 'o2', ref_num: 'ALW-Q-FROMCLIENT', total_units: 3, subtotal: null };
    const client = fakeClient({ data: null, error: { code, message: 'Could not find the function' } }, { data: saved, error: null });
    const r = await submitOrder({ formData: { ...LICENSED, delivery: 'willcall' }, items: ITEMS }, { client });
    expect(r).toMatchObject({ ok: true, order: saved, legacy: true });
    expect(client.calls).toHaveLength(2);
    const { args } = client.calls[1];
    expect(args.p_ref_num).toMatch(/^ALW-Q-[0-9A-F]{10}$/);
    expect(args).toMatchObject({ p_license_no: 'TL-123', p_purchasers_21: true, p_ship_street: COMPANY.addressStreet });
  });

  it('on the live database (neither), keeps the answers in the notes, with one reference for both older calls', async () => {
    const saved = { id: 'o3', ref_num: 'ALW-Q-FROMCLIENT', total_units: 3, subtotal: null };
    const client = fakeClient({ data: null, error: MISSING }, { data: null, error: MISSING }, { data: saved, error: null });
    const r = await submitOrder({ formData: LICENSED, items: ITEMS }, { client });
    expect(r).toMatchObject({ ok: true, order: saved, legacy: true });
    expect(client.calls).toHaveLength(3);
    const [, licensed, legacy] = client.calls.map((c) => c.args);
    expect(legacy.p_ref_num).toBe(licensed.p_ref_num);
    expect(legacy).not.toHaveProperty('p_license_no');
    expect(legacy.p_notes).toContain('State tobacco/retail license #: TL-123');
  });

  it('remembers the signature that worked, and starts over when it disappears', async () => {
    const client = fakeClient(
      { data: null, error: MISSING }, { data: null, error: MISSING }, { data: { id: 'o4' }, error: null },
      { data: { id: 'o5' }, error: null },
      { data: null, error: MISSING }, { data: { id: 'o6' }, error: null },
    );
    await submitOrder({ formData: FORM, items: ITEMS }, { client });
    await submitOrder({ formData: FORM, items: ITEMS }, { client });
    expect(client.calls[3].args).toHaveProperty('p_ref_num');
    expect(client.calls[3].args).not.toHaveProperty('p_license_no');
    // The 13-argument function went away (migrations applied): the current one is tried next.
    const r = await submitOrder({ formData: FORM, items: ITEMS }, { client });
    expect(r).toMatchObject({ order: { id: 'o6' }, legacy: false });
    expect(client.calls[5].args).not.toHaveProperty('p_ref_num');
  });

  it('throws what the server refused, without trying an older signature', async () => {
    const refused = { code: 'P0001', message: 'Enter a valid ZIP code', hint: 'invalid_zip' };
    const client = fakeClient({ data: null, error: refused });
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client })).rejects.toBe(refused);
    expect(client.calls).toHaveLength(1);
  });

  it('throws when an older call fails too, when no signature exists, and when nothing was saved', async () => {
    const failed = { code: 'P0001', message: 'This quote was already submitted' };
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client: fakeClient({ error: MISSING }, { error: failed }) }))
      .rejects.toBe(failed);
    await expect(submitOrder({ formData: FORM, items: ITEMS }, { client: fakeClient({ error: MISSING }, { error: MISSING }, { error: MISSING }) }))
      .rejects.toBe(MISSING);
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
    ['license_required', /tobacco license and resale certificate/],
    ['contact_required', /business, contact, email and phone/],
  ])('words the %s hint', (hint, text) => {
    const message = quoteErrorMessage({ code: 'P0001', message: 'server text', hint });
    expect(typeof message === 'string' ? message : message.before).toMatch(text);
  });

  it('words PR #12’s license refusal, which has no hint', () => {
    const refused = { code: 'P0001', message: 'A tobacco license, resale certificate, and 21+ confirmation are required' };
    expect(quoteErrorMessage(refused)).toMatch(/tobacco license and resale certificate/);
    expect(quoteErrorField(refused)).toBe('licenseNo');
  });

  it('falls back to "call the trade desk", with no reference number', () => {
    for (const err of [new Error('boom'), { code: 'XX000', message: 'boom', hint: '' }, { code: 'P0001', hint: 'something_new' }, null]) {
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

describe('submitOrder time limit (AW-194)', () => {
  it('sends every call with an abort signal and clears its timer', async () => {
    vi.useFakeTimers();
    const client = fakeClient({ data: SAVED, error: null });
    await submitOrder({ formData: FORM, items: ITEMS }, { client });
    expect(client.calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(client.calls[0].signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives up after 25 s, never tries an older signature, and says it may have been saved', async () => {
    vi.useFakeTimers();
    const client = fakeClient('stall', { data: SAVED, error: null });
    const caught = submitOrder({ formData: FORM, items: ITEMS }, { client }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(QUOTE_SUBMIT_TIMEOUT_MS);
    const err = await caught;
    expect(err).toMatchObject({ name: 'TimeoutError', code: 'timeout' });
    expect(err.refNum).toBeUndefined();
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].signal.aborted).toBe(true);
    // Past tense: the page has stopped waiting (NEW-061).
    expect(quoteErrorMessage(err)).toEqual({
      before: 'We stopped waiting for an answer, and the request may have been saved. Call',
      after: ' before you submit it again, so it isn’t sent twice.',
    });
  });

  it('on an older signature, gives the reference it was sent with', async () => {
    vi.useFakeTimers();
    const client = fakeClient({ data: null, error: MISSING }, 'stall');
    const caught = submitOrder({ formData: FORM, items: ITEMS }, { client, timeoutMs: 1000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await caught;
    expect(client.calls).toHaveLength(2);
    expect(err.code).toBe('timeout');
    expect(err.refNum).toBe(client.calls[1].args.p_ref_num);
    expect(quoteErrorMessage(err)).toEqual(quoteTimeoutMessage(err.refNum));
    expect(quoteErrorMessage(err).after).toBe(` and give quote reference ${err.refNum} before you submit it again.`);
  });
});

// A connection that failed before the answer came back (NEW-061): the
// request may have reached the server, so it is worded like a timeout.
describe('quoteErrorMessage for a lost connection (NEW-061)', () => {
  it('recognises the browsers’ transport failures as postgrest-js passes them on, and nothing else', () => {
    for (const message of ['TypeError: Failed to fetch', 'TypeError: Load failed', 'TypeError: NetworkError when attempting to fetch resource.', 'Failed to fetch']) {
      expect(isTransportFailure({ message, code: '', hint: '', details: '' })).toBe(true);
    }
    expect(isTransportFailure(new TypeError('Failed to fetch'))).toBe(true);
    // A server's answer has a code; a refusal has a hint.
    expect(isTransportFailure({ message: 'TypeError: Failed to fetch', code: 'XX000' })).toBe(false);
    expect(isTransportFailure({ message: 'Failed to fetch', hint: 'rate_limited' })).toBe(false);
    expect(isTransportFailure({ message: 'boom', code: '' })).toBe(false);
    expect(isTransportFailure(null)).toBe(false);
  });

  it('says it may have been saved, with no reference, instead of “We couldn’t save this quote”', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const message = quoteErrorMessage({ message: 'TypeError: Failed to fetch', code: '', hint: '', details: '' });
    expect(message).toEqual({
      before: 'The connection dropped before an answer came back, and the request may have been saved. Call',
      after: ' before you submit it again, so it isn’t sent twice.',
    });
    expect(message).not.toEqual(QUOTE_ERROR_GENERIC);
    expect(quoteErrorMessage({ message: 'TypeError: Load failed', code: '' }, { items: [] }).before).toMatch(/may have been saved/);
    vi.restoreAllMocks();
  });

  it('never tries an older signature after one, and gives the reference an older one was sent with', async () => {
    const LOST = { message: 'TypeError: Failed to fetch', code: '', hint: '', details: '' };
    const current = fakeClient({ data: null, error: LOST }, { data: SAVED, error: null });
    const err = await submitOrder({ formData: FORM, items: ITEMS }, { client: current }).catch((e) => e);
    expect(current.calls).toHaveLength(1);
    expect(err).toBe(LOST);
    expect(quoteErrorMessage(err)).toEqual(quoteConnectionMessage());

    resetQuoteSignatureForTests();
    const older = fakeClient({ data: null, error: MISSING }, { data: null, error: LOST }, { data: SAVED, error: null });
    const late = await submitOrder({ formData: FORM, items: ITEMS }, { client: older }).catch((e) => e);
    expect(older.calls).toHaveLength(2);
    expect(late.refNum).toBe(older.calls[1].args.p_ref_num);
    expect(quoteErrorMessage(late)).toEqual(quoteConnectionMessage(late.refNum));
    expect(quoteErrorMessage(late).after).toBe(` and give quote reference ${late.refNum} before you submit it again.`);
  });
});

describe('quoteErrorMessage for the remaining refusals (AW-200)', () => {
  const LINES = [
    { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', qty: 2 },
    { lineKey: '1::red', productId: 1, variant: 'Red', name: 'Swisher Sweets cigarillos — Red', qty: 1 },
    { lineKey: '1::blue', productId: 1, variant: 'Blue', name: 'Swisher Sweets cigarillos — Blue', qty: 1 },
    { lineKey: '60::mint', productId: 60, variant: 'Mint', name: 'Geek Bar Pulse 15K — Mint', qty: 3 },
  ];
  const text = (m) => (typeof m === 'string' ? m : `${m.before} (phone) or email (email)${m.after}`);

  it.each([
    ['no_items', 'Add at least one item before you submit.'],
    ['invalid_delivery', 'Choose delivery or will-call pickup.'],
    ['invalid_quantity', 'Quantities must be a whole number from 1 to 100,000.'],
  ])('words the %s hint', (hint, expected) => {
    expect(quoteErrorMessage({ code: 'P0001', message: 'x', hint })).toBe(expected);
  });

  it('words too many lines, a reference that couldn’t be made, and a quote sent already, around the phone and email', () => {
    expect(quoteErrorMessage({ hint: 'too_many_items' })).toEqual({
      before: 'This request has more lines than one request can take. Split it into two, or call', after: '.',
    });
    expect(quoteErrorMessage({ hint: 'ref_unavailable' })).toEqual({
      before: 'We couldn’t assign a reference number, so nothing was sent. Try again in a moment, or call', after: '.',
    });
    expect(quoteErrorMessage({ message: 'This quote was already submitted', code: 'P0001' })).toEqual({
      before: 'This request may already have been sent. Call', after: ' before you submit it again.',
    });
  });

  it('names the product from the id in the details, using the lines that were sent', () => {
    const at = (hint, id, message = 'x') => quoteErrorMessage({ code: 'P0001', message, hint, details: String(id) }, { items: LINES });
    expect(at('product_unavailable', 14, 'Product is not available')).toBe('‘Kite cigarette tobacco’ is no longer available. Remove it, then submit again.');
    expect(at('variant_unavailable', 60, 'That variant is not available')).toBe('‘Geek Bar Pulse 15K — Mint’ can’t be ordered right now. Choose another variant or remove it, then submit again.');
    // Two lines of one product: the product, without a variant.
    expect(at('unknown_variant', 1, 'Unknown variant for Swisher Sweets cigarillos')).toBe('The variant chosen for ‘Swisher Sweets cigarillos’ is no longer offered. Choose another, then submit again.');
    expect(at('variant_required', 14, 'Choose a variant for Kite cigarette tobacco')).toBe('Choose a variant for ‘Kite cigarette tobacco’, then submit again.');
  });

  it('else takes the name from the message, else says “an item”', () => {
    expect(quoteErrorMessage({ hint: 'variant_required', message: 'Choose a variant for Hershey’s bars', details: '999' }, { items: LINES }))
      .toBe('Choose a variant for ‘Hershey’s bars’, then submit again.');
    expect(quoteErrorMessage({ hint: 'product_unavailable', message: 'Product is not available' }))
      .toBe('An item in this request is no longer available, so nothing was sent. Reload the page to see which, remove it, then submit again.');
    expect(quoteErrorMessage({ hint: 'variant_unavailable', message: 'That variant is not available' }))
      .toBe('One of the chosen variants can’t be ordered right now. Choose another or remove it, then submit again.');
    expect(quoteErrorMessage({ hint: 'unknown_variant', message: 'x' })).toBe('One of the chosen variants is no longer offered. Choose another, then submit again.');
  });

  it('reads the hint from the message of a database without hints', () => {
    const live = (message, items = LINES) => text(quoteErrorMessage({ code: 'P0001', message, hint: null, details: null }, { items }));
    expect(live('Product is not available')).toMatch(/^An item in this request is no longer available/);
    expect(live('Invalid quantity')).toBe('Quantities must be a whole number from 1 to 100,000.');
    expect(live('Choose a variant for Swisher Sweets cigarillos')).toBe('Choose a variant for ‘Swisher Sweets cigarillos’, then submit again.');
    expect(live('Unknown variant for Geek Bar Pulse 15K')).toBe('The variant chosen for ‘Geek Bar Pulse 15K’ is no longer offered. Choose another, then submit again.');
    expect(live('Too many items')).toMatch(/^This request has more lines than one request can take/);
    expect(live('Add at least one item')).toBe('Add at least one item before you submit.');
    expect(live('A ship-to address is required')).toBe('Enter the ship-to street, city, state and ZIP, or choose will-call pickup.');
    expect(live('Contact details are required')).toBe('Fill in the business, contact, email and phone.');
    expect(live('Invalid delivery method')).toBe('Choose delivery or will-call pickup.');
    expect(live('This quote was already submitted')).toMatch(/^This request may already have been sent\. Call/);
    expect(quoteErrorField({ message: 'A ship-to address is required' })).toBe('shipStreet');
  });

  // Checkout sends nothing while offline (QUOTE_OFFLINE); a browser that
  // went offline during the send can't tell whether it arrived (NEW-061).
  it('says a send that went offline on its way may have been saved, and still prefers a server’s answer', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(QUOTE_OFFLINE).toBe('You’re offline, so nothing was sent. Reconnect and submit again.');
    expect(quoteErrorMessage({ message: 'TypeError: Failed to fetch', code: '' })).toEqual(quoteConnectionMessage());
    expect(quoteErrorMessage({ message: 'The quote was not saved.' })).toEqual(quoteConnectionMessage());
    expect(quoteErrorMessage({ hint: 'invalid_zip' })).toBe('Enter a 5-digit ZIP code (or ZIP+4).');
    // A server that answered with an error code was reached: nothing saved.
    expect(quoteErrorMessage({ code: 'XX000', message: 'boom', hint: '' })).toBe(QUOTE_ERROR_GENERIC);
    vi.restoreAllMocks();
  });

  it('never cites a reference for a refusal', () => {
    for (const hint of ['no_items', 'too_many_items', 'invalid_delivery', 'ref_unavailable', 'invalid_quantity', 'product_unavailable', 'variant_required', 'unknown_variant', 'variant_unavailable', 'already_submitted']) {
      expect(text(quoteErrorMessage({ hint, message: 'x', refNum: 'ALW-Q-0000000000' }, { items: LINES }))).not.toMatch(/ALW-/);
    }
  });
});

describe('todayInBirmingham', () => {
  it('is the date in Birmingham, not UTC', () => {
    // 03:00 UTC on 1 Oct is still 30 Sep in Birmingham (UTC-5 in October).
    expect(todayInBirmingham(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09-30');
    expect(todayInBirmingham(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10-01');
  });
});
