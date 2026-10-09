// The receipt snapshot and its one-record store (AW-012, AW-022): built from
// what was sent, kept in sessionStorage for this tab (memory where storage
// fails), damaged values ignored, and the same object while unchanged.
import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE } from '../data/content.js';
import {
  DELIVERY_LABELS, buildReceipt, clearReceipt, formatPreferredDate, formatSentAt, reachAtText, readLastReceipt, resetReceiptStoreForTests, saveReceipt,
  subscribeReceipt, useLastReceipt,
} from './receipt.js';

const KEY = 'aw-last-receipt';
const LINES = [
  { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, sellUnit: '', price: 10, img: '/x.jpg' },
  { lineKey: '1::red', productId: 1, variant: 'Red', name: 'Swisher Sweets cigarillos — Red', sku: 'AW-SS-RED', qty: 12, sellUnit: 'box of 60' },
];
const FORM = {
  business: ' Test Market ', contact: 'Test Buyer', email: 'buyer@example.test', phone: '', delivery: 'delivery',
  shipStreet: '1 Test Way', shipCity: 'Birmingham', shipState: 'al', shipZip: '35203', preferredDate: '2030-01-15', notes: ' Dock 2 ',
  licenseNo: 'TL-1', resaleCert: 'RS-1', purchasers21: true,
};
const ORDER_V3 = { id: 'o1', ref_num: 'ALW-O-TEST000001', kind: 'order', total_units: 14, subtotal: 123.4, priced_lines: 1, unpriced_lines: 1 };
const record = (receipt, owner = 'guest', entryKey = 'k1') => ({ owner, entryKey, receipt });

beforeEach(() => {
  window.sessionStorage.clear();
  resetReceiptStoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  resetReceiptStoreForTests();
});

describe('buildReceipt', () => {
  it('keeps the reference, totals, lines and delivery details that were sent', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000);
    expect(buildReceipt({ order: ORDER_V3, lines: LINES, data: FORM, asOrder: true })).toEqual({
      ref: 'ALW-O-TEST000001', kind: 'order', totalUnits: 14, subtotal: 123.4, pricedLines: 1, unpricedLines: 1,
      lines: [
        { lineKey: '14', name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, sellUnit: '' },
        { lineKey: '1::red', name: 'Swisher Sweets cigarillos — Red', sku: 'AW-SS-RED', qty: 12, sellUnit: 'box of 60' },
      ],
      delivery: 'delivery',
      ship: { street: '1 Test Way', city: 'Birmingham', state: 'AL', zip: '35203' },
      preferredDate: '2030-01-15', notes: 'Dock 2', contact: 'Test Buyer', business: 'Test Market',
      // No phone given: the email is where the trade desk reaches them.
      reachAt: 'buyer@example.test',
      savedAt: 1_790_000_000_000,
    });
  });

  it('takes an older signature’s answer (no kind or line counts), and has no ship-to for will-call', () => {
    const receipt = buildReceipt({
      order: { id: 'o2', ref_num: 'ALW-Q-FROMCLIENT', total_units: 2, subtotal: null },
      lines: LINES.slice(0, 1),
      data: { ...FORM, delivery: 'willcall', phone: '205-555-0100' },
      asOrder: false,
    });
    expect(receipt).toMatchObject({
      ref: 'ALW-Q-FROMCLIENT', kind: 'quote', totalUnits: 2, subtotal: null, pricedLines: null, unpricedLines: null,
      delivery: 'willcall', ship: null, reachAt: '205-555-0100',
    });
    // Never the license answers.
    expect(JSON.stringify(receipt)).not.toMatch(/TL-1|RS-1|purchasers/);
  });

  it('names the delivery options as checkout does, and dates in US English', () => {
    expect(DELIVERY_LABELS).toEqual({ delivery: 'Next-day delivery (on route)', willcall: 'Will-call pickup' });
    expect(formatPreferredDate('2030-01-15')).toBe('Tuesday, January 15, 2030');
    expect(formatPreferredDate('2026-12-31')).toBe('Thursday, December 31, 2026');
    for (const bad of ['', null, undefined, '2026-02-30', '15/01/2030', '2030-1-5']) expect(formatPreferredDate(bad)).toBe('');
  });
});

