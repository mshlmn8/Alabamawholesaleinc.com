// Checkout on a stalled or missing connection (AW-194, AW-344), and the
// remaining submit_quote refusals in the page (AW-200): the lines and the
// fields are locked while a send runs, a send that takes too long says the
// request may have been saved and unlocks the form, offline turns the submit
// button off with a note, and a refusal names its product.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QUOTE_OFFLINE, submitOrder } from '../lib/orders.js';
import { timeoutError } from '../lib/network.js';
import { QuotePage } from './QuotePage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));
vi.mock('../lib/orders.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitOrder: vi.fn(async () => ({ ok: true, order: { id: 'o1', ref_num: 'ALW-Q-TEST000001' } })),
}));

const CANDY = { lineKey: '40', productId: 40, variant: null, name: 'Test candy', sku: 'AW-CANDY', cat: 'CANDIES', qty: 2, price: null };
const MINT = { lineKey: '41::mint', productId: 41, variant: 'Mint', name: 'Test gum — Mint', sku: 'AW-GUM-MINT', cat: 'CANDIES', qty: 1, price: null };
const ITEMS = [CANDY, MINT];
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };

function page(props = {}) {
  const base = {
    items: ITEMS, total: 0, setLine: vi.fn(), chooseVariant: vi.fn(), removeLine: vi.fn(), removeLines: vi.fn(), clearCart: vi.fn(),
    isBackendConfigured: true, onSignIn: vi.fn(), checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })), ...GUEST,
  };
  return <QuotePage {...base} {...props} />;
}
const fill = () => {
  for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
    ['quote-phone', '205-000-0000'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) {
    fireEvent.change(document.getElementById(id), { target: { value } });
  }
};
const form = () => document.querySelector('form[aria-labelledby="quote-form-title"]');
const submitButton = () => document.querySelector('button[type="submit"]');
const submitError = () => document.getElementById('quote-submit-error');
const locked = (el) => !!el.closest('fieldset')?.disabled;

describe('QuotePage while a send runs (AW-194)', () => {
  it('locks the fields, the steppers, × and Clear all items, and unlocks them when the send fails', async () => {
    let fail;
    submitOrder.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    render(page());
    fill();
    const controls = () => [
      document.getElementById('quote-business'), document.getElementById('quote-delivery'), document.getElementById('quote-notes'),
      ...screen.getAllByRole('button', { name: /^(Decrease|Increase|Remove)/ }),
      screen.getByRole('textbox', { name: 'Quantity of Test candy' }),
      screen.getByRole('button', { name: 'Clear all items' }),
    ];
    expect(controls().some(locked)).toBe(false);
    await act(async () => { fireEvent.submit(form()); });
    expect(submitButton().textContent).toBe('Sending…');
    expect(controls().every(locked)).toBe(true);
    expect(document.querySelectorAll('fieldset.checkout-fieldset')).toHaveLength(2);
    await act(async () => { fail(timeoutError('The quote request took too long.')); });
    expect(controls().some(locked)).toBe(false);
    expect(submitButton().disabled).toBe(false);
  });

  it('locks them while the catalog is checked too', async () => {
    let finish;
    render(page({ checkCart: vi.fn(() => new Promise((resolve) => { finish = resolve; })) }));
    fill();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitButton().textContent).toBe('Checking the catalog…');
    expect(locked(screen.getByRole('button', { name: 'Clear all items' }))).toBe(true);
    await act(async () => { finish({ ok: true, items: ITEMS }); });
  });

  it('says a send that took too long may have been saved, citing a reference only when one was sent', async () => {
    render(page());
    fill();
    submitOrder.mockImplementationOnce(async () => { throw timeoutError(); });
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(/^This is taking longer than expected, and the request may have been saved\. Call \(205\) .* before you submit it again, so it isn’t sent twice\.$/);
    expect(submitError().textContent).not.toMatch(/ALW-/);
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(timeoutError(), { refNum: 'ALW-Q-0A1B2C3D4E' }); });
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(/ and give quote reference ALW-Q-0A1B2C3D4E before you submit it again\.$/);
  });
});

describe('QuotePage offline (AW-344)', () => {
  it('turns the submit button off with a note, and back on when the connection returns', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(page());
    fill();
    expect(submitButton().disabled).toBe(true);
    const note = document.querySelector('.quote-offline');
    expect(note.textContent).toBe('You’re offline. Reconnect to submit.');
    // The site notice announces it; the note doesn't speak again.
    expect(note.hasAttribute('role')).toBe(false);
    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(submitButton().disabled).toBe(false);
    expect(document.querySelector('.quote-offline')).toBeNull();
  });

  it('sends nothing when a submit gets through while offline', async () => {
    vi.mocked(submitOrder).mockClear();
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ checkCart }));
    fill();
    // The browser goes offline without an event yet.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toBe(QUOTE_OFFLINE);
    expect(checkCart).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it('says offline, not “couldn’t check”, when the catalog check fails because the connection dropped', async () => {
    vi.mocked(submitOrder).mockClear();
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const checkCart = vi.fn(async () => { onLine.mockReturnValue(false); return { ok: false, error: { kind: 'network' } }; });
    render(page({ checkCart }));
    fill();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toBe(QUOTE_OFFLINE);
    expect(submitOrder).not.toHaveBeenCalled();
  });
});

describe('QuotePage and the remaining refusals (AW-200)', () => {
  it('names the line a refusal is about, from the lines that were sent', async () => {
    render(page());
    fill();
    submitOrder.mockImplementationOnce(async () => { throw { code: 'P0001', message: 'That variant is not available', hint: 'variant_unavailable', details: '41' }; });
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toBe('‘Test gum — Mint’ can’t be ordered right now. Choose another variant or remove it, then submit again.');
    // An older database's message without a hint.
    submitOrder.mockImplementationOnce(async () => { throw { code: 'P0001', message: 'Product is not available', hint: null, details: null }; });
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(/^An item in this request is no longer available, so nothing was sent\./);
    expect(submitError().textContent).not.toMatch(/ALW-/);
  });
});
