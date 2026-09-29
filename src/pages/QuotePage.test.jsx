// Checkout while the account changes underneath it (AW-186, AW-190, AW-048).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';
import { submitOrder } from '../lib/orders.js';

// submitOrder is the only way out; record what it is asked to send.
const sent = vi.hoisted(() => []);
vi.mock('../lib/orders.js', () => ({
  submitOrder: vi.fn(async ({ refNum, items }) => {
    sent.push(items);
    return { ok: true, order: { id: 'o1', ref_num: refNum } };
  }),
}));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, price: 10 }];
const A = { id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', status: 'approved' };
const B = { id: 'b', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '', status: 'pending' };

function page(props) {
  const base = {
    items: ITEMS, total: 20, addLine: vi.fn(), decLine: vi.fn(), removeLine: vi.fn(), clearCart: vi.fn(),
    isBackendConfigured: true, onSignIn: vi.fn(),
  };
  return <QuotePage {...base} {...props} />;
}
const field = (id) => document.getElementById(id).value;
const submit = () => screen.getByRole('button', { name: /Submit/ });

describe('QuotePage and the account', () => {
  it('waits for the account instead of showing the guest form (AW-186)', () => {
    const view = render(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect(screen.queryByText('Request your quote')).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull();
    view.rerender(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Place your order');
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone')])
      .toEqual(['Alpha Food Mart', 'Alice Alpha', 'alpha@example.test', '205-000-0001']);
  });

  it('warns and blocks the order when the buyer is signed out mid-checkout (AW-048, AW-190)', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    expect(submit().disabled).toBe(false);
    view.rerender(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false }));
    expect(screen.getByRole('alert').textContent).toMatch(/You were signed out/);
    expect(submit().disabled).toBe(true);
    // The signed-out buyer's details are gone.
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone'), field('ship-street')]).toEqual(['', '', '', '', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Send it as a quote request instead' }));
    expect(submit().disabled).toBe(false);
    expect(submit().textContent).toMatch(/Submit quote request/);
  });

  it('refills for the next buyer, and says when their account can’t order (AW-190, AW-048)', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    view.rerender(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    view.rerender(page({ profile: B, account: 'ready', signedIn: true, isApprovedBuyer: false }));
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone'), field('ship-street')])
      .toEqual(['Bravo Tobacco Outlet', 'Bea Bravo', 'bravo@example.test', '', '']);
    expect(screen.getByRole('alert').textContent).toMatch(/can’t place orders yet/);
    expect(submit().disabled).toBe(true);
  });

  it('keeps what a guest typed when they sign in', () => {
    const view = render(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false }));
    fireEvent.change(document.getElementById('quote-contact'), { target: { value: 'Typed Name' } });
    view.rerender(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(field('quote-contact')).toBe('Typed Name');
    expect(field('quote-business')).toBe('Alpha Food Mart');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('blocks the submit until lines that can no longer be ordered are removed (AW-083)', () => {
    const removeLines = vi.fn();
    const gone = { lineKey: '999', productId: 999, variant: null, unavailable: 'product', name: 'Old product', sku: 'AW-OLD', qty: 4, price: null };
    render(page({ items: [...ITEMS, gone], removeLines, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(screen.getByText('1 item in your cart is no longer available.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Remove the items that are no longer available before you submit.');
    expect(submit().disabled).toBe(true);
    // Units count only what can be ordered.
    expect(screen.getByText('2 units')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable items' }));
    expect(removeLines).toHaveBeenCalledWith(['999']);
  });

  it('lists an old cart’s products that need a variant, also when the cart is empty (AW-354)', () => {
    const legacy = [{ productId: 1, qty: 3, name: 'Swisher Sweets cigarillos' }];
    const view = render(page({ items: [], legacy, onDismissLegacy: vi.fn(), profile: null, account: 'signed-out', isApprovedBuyer: false }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your cart is empty');
    expect(screen.getByRole('link', { name: 'Choose a variant for Swisher Sweets cigarillos' })).toBeTruthy();
    view.rerender(page({ legacy, onDismissLegacy: vi.fn(), profile: null, account: 'signed-out', isApprovedBuyer: false }));
    expect(screen.getByRole('link', { name: 'Choose a variant for Swisher Sweets cigarillos' })).toBeTruthy();
  });
});

// Submit loads the catalog again and stops when a line changed (AW-191).
describe('QuotePage and a catalog that changed', () => {
  const fill = () => {
    for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-000-0000'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));

  it('checks the catalog, then sends the lines as they are now', async () => {
    sent.length = 0;
    let finish;
    const checkCart = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    render(page({ profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    fill();
    submitForm();
    const button = document.querySelector('button[type="submit"]');
    expect(button.textContent).toMatch(/Checking the catalog…/);
    expect(button.disabled).toBe(true);
    await act(async () => { finish({ ok: true, items: ITEMS }); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(checkCart).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([ITEMS]);
  });

  it('names a line that is no longer available and sends nothing', async () => {
    sent.length = 0;
    const gone = { ...ITEMS[0], unavailable: 'product', price: null };
    const checkCart = vi.fn(async () => ({ ok: true, items: [gone] }));
    const view = render(page({ profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    // App re-renders the page with the catalog it just loaded.
    view.rerender(page({ items: [gone], removeLines: vi.fn(), profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('The catalog changed since this page opened, so nothing was sent. Kite cigarette tobacco is no longer available — remove it to continue. Check your items, then submit again.');
    expect(sent).toEqual([]);
    // Gone once the lines on the page change.
    view.rerender(page({ items: [], profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    expect(screen.queryByText(/The catalog changed/)).toBeNull();
  });

  it('shows the total the server saved (AW-351)', async () => {
    sent.length = 0;
    submitOrder.mockImplementationOnce(async ({ refNum }) => ({ ok: true, order: { id: 'o2', ref_num: refNum, subtotal: 1234.5, total_units: 7 } }));
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready', checkCart }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.getByText('Saved total: $1,234.50 · 7 units')).toBeTruthy();
  });

  it('shows no saved total for an unpriced quote', async () => {
    sent.length = 0;
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.queryByText(/Saved total/)).toBeNull();
  });

  it('sends nothing when the catalog can’t be checked', async () => {
    sent.length = 0;
    const checkCart = vi.fn(async () => ({ ok: false, error: { kind: 'network' } }));
    render(page({ profile: null, account: 'signed-out', isApprovedBuyer: false, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t check the latest prices and availability, so nothing was sent\./);
    expect(sent).toEqual([]);
    expect(submit().disabled).toBe(false);
  });
});

describe('QuotePage totals for an approved buyer', () => {
  it('shows the estimate, or that prices are loading or on request', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 20, pricesStatus: 'ready' }));
    const total = () => document.querySelector('.checkout-total').textContent;
    expect(total()).toBe('2 units$20.00');
    const unpriced = [{ ...ITEMS[0], price: null }];
    view.rerender(page({ items: unpriced, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 0, pricesStatus: 'loading' }));
    expect(total()).toBe('2 unitsLoading prices…');
    // No order-minimum notice while the total isn't known.
    expect(screen.queryByText(/The order minimum is/)).toBeNull();
    view.rerender(page({ items: unpriced, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 0, pricesStatus: 'ready' }));
    expect(total()).toBe('2 unitsPrice on request');
  });
});