describe('the receipt store', () => {
  const receipt = buildReceipt({ order: ORDER_V3, lines: LINES, data: FORM, asOrder: true });

  it('saves one record in sessionStorage, reads it back, and clears it', () => {
    expect(STORAGE.receipt).toBe(KEY);
    expect(readLastReceipt()).toBeNull();
    saveReceipt(record(receipt, 'user-1', 'k1'));
    expect(JSON.parse(window.sessionStorage.getItem(KEY))).toEqual(record(receipt, 'user-1', 'k1'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(readLastReceipt()).toEqual(record(receipt, 'user-1', 'k1'));
    // One record: the next save replaces it.
    saveReceipt(record({ ...receipt, ref: 'ALW-O-TEST000002' }, 'user-1', 'k2'));
    expect(readLastReceipt()).toMatchObject({ entryKey: 'k2', receipt: { ref: 'ALW-O-TEST000002' } });
    clearReceipt();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(readLastReceipt()).toBeNull();
  });

  it('returns the same object while the stored text is unchanged', () => {
    saveReceipt(record(receipt));
    const first = readLastReceipt();
    expect(readLastReceipt()).toBe(first);
    saveReceipt(record(receipt, 'guest', 'k2'));
    expect(readLastReceipt()).not.toBe(first);
  });

  it('ignores damaged or foreign values', () => {
    for (const raw of ['{not json', '"text"', '[]', JSON.stringify({ owner: 'guest', entryKey: 'k1' }),
      JSON.stringify({ owner: '', entryKey: 'k1', receipt }), JSON.stringify({ owner: 'guest', entryKey: 'k1', receipt: { ...receipt, ref: '' } }),
      JSON.stringify({ owner: 'guest', entryKey: null, receipt })]) {
      window.sessionStorage.setItem(KEY, raw);
      expect(readLastReceipt(), raw).toBeNull();
    }
    // A record without an owner or entry key is never saved.
    window.sessionStorage.clear();
    saveReceipt({ owner: 'guest', entryKey: null, receipt });
    saveReceipt({ owner: null, entryKey: 'k1', receipt });
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the receipt in memory for this page view when sessionStorage throws', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('The operation is insecure.', 'SecurityError'); });
    expect(readLastReceipt()).toBeNull();
    saveReceipt(record(receipt));
    expect(readLastReceipt()).toEqual(record(receipt));
    clearReceipt();
    expect(readLastReceipt()).toBeNull();
  });

  it('keeps the receipt in memory when sessionStorage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    saveReceipt(record(receipt));
    expect(readLastReceipt()).toEqual(record(receipt));
  });

  it('tells subscribers, and useLastReceipt re-renders with the record', () => {
    const heard = vi.fn();
    const stop = subscribeReceipt(heard);
    saveReceipt(record(receipt));
    clearReceipt();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();

    function Probe() {
      const last = useLastReceipt();
      return createElement('p', null, last ? last.receipt.ref : 'none');
    }
    const view = render(createElement(Probe));
    expect(view.container.textContent).toBe('none');
    act(() => saveReceipt(record(receipt)));
    expect(view.container.textContent).toBe('ALW-O-TEST000001');
    act(() => clearReceipt());
    expect(view.container.textContent).toBe('none');
  });
});

// What the receipt prints from a stored snapshot (NEW-062).
describe('formatSentAt and reachAtText', () => {
  const plain = (text) => text.replace(/\s/g, ' ');
  it('gives the time it was sent on the warehouse’s clock, with its zone', () => {
    expect(plain(formatSentAt(Date.UTC(2026, 9, 9, 20, 45)))).toBe('Oct 9, 2026, 3:45 PM CT');
    // Central Standard Time in January.
    expect(plain(formatSentAt(Date.UTC(2026, 0, 2, 6, 5)))).toBe('Jan 2, 2026, 12:05 AM CT');
  });

  it('gives nothing without a usable time', () => {
    for (const value of [undefined, null, '', '1700000000000', Number.NaN, Infinity, 8.64e15 + 1]) expect(formatSentAt(value)).toBe('');
  });

  it('writes a ten-digit phone the usual way and leaves an email, or anything else, as it is', () => {
    expect(reachAtText('2055550123')).toBe('(205) 555-0123');
    expect(reachAtText('+1 205.555.0123')).toBe('(205) 555-0123');
    expect(reachAtText('(205) 555-0123')).toBe('(205) 555-0123');
    expect(reachAtText('buyer@example.test')).toBe('buyer@example.test');
    expect(reachAtText('205-555')).toBe('205-555');
    expect(reachAtText(undefined)).toBe('');
  });
});
