// The order email (AW-024): the submission checkout posts to Netlify Forms
// once an order is saved, the hidden form in index.html that lets Netlify
// take it, and a post that never fails or holds up the order.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { netlifyForms, netlifyHoneypot } from '../../scripts/netlify-forms.mjs';
import { COMPANY } from '../data/content.js';
import {
  HONEYPOT_FIELD, NOTIFY_TIMEOUT_MS, ORDER_NOTIFICATION_FIELDS, ORDER_NOTIFICATION_FORM,
  encodeOrderNotification, orderLineText, orderNotificationFields, sendOrderNotification,
} from './orderNotification.js';

const UUID = '3f2c9a1e-5b7d-4c11-8e2f-0a1b2c3d4e5f';
const DATA = {
  business: ' Alpha Food Mart ', contact: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001',
  delivery: 'delivery', preferredDate: '2030-01-15', notes: 'Back door\nbefore 10',
  shipStreet: '1 Alpha Way', shipCity: 'Hoover', shipState: 'al', shipZip: '35216',
};
const LINES = [
  { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, sellUnit: '' },
  { lineKey: '1::red', productId: 1, variant: 'Red', name: 'Swisher Sweets cigarillos — Red', sku: 'AW-SS-RED', qty: 4, sellUnit: 'box of 30' },
];
const SAVED_AT = Date.UTC(2026, 9, 9, 20, 45);

describe('orderNotificationFields', () => {
  it('holds every field, in the form’s order, from the saved order', () => {
    const fields = orderNotificationFields({ ref: 'ALW-O-5E4F3A2B1C', orderId: UUID, data: DATA, lines: LINES, savedAt: SAVED_AT, origin: 'https://alabamawholesaleinc.com' });
    expect(Object.keys(fields)).toEqual([...ORDER_NOTIFICATION_FIELDS]);
    expect({ ...fields, 'placed-at': fields['placed-at'].replace(/\s/g, ' ') }).toEqual({
      subject: 'New order ALW-O-5E4F3A2B1C from Alpha Food Mart',
      reference: 'ALW-O-5E4F3A2B1C',
      'placed-at': 'Oct 9, 2026, 3:45 PM CT',
      business: 'Alpha Food Mart',
      contact: 'Alice Alpha',
      email: 'alpha@example.test',
      phone: '205-000-0001',
      delivery: 'Next-day delivery (on route)',
      'preferred-date': 'Tuesday, January 15, 2030',
      'ship-to': '1 Alpha Way, Hoover, AL 35216',
      items: '2 × Kite cigarette tobacco | SKU: AW-KITE\n4 × Swisher Sweets cigarillos | Variant: Red | SKU: AW-SS-RED | Sell unit: box of 30',
      'line-count': '2',
      'total-units': '6',
      notes: 'Back door\nbefore 10',
      'admin-link': `https://alabamawholesaleinc.com/admin/orders/${UUID}/print`,
    });
  });

  it('says will-call and any day, and links to Admin -> Orders without an order id', () => {
    const fields = orderNotificationFields({ ref: 'ALW-O-1', orderId: 'o1', data: { ...DATA, delivery: 'willcall', preferredDate: '' }, lines: LINES, origin: 'https://example.test' });
    expect(fields.delivery).toBe('Will-call pickup');
    expect(fields['ship-to']).toBe(`Will-call pickup at ${COMPANY.addressShort}`);
    expect(fields['preferred-date']).toBe('Any day');
    expect(fields['admin-link']).toBe('https://example.test/admin/orders');
  });

  it('carries no prices and no licence answers', () => {
    const fields = orderNotificationFields({
      ref: 'ALW-O-1', orderId: UUID, data: { ...DATA, licenseNo: 'TL-SECRET' },
      lines: LINES.map((line) => ({ ...line, price: 12.5 })),
    });
    expect(Object.values(fields).join(' ')).not.toMatch(/\$|12\.5|TL-SECRET/);
  });

  it('writes a line as quantity, product, variant, SKU and sell unit, leaving out what it hasn’t', () => {
    expect(orderLineText(LINES[1])).toBe('4 × Swisher Sweets cigarillos | Variant: Red | SKU: AW-SS-RED | Sell unit: box of 30');
    expect(orderLineText({ name: 'Plain', qty: 1 })).toBe('1 × Plain');
    // A name that doesn't end in its variant keeps its whole name.
    expect(orderLineText({ name: 'Gum', variant: 'Mint', qty: 3, sku: 'AW-GUM-MINT' })).toBe('3 × Gum | Variant: Mint | SKU: AW-GUM-MINT');
  });
});

