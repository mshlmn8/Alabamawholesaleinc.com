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
    expect(submitError().textContent).toMatch(/^We stopped waiting for an answer, and the request may have been saved\. Call \(205\) .* before you submit it again, so it isn’t sent twice\.$/);
    expect(submitError().textContent).not.toMatch(/ALW-/);
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(timeoutError(), { refNum: 'ALW-Q-0A1B2C3D4E' }); });
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(/ and give quote reference ALW-Q-0A1B2C3D4E before you submit it again\.$/);
  });
});

// A connection lost while the request was on its way may have delivered it
// (NEW-061): the buyer is told to call before sending it again, never
// "We couldn’t save this quote" or "nothing was sent".
describe('QuotePage when the connection drops during the send (NEW-061)', () => {
  const MAY_HAVE = /^The connection dropped before an answer came back, and the request may have been saved\. Call \(205\) .* before you submit it again, so it isn’t sent twice\.$/;

  it('says a send whose connection failed may have been saved', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    submitOrder.mockImplementationOnce(async () => { throw { message: 'TypeError: Failed to fetch', code: '', hint: '', details: '' }; });
    render(page());
    fill();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(MAY_HAVE);
    vi.restoreAllMocks();
  });

  it('says the same when the browser went offline only after the send started', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    submitOrder.mockImplementationOnce(async () => {
      onLine.mockReturnValue(false);
      throw new Error('The quote was not saved.');
    });
    render(page());
    fill();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(MAY_HAVE);
    expect(submitError().textContent).not.toBe(QUOTE_OFFLINE);
    vi.restoreAllMocks();
  });

  it('says nothing was sent when the catalog check itself threw', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(submitOrder).mockClear();
    render(page({ checkCart: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) }));
    fill();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError().textContent).toMatch(/^We couldn’t check the latest prices and availability, so nothing was sent\./);
    expect(submitOrder).not.toHaveBeenCalled();
    vi.restoreAllMocks();
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

// Locking the form for a send drops focus to <body> (NEW-009): when the
// submit ends without a save, focus comes back to the field the refusal is
// about, else to the message that says what happened.
describe('QuotePage focus after a submit that didn’t save (NEW-009)', () => {
  const KITE = { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null };
  const answerLicense = () => {
    fireEvent.change(document.getElementById('quote-license'), { target: { value: 'TL-1' } });
    fireEvent.change(document.getElementById('quote-resale'), { target: { value: 'RS-1' } });
    fireEvent.click(document.getElementById('quote-age'));
  };
  // Press Enter on the focused submit button; the browser then blurs it, as
  // Chromium does with a control that becomes disabled.
  const submitFromButton = async () => {
    submitButton().focus();
    await act(async () => {
      fireEvent.submit(form());
      document.activeElement.blur();
    });
  };

  it('focuses the message, not <body>, when the send fails', async () => {
    submitOrder.mockImplementationOnce(async () => { throw { code: 'XX000', message: 'boom', hint: '', details: '' }; });
    render(page());
    fill();
    await submitFromButton();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(submitError());
    expect(submitError().tabIndex).toBe(-1);
  });

  it('focuses the field a refusal is about: license_required, the license number', async () => {
    submitOrder.mockImplementationOnce(async () => { throw { code: 'P0001', message: 'x', hint: 'license_required', details: '' }; });
    render(page({ items: [KITE], checkCart: vi.fn(async () => ({ ok: true, items: [KITE] })) }));
    fill();
    answerLicense();
    await submitFromButton();
    const license = document.getElementById('quote-license');
    expect(document.activeElement).toBe(license);
    expect(license.getAttribute('aria-invalid')).toBe('true');
    expect(license.getAttribute('aria-describedby')).toMatch(/quote-submit-error/);
  });

  it('focuses the message after a catalog check that failed, and the change note after one that found changes', async () => {
    const checkCart = vi.fn(async () => ({ ok: false, part: 'catalog', error: { message: 'x' } }));
    const view = render(page({ checkCart }));
    fill();
    await submitFromButton();
    expect(document.activeElement).toBe(submitError());
    view.unmount();
    // The catalog check finds a line that can no longer be ordered; App's
    // cart shows the same by the time the note is on screen.
    const changed = ITEMS.map((it) => (it === CANDY ? { ...it, unavailable: 'product' } : it));
    const reload = vi.fn(async () => {
      again.rerender(page({ items: changed, checkCart: reload }));
      return { ok: true, items: changed };
    });
    const again = render(page({ checkCart: reload }));
    fill();
    await submitFromButton();
    const note = document.getElementById('quote-change-note');
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(note);
  });

  it('focuses the message after a send that took too long', async () => {
    submitOrder.mockImplementationOnce(async () => { throw timeoutError(); });
    render(page());
    fill();
    await submitFromButton();
    expect(document.activeElement).toBe(submitError());
  });

  it('leaves focus alone when the buyer was somewhere else when the submit began', async () => {
    submitOrder.mockImplementationOnce(async () => { throw new Error('boom'); });
    render(<><button type="button" id="elsewhere">Elsewhere</button><div>{page()}</div></>);
    fill();
    const elsewhere = document.getElementById('elsewhere');
    elsewhere.focus();
    await act(async () => { fireEvent.submit(form()); });
    expect(submitError()).toBeTruthy();
    expect(document.activeElement).toBe(elsewhere);
  });
});