describe('encodeOrderNotification', () => {
  it('is form-name, the empty honeypot and every field, URL-encoded', () => {
    const fields = orderNotificationFields({ ref: 'ALW-O-1', orderId: UUID, data: DATA, lines: LINES, origin: 'https://example.test' });
    const params = new URLSearchParams(encodeOrderNotification(fields));
    expect([...params.keys()]).toEqual(['form-name', HONEYPOT_FIELD, ...ORDER_NOTIFICATION_FIELDS]);
    expect(params.get('form-name')).toBe(ORDER_NOTIFICATION_FORM);
    expect(params.get(HONEYPOT_FIELD)).toBe('');
    expect(params.get('items')).toBe(fields.items);
    expect(params.get('notes')).toBe('Back door\nbefore 10');
  });
});

describe('sendOrderNotification', () => {
  const FIELDS = orderNotificationFields({ ref: 'ALW-O-1', orderId: UUID, data: DATA, lines: LINES, origin: 'https://example.test' });
  afterEach(() => vi.useRealTimers());

  it('posts the form to / as Netlify takes it, and says it was taken', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const log = vi.fn();
    await expect(sendOrderNotification(FIELDS, { fetchImpl, log })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/');
    expect(init).toMatchObject({
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin', keepalive: true,
    });
    expect(init.body).toBe(encodeOrderNotification(FIELDS));
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(log).not.toHaveBeenCalled();
  });

  it('never rejects: a refusal or a failed fetch is logged by status or name only', async () => {
    const log = vi.fn();
    await expect(sendOrderNotification(FIELDS, { fetchImpl: async () => ({ ok: false, status: 404 }), log })).resolves.toBe(false);
    await expect(sendOrderNotification(FIELDS, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); }, log })).resolves.toBe(false);
    await expect(sendOrderNotification(FIELDS, { fetchImpl: null, log })).resolves.toBe(false);
    expect(log.mock.calls.map(([text]) => text)).toEqual([
      'The order email wasn’t sent (status 404). The order is saved; it is in Admin -> Orders.',
      'The order email wasn’t sent (TypeError). The order is saved; it is in Admin -> Orders.',
    ]);
    // No personal data in the log.
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/Alpha|alpha@|205-000|ALW-O/);
  });

  it('gives up after its time limit', async () => {
    vi.useFakeTimers();
    let seen;
    const fetchImpl = vi.fn((url, init) => new Promise((_resolve, reject) => {
      seen = init.signal;
      init.signal.addEventListener('abort', () => reject(init.signal.reason));
    }));
    const log = vi.fn();
    const result = sendOrderNotification(FIELDS, { fetchImpl, log });
    await vi.advanceTimersByTimeAsync(NOTIFY_TIMEOUT_MS);
    await expect(result).resolves.toBe(false);
    expect(seen.aborted).toBe(true);
    expect(log.mock.calls[0][0]).toMatch(/^The order email wasn’t sent \(TimeoutError\)/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('sends a very long order without keepalive, which caps the body at 64 KiB', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await sendOrderNotification({ ...FIELDS, notes: 'x'.repeat(70000) }, { fetchImpl });
    expect(fetchImpl.mock.calls[0][1].keepalive).toBe(false);
  });
});

// Netlify takes a submission only for a form it found in the deployed HTML,
// and keeps only the fields the form lists.
describe('the order-notification form in index.html', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('declares every field the post sends, the honeypot and form-name, hidden', () => {
    const forms = netlifyForms(html);
    expect(Object.keys(forms)).toEqual([ORDER_NOTIFICATION_FORM]);
    expect(forms[ORDER_NOTIFICATION_FORM]).toEqual(['form-name', HONEYPOT_FIELD, ...ORDER_NOTIFICATION_FIELDS]);
    expect(netlifyHoneypot(html, ORDER_NOTIFICATION_FORM)).toBe(HONEYPOT_FIELD);
    const tag = html.match(/<form\b[^>]*name="order-notification"[^>]*>/)[0];
    expect(tag).toMatch(/\shidden(\s|>)/);
    expect(tag).toMatch(/data-netlify="true"/);
    // Outside #root, so React never replaces it.
    expect(html.indexOf('<form')).toBeGreaterThan(html.indexOf('<div id="root">'));
    expect(html.indexOf('<form')).toBeGreaterThan(html.indexOf('</noscript>'));
  });
});
