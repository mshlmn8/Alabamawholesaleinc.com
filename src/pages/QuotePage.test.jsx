// Checkout (AW-024: customers place orders, never quotes): who may order
// (AW-014), the account changing underneath it (AW-186, AW-190, AW-048),
// submit_quote v3 (AW-049, AW-079, AW-198, AW-201), removing lines
// (AW-042), the receipt after a save (AW-012, AW-022, AW-108) and the order
// email (src/lib/orderNotification.js).
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { QuotePage } from './QuotePage.jsx';
import { submitOrder, todayInBirmingham } from '../lib/orders.js';
import { ORDER_NOTIFICATION_FIELDS, sendOrderNotification } from '../lib/orderNotification.js';
import { COMPANY } from '../data/content.js';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

// submitOrder is the only way out; record what it is asked to send. The
// reference comes back from the server (AW-049).
const sent = vi.hoisted(() => []);
const forms = vi.hoisted(() => []);
const calls = vi.hoisted(() => []);
vi.mock('../lib/orders.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitOrder: vi.fn(async (args) => {
    sent.push(args.items);
    calls.push(args);
    forms.push(args.formData);
    // No kind, like a database without v3.
    return { ok: true, order: { id: 'o1', ref_num: 'ALW-O-TEST000001' } };
  }),
}));
// The order email is posted after a save, never awaited (AW-024).
const notices = vi.hoisted(() => []);
vi.mock('../lib/orderNotification.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendOrderNotification: vi.fn(async (fields) => { notices.push(fields); return true; }),
}));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: 10 }];
const A = { id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', status: 'approved' };
const B = { id: 'b', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '', status: 'pending' };
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
const PENDING = { profile: B, account: 'ready', signedIn: true, isApprovedBuyer: false };
const APPROVED = { profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true };
const SUSPENDED = { profile: { ...A, status: 'suspended' }, account: 'ready', signedIn: true, isApprovedBuyer: false };

function page(props) {
  const base = {
    items: ITEMS, total: 20, setLine: vi.fn(), chooseVariant: vi.fn(), removeLine: vi.fn(), removeLines: vi.fn(), clearCart: vi.fn(),
    isBackendConfigured: true, onSignIn: vi.fn(),
  };
  return <QuotePage {...base} {...props} />;
}
const field = (id) => document.getElementById(id).value;
const submit = () => screen.getByRole('button', { name: /Place order/ });
const gate = () => document.querySelector('.checkout-gate');

// Only a signed-in, approved account that isn't on hold places an order
// (AW-014, AW-024). Everyone else sees the cart and, in place of the form,
// why not and what to do; no approval time is promised (AW-246).
describe('QuotePage: who may place an order (AW-014, AW-024)', () => {
  it('shows a guest the cart, and Sign in and Apply instead of the form', () => {
    const onSignIn = vi.fn();
    const onApplyClick = vi.fn();
    render(page({ ...GUEST, onSignIn, onApplyClick }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect(screen.getByRole('list', { name: 'Items in your order' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' })).toBeTruthy();
    const panel = screen.getByRole('region', { name: 'Sign in to place your order' });
    expect(panel).toBe(gate());
    expect(panel.textContent).toMatch(/Orders are placed from an approved trade account, for licensed retailers only\. Your cart is kept when you sign in\./);
    fireEvent.click(within(panel).getByRole('button', { name: 'Sign in' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Apply for a trade account' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    // No form, no licence fields, no submit (the guest quote is gone).
    expect(document.querySelector('form')).toBeNull();
    expect(document.getElementById('quote-business')).toBeNull();
    expect(document.getElementById('quote-license')).toBeNull();
    expect(screen.queryByRole('button', { name: /Place order|Submit/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/quote/i);
  });

  it('links a guest to the apply page when there is no apply dialog', () => {
    render(page({ ...GUEST, onApplyClick: undefined }));
    expect(within(gate()).getByRole('link', { name: 'Apply for a trade account' }).getAttribute('href')).toBe('/apply');
  });

  it('tells an account under review it can order once approved, with no approval time', () => {
    render(page(PENDING));
    const panel = screen.getByRole('region', { name: 'Your account is being reviewed' });
    expect(panel.querySelector('p').textContent).toBe('You can place orders once it’s approved. Your cart stays here until then.');
    expect(within(panel).getByRole('link', { name: 'Application status' }).getAttribute('href')).toBe('/apply');
    expect(panel.textContent).not.toMatch(/business day|within|hours?\b/i);
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    // Its lines can still be changed, for when it can order.
    expect(screen.getByRole('button', { name: 'Clear all items' })).toBeTruthy();
  });

  it('tells a suspended account ordering is paused, with the trade desk, in place of the form (AW-201, NEW-064)', () => {
    const view = render(page(SUSPENDED));
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    const panel = gate();
    expect(panel.classList.contains('status-suspended')).toBe(true);
    expect(panel.querySelector('h2').textContent).toBe('Account on hold');
    const paused = panel.querySelector('.quote-paused');
    expect(paused.textContent).toMatch(/^Ordering is paused on this account\. Call \(205\) 458-4788 or email .+ and a trade rep will help you sort it out\.$/);
    expect(paused.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
    // Said once; nothing invites an order, and the lines can still change.
    expect(document.body.textContent.split('Ordering is paused on this account.')).toHaveLength(2);
    expect(document.querySelector('form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear all items' }).closest('fieldset').disabled).toBe(false);
    // An approved buyer suspended mid-checkout gets the same.
    view.rerender(page(APPROVED));
    expect(submit()).toBeTruthy();
    view.rerender(page(SUSPENDED));
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    expect(document.querySelector('.quote-paused')).toBeTruthy();
  });

  it('says a signed-in account whose details didn’t load can order once they load (NEW-002)', () => {
    render(page({ profile: null, account: 'no-profile', signedIn: true, isApprovedBuyer: false }));
    const panel = screen.getByRole('region', { name: 'Your account didn’t load' });
    expect(panel.textContent).toMatch(/didn’t load\. Orders can be placed once they load: use Try again at the top of the page\.$/);
    expect(within(panel).queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('says ordering online is unavailable without a backend, with the trade desk', () => {
    render(page({ ...APPROVED, isBackendConfigured: false }));
    expect(screen.getByRole('region', { name: 'Online ordering is unavailable' }).textContent)
      .toMatch(/^Online ordering is unavailableOrders can’t be placed online right now\. Call \(205\) 458-4788 or email .+ and the trade desk will take your order\.$/);
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
  });

  it('gives an approved buyer the form and Place order', () => {
    render(page(APPROVED));
    expect(gate()).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Your details' })).toBeTruthy();
    expect(submit().textContent).toBe('Place order');
  });
});

describe('QuotePage and the account', () => {
  it('waits for the account before choosing the form or the sign-in panel (AW-186)', () => {
    const view = render(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect(gate()).toBeNull();
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    view.rerender(page(APPROVED));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone')])
      .toEqual(['Alpha Food Mart', 'Alice Alpha', 'alpha@example.test', '205-000-0001']);
  });

  it('asks a buyer signed out mid-checkout to sign in again, in place of the form (AW-048, AW-190)', () => {
    const onSignIn = vi.fn();
    const view = render(page({ ...APPROVED, onSignIn }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    expect(submit().disabled).toBe(false);
    view.rerender(page({ ...GUEST, onSignIn }));
    expect(gate().querySelector('h2').textContent).toBe('Sign in to place your order');
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    // No quote request instead (AW-024).
    expect(screen.queryByRole('button', { name: /quote/i })).toBeNull();
    fireEvent.click(within(gate()).getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    // Signed in again: the form is back from the profile, without what the
    // signed-out buyer typed.
    view.rerender(page({ ...APPROVED, onSignIn }));
    expect([field('quote-business'), field('ship-street')]).toEqual(['Alpha Food Mart', '']);
  });

  it('refills for the next buyer, and says when their account can’t order yet (AW-190, AW-048)', () => {
    const view = render(page(APPROVED));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    view.rerender(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    view.rerender(page(PENDING));
    expect(gate().querySelector('h2').textContent).toBe('Your account is being reviewed');
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    // Approved later: the form is B's, never A's.
    view.rerender(page({ profile: { ...B, status: 'approved' }, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone'), field('ship-street')])
      .toEqual(['Bravo Tobacco Outlet', 'Bea Bravo', 'bravo@example.test', '', '']);
  });

  it('blocks the submit until lines that can no longer be ordered are removed (AW-083)', () => {
    const removeLines = vi.fn();
    const gone = { lineKey: '999', productId: 999, variant: null, unavailable: 'product', name: 'Old product', sku: 'AW-OLD', qty: 4, price: null };
    render(page({ items: [...ITEMS, gone], removeLines, ...APPROVED }));
    expect(screen.getByText('1 item in your order is no longer available.')).toBeTruthy();
    // Said under the button it keeps off, as plain text it is described by,
    // not an alert on arrival (NEW-021).
    expect(screen.queryByRole('alert')).toBeNull();
    const note = document.getElementById('quote-blocked-unavailable');
    expect(note.textContent).toBe('Remove the item that is no longer available before you place your order.');
    expect(note.className).toBe('form-error');
    expect(submit().disabled).toBe(true);
    expect(submit().getAttribute('aria-describedby')).toBe('quote-blocked-unavailable');
    // Units count only what can be ordered.
    expect(screen.getByText('Estimated total · 2 units')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable item' }));
    expect(removeLines).toHaveBeenCalledWith(['999']);
  });

  it('blocks a quantity the database would refuse, as a guard (AW-013)', () => {
    render(page({ items: [{ ...ITEMS[0], qty: 150000 }], ...APPROVED }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.getElementById('quote-blocked-qty').textContent).toBe('Quantities must be a whole number from 1 to 100,000.');
    expect(submit().disabled).toBe(true);
    expect(submit().getAttribute('aria-describedby')).toBe('quote-blocked-qty');
  });

  it('sets a line’s quantity and a bare line’s variant on the page (AW-013, AW-011)', () => {
    const setLine = vi.fn();
    const chooseVariant = vi.fn(() => ({ key: '1::red', qty: 12 }));
    const bare = {
      lineKey: '1', productId: 1, variant: null, needsVariant: true, unavailable: null, name: 'Swisher Sweets cigarillos', sku: 'AW-SS', cat: 'TOBACCO', qty: 12, price: null,
      axis: { label: 'Flavor', noun: 'flavor', plural: 'flavors' }, variants: [{ label: 'Red', available: true }],
    };
    render(page({ items: [...ITEMS, bare], setLine, chooseVariant, ...APPROVED }));
    expect(submit().disabled).toBe(true);
    expect(screen.getByText('12 units · choose a flavor')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    expect(setLine).toHaveBeenCalledWith('14', 48);
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose a flavor for Swisher Sweets cigarillos' }), { target: { value: 'Red' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set flavor' }));
    expect(chooseVariant).toHaveBeenCalledWith('1', 'Red');
  });

  it('lists an old cart’s products that need a variant, also when the cart is empty (AW-354)', () => {
    const legacy = [{ productId: 1, qty: 3, name: 'Swisher Sweets cigarillos' }];
    const view = render(page({ items: [], legacy, onDismissLegacy: vi.fn(), ...GUEST }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your order is empty');
    // Centred by a class, so the phone page-head padding applies (AW-301).
    const head = screen.getByRole('heading', { level: 1 }).closest('section');
    expect(head.className).toBe('page-head is-centered');
    // No inline style on it, in it, or on anything the page wraps it in. The
    // document's <html> and <body> are not the page's: a dialog's scroll lock
    // in an earlier test (ModalLayer) leaves style="" on <body>.
    const styled = head.closest('[style]');
    expect(styled && view.container.contains(styled)).toBeFalsy();
    expect(head.querySelector('[style]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Choose a variant for Swisher Sweets cigarillos' })).toBeTruthy();
    view.rerender(page({ legacy, onDismissLegacy: vi.fn(), ...GUEST }));
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
    render(page({ ...APPROVED, checkCart }));
    fill();
    submitForm();
    const button = document.querySelector('button[type="submit"]');
    expect(button.textContent).toMatch(/Checking the catalog…/);
    expect(button.disabled).toBe(true);
    await act(async () => { finish({ ok: true, items: ITEMS }); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(checkCart).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([ITEMS]);
    // The thank-you message (the receipt, AW-022) is styled by classes, not
    // inline styles (AW-301).
    const head = screen.getByRole('heading', { level: 1 }).closest('section');
    expect(head.className).toBe('page-head receipt-head');
    // (scrollToTop briefly styles <html>, so only the section itself counts.)
    expect(head.hasAttribute('style') || head.querySelector('[style]')).toBeFalsy();
  });

  it('names a line that is no longer available and sends nothing', async () => {
    sent.length = 0;
    const gone = { ...ITEMS[0], unavailable: 'product', price: null };
    const checkCart = vi.fn(async () => ({ ok: true, items: [gone] }));
    const view = render(page({ ...APPROVED, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    // App re-renders the page with the catalog it just loaded.
    view.rerender(page({ items: [gone], removeLines: vi.fn(), ...APPROVED, checkCart }));
    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toEqual(['The catalog changed since this page opened, so nothing was sent. Kite cigarette tobacco is no longer available — remove it to continue. Check your items, then place your order again.']);
    // The general line would say the same: it waits until the message goes (NEW-021).
    expect(document.getElementById('quote-blocked-unavailable')).toBeNull();
    expect(submit().hasAttribute('aria-describedby')).toBe(false);
    expect(sent).toEqual([]);
    // Gone once the lines on the page change.
    view.rerender(page({ items: [], ...APPROVED, checkCart }));
    expect(screen.queryByText(/The catalog changed/)).toBeNull();
  });

  it('shows the total the server saved (AW-351)', async () => {
    sent.length = 0;
    submitOrder.mockImplementationOnce(async () => ({ ok: true, order: { id: 'o2', ref_num: 'ALW-O-TEST000002', kind: 'order', subtotal: 1234.5, total_units: 7 } }));
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ ...APPROVED, pricesStatus: 'ready', checkCart }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.getByText('Saved total: $1,234.50 · 7 units')).toBeTruthy();
    expect(screen.getByText('ALW-O-TEST000002')).toBeTruthy();
    expect(screen.getByText('ORDER RECEIVED')).toBeTruthy();
  });

  it('shows no saved total when nothing was priced', async () => {
    sent.length = 0;
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ ...APPROVED, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.queryByText(/Saved total/)).toBeNull();
  });

  it('sends nothing when the catalog can’t be checked', async () => {
    sent.length = 0;
    const checkCart = vi.fn(async () => ({ ok: false, error: { kind: 'network' } }));
    render(page({ ...APPROVED, checkCart }));
    fill();
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t check the latest prices and availability, so nothing was sent\./);
    expect(screen.getByRole('alert').textContent).toMatch(/call the trade desk at/);
    expect(screen.getByRole('alert').textContent).not.toMatch(/ALW-|reference/);
    expect(sent).toEqual([]);
    expect(submit().disabled).toBe(false);
  });
});

// PR #12's guest licence fields (a licence number, a resale certificate and
// a 21+ attestation for tobacco and vape lines) went with guest orders
// (AW-014): approved accounts gave theirs when they applied.
describe('QuotePage asks for no licence answers (AW-014)', () => {
  const CIGARETTES = [{ ...ITEMS[0], cat: 'TOBACCO', sub: 'Cigarettes' }];
  const VAPES = [{ ...ITEMS[0], lineKey: '60', productId: 60, cat: 'NOVELTIES', sub: 'Disposable Vapes' }];

  it('sends an approved buyer’s tobacco and vape order without them', async () => {
    forms.length = 0;
    for (const items of [CIGARETTES, VAPES]) {
      const view = render(page({ ...APPROVED, items, checkCart: vi.fn(async () => ({ ok: true, items })) }));
      expect(document.getElementById('quote-license')).toBeNull();
      expect(screen.queryByLabelText(/license #|resale certificate #/i)).toBeNull();
      expect(screen.queryByRole('checkbox')).toBeNull();
      for (const [id, value] of [['ship-street', '1 Alpha Way'], ['ship-city', 'Hoover'], ['ship-state', 'AL'], ['ship-zip', '35216']]) {
        fireEvent.change(document.getElementById(id), { target: { value } });
      }
      await act(async () => { fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]')); });
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
      view.unmount();
    }
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).not.toHaveProperty('licenseNo');
      expect(form).not.toHaveProperty('resaleCert');
      expect(form).not.toHaveProperty('purchasers21');
    }
  });
});

describe('QuotePage totals for an approved buyer', () => {
  it('shows the estimate, or that prices are loading or on request', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 20, pricesStatus: 'ready' }));
    const total = () => document.querySelector('.checkout-total').textContent;
    expect(total()).toBe('Estimated total · 2 units$20.00');
    const unpriced = [{ ...ITEMS[0], price: null }];
    view.rerender(page({ items: unpriced, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 0, pricesStatus: 'loading' }));
    expect(total()).toBe('Estimated total · 2 unitsLoading prices…');
    // No order-minimum notice while the total isn't known.
    expect(screen.queryByText(/The order minimum is/)).toBeNull();
    view.rerender(page({ items: unpriced, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, total: 0, pricesStatus: 'ready' }));
    expect(total()).toBe('Estimated total · 2 unitsPrice on request');
  });

  it('says when lines waiting for a variant are left out of the subtotal (AW-103)', () => {
    const bare = { lineKey: '11', productId: 11, variant: null, needsVariant: true, name: 'Backwoods cigars 5-pack', sku: 'AW-BACKWOODS-5PK', cat: 'TOBACCO', qty: 8, price: 10.55, variants: [] };
    const view = render(page({ items: [bare, ...ITEMS], total: 20, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready' }));
    expect(document.querySelector('.checkout-total').textContent).toBe('Estimated total · 10 units$20.00');
    expect(document.querySelector('.checkout-total + .total-note').textContent).toBe('1 line needs a variant and isn’t in this total.');
    expect(document.querySelectorAll('.checkout-lines .line-total')).toHaveLength(1);
    // Guests see no prices and no form, so no total either (AW-014).
    view.rerender(page({ items: [bare, ...ITEMS], total: 0, ...GUEST }));
    expect(document.querySelector('.checkout-total')).toBeNull();
    expect(document.querySelector('.total-note')).toBeNull();
  });

  it('says a price-on-request line is left out too, and shows a dash when no line counts (NEW-063)', () => {
    const gushers = { lineKey: '187::regular', productId: 187, variant: 'Regular', name: 'Gushers box — Regular', sku: 'AW-GUSHER-BOX-REGULAR', cat: 'CANDIES', qty: 1, price: null };
    const view = render(page({ items: [gushers, ...ITEMS], total: 20, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready' }));
    expect(document.querySelector('.checkout-total').textContent).toBe('Estimated total · 3 units$20.00');
    expect(document.querySelector('.checkout-total + .total-note').textContent).toBe('1 line is priced by the trade desk and isn’t in this total.');
    // Only a line waiting for its variant: no "$0.00".
    const bare = { lineKey: '22', productId: 22, variant: null, needsVariant: true, name: 'Tweaker energy shots', sku: 'AW-TWEAKER', cat: 'MERCHANDISE', qty: 2, price: 11.5, variants: [] };
    view.rerender(page({ items: [bare], total: 0, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready' }));
    expect(document.querySelector('.checkout-total').textContent).toBe('Estimated total · 2 units—');
    expect(document.querySelector('.total-note').textContent).toBe('1 line needs a variant and isn’t in this total.');
  });

  it('says why the submit is off as text the button is described by, not as an alert on arrival (NEW-021)', () => {
    const bare = { lineKey: '22', productId: 22, variant: null, needsVariant: true, name: 'Tweaker energy shots', sku: 'AW-TWEAKER', cat: 'MERCHANDISE', qty: 2, price: null, variants: [] };
    const gone = { lineKey: '999', productId: 999, variant: null, unavailable: 'product', name: 'Old product', sku: 'AW-OLD', qty: 1, price: null };
    const gone2 = { ...gone, lineKey: '998', productId: 998 };
    render(page({ items: [bare, gone, gone2, ...ITEMS], profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submit().getAttribute('aria-describedby')).toBe('quote-blocked-variant quote-blocked-unavailable');
    expect(document.getElementById('quote-blocked-variant').textContent).toBe('Choose a variant for every product that has more than one.');
    expect(document.getElementById('quote-blocked-unavailable').textContent).toBe('Remove the items that are no longer available before you place your order.');
    expect(screen.getByRole('button', { name: 'Remove unavailable items' })).toBeTruthy();
  });
});

// The $500 minimum isn't enforced (AW-076, owner question). The page states
// it once, as $500 (AW-283, NEW-059): in the intro, or, while an approved
// buyer's meter asks for the rest of it, in the meter alone, which adds "You
// can still submit this order." only while the submit button can be used
// (Cursor's PR #13).
describe('QuotePage minimum (AW-076, AW-283, NEW-059, NEW-010)', () => {
  const intro = () => document.querySelector('.page-head > p:not([class])').textContent;
  const meter = () => document.querySelector('.cart-meter-text')?.textContent ?? null;
  const allowed = () => screen.queryByText(/You can still submit this order\./);
  // The minimum as a threshold: '$500', not an amount such as a $500.00 total.
  const mentions = () => (document.body.textContent.match(/\$500(?![.,]?\d)/g) || []).length;
  const buyer = { profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready', total: 20 };

  it('says it once, in the meter, with "You can still submit" only when the order can be submitted', () => {
    const view = render(page(buyer));
    expect(meter()).toBe('Add $480.00 to reach the $500 order minimum. You can still submit this order.');
    expect(intro()).toBe('Review your items, then place your order. The trade desk confirms pricing, availability and delivery, then prepares your order.');
    expect(mentions()).toBe(1);
    expect(document.querySelector('p.notice')).toBeNull();
    expect(submit().disabled).toBe(false);
    // A line still needs a variant: no meter (its price isn't known), so the
    // intro says the minimum, and nothing says "you can still submit".
    view.rerender(page({ ...buyer, items: [{ ...ITEMS[0], needsVariant: true }] }));
    expect(submit().disabled).toBe(true);
    expect(allowed()).toBeNull();
    expect(intro()).toMatch(/The minimum order is \$500\./);
    expect(mentions()).toBe(1);
    // A line that can no longer be ordered, beside one that can: the meter
    // stays, the button is off.
    const gone = { ...ITEMS[0], lineKey: '999', productId: 999, unavailable: 'product' };
    view.rerender(page({ ...buyer, items: [...ITEMS, gone] }));
    expect(meter()).toBe('Add $480.00 to reach the $500 order minimum.');
    expect(mentions()).toBe(1);
    // Orders can't be placed online (no backend): no form, so no meter; the
    // intro says the minimum.
    view.rerender(page({ ...buyer, isBackendConfigured: false }));
    expect(meter()).toBeNull();
    expect(intro()).toBe('Review your items. The minimum order is $500.');
    expect(mentions()).toBe(1);
    // At the minimum, the meter moves on and the intro says it.
    view.rerender(page({ ...buyer, total: 500 }));
    expect(allowed()).toBeNull();
    expect(meter()).toBe('Add $1,000.00 for free delivery on a delivery route.');
    expect(intro()).toMatch(/The minimum order is \$500\./);
    expect(mentions()).toBe(1);
  });

  // NEW-010: a total without every line's price is not measured.
  it('says nothing about reaching the minimum when prices failed or a line has no price', () => {
    const view = render(page({ ...buyer, items: [{ ...ITEMS[0], price: null }], total: 0, pricesStatus: 'error' }));
    expect(allowed()).toBeNull();
    expect(meter()).toBeNull();
    expect(screen.queryByText(/to reach the \$500 order minimum/)).toBeNull();
    expect(document.querySelector('.cart-summary-note').textContent).toBe('The minimum and free delivery are worked out once every line has a price.');
    expect(intro()).toMatch(/The minimum order is \$500\./);
    expect(mentions()).toBe(1);
    // Price on request, with the prices in.
    const onRequest = { lineKey: '187::regular', productId: 187, variant: 'Regular', name: 'Gushers box — Regular', sku: 'AW-GUSHER', cat: 'CANDIES', qty: 1, price: null };
    view.rerender(page({ ...buyer, items: [onRequest, ...ITEMS], total: 20 }));
    expect(allowed()).toBeNull();
    expect(meter()).toBeNull();
    expect(mentions()).toBe(1);
    // While prices load.
    view.rerender(page({ ...buyer, pricesStatus: 'loading' }));
    expect(allowed()).toBeNull();
    expect(meter()).toBeNull();
  });

  it('prints the minimum once, as $500, and the free-delivery amount from content.js', () => {
    const fine = () => [...document.querySelectorAll('.fine')].filter((el) => /^Orders over/.test(el.textContent));
    const view = render(page(GUEST));
    expect(intro()).toBe('Review your items. The minimum order is $500.');
    expect(fine()).toHaveLength(1);
    expect(fine()[0].textContent).toMatch(/^Orders over \$1,500 qualify for free delivery/);
    expect(mentions()).toBe(1);
    expect(document.body.textContent).not.toMatch(/\$500\.00/);
    view.rerender(page({ ...buyer, total: 500 }));
    expect(intro()).toBe('Review your items, then place your order. The minimum order is $500. The trade desk confirms pricing, availability and delivery, then prepares your order.');
    expect(fine()).toHaveLength(1);
    expect(fine()[0].closest('form')).toBeTruthy();
  });
});

// The buyer's prices didn't load (NEW-010): a way to load them again by the
// total, and a submit that can't re-check them says that, not "check your
// connection".
describe('QuotePage when the buyer’s prices didn’t load (NEW-010)', () => {
  const failed = { profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, items: [{ ...ITEMS[0], price: null }], total: 0, pricesStatus: 'error' };
  const reload = () => screen.queryByRole('button', { name: /Load prices again|Loading prices…/ });

  it('offers “Load prices again” by the total, and gives the total focus once they are in', () => {
    const onRetryPrices = vi.fn();
    const view = render(page({ ...failed, onRetryPrices }));
    expect(document.querySelector('.checkout-total').textContent).toBe('Estimated total · 2 unitsPrices didn’t load');
    const button = reload();
    expect(button.textContent).toBe('Load prices again');
    expect(button.closest('.prices-retry').previousElementSibling.classList.contains('checkout-total')).toBe(true);
    button.focus();
    fireEvent.click(button);
    expect(onRetryPrices).toHaveBeenCalledTimes(1);
    // While they load it says so, stays focusable, and a second click does nothing.
    view.rerender(page({ ...failed, onRetryPrices, pricesRefreshing: true }));
    expect(reload().textContent).toBe('Loading prices…');
    expect(reload().getAttribute('aria-disabled')).toBe('true');
    expect(reload().disabled).toBe(false);
    fireEvent.click(reload());
    expect(onRetryPrices).toHaveBeenCalledTimes(1);
    // In: the button goes, and the total takes focus.
    view.rerender(page({ ...failed, items: ITEMS, total: 20, pricesStatus: 'ready', onRetryPrices }));
    expect(reload()).toBeNull();
    expect(document.activeElement).toBe(document.getElementById('checkout-total'));
    expect(document.activeElement.textContent).toBe('Estimated total · 2 units$20.00');
  });

  it('keeps the button when they fail again, and shows none to guests or once they load', () => {
    const onRetryPrices = vi.fn();
    const view = render(page({ ...failed, onRetryPrices }));
    reload().focus();
    fireEvent.click(reload());
    view.rerender(page({ ...failed, onRetryPrices, pricesRefreshing: true }));
    view.rerender(page({ ...failed, onRetryPrices }));
    expect(document.activeElement).toBe(reload());
    view.rerender(page({ ...failed, pricesStatus: 'ready', onRetryPrices }));
    expect(reload()).toBeNull();
    view.rerender(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false, pricesStatus: 'off', onRetryPrices }));
    expect(reload()).toBeNull();
  });

  it('says the prices didn’t load, not “check your connection”, when only they fail on submit', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const before = vi.mocked(submitOrder).mock.calls.length;
    const view = render(page({ ...failed, items: ITEMS, total: 20, pricesStatus: 'ready', checkCart: vi.fn(async () => ({ ok: false, part: 'prices', error: { message: 'x' } })) }));
    for (const [id, value] of [['ship-street', '1 Alpha Way'], ['ship-city', 'Hoover'], ['ship-state', 'AL'], ['ship-zip', '35216']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
    await act(async () => { fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]')); });
    expect(screen.getByRole('alert').textContent).toMatch(/^Your prices didn’t load, so nothing was sent\. Try again, or call the trade desk at \(205\) 458-4788 or email .+\.$/);
    view.unmount();
    render(page({ ...failed, items: ITEMS, total: 20, pricesStatus: 'ready', checkCart: vi.fn(async () => ({ ok: false, part: 'catalog', error: { message: 'x' } })) }));
    for (const [id, value] of [['ship-street', '1 Alpha Way'], ['ship-city', 'Hoover'], ['ship-state', 'AL'], ['ship-zip', '35216']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
    await act(async () => { fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]')); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t check the latest prices and availability, so nothing was sent\. Check your connection/);
    expect(vi.mocked(submitOrder).mock.calls.length).toBe(before);
    vi.restoreAllMocks();
  });
});

// submit_quote on the page (AW-049, AW-079, AW-198).
describe('QuotePage and submit_quote', () => {
  const fillContact = () => {
    for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'], ['quote-phone', '205-000-0000']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  const fillAddress = () => {
    for (const [id, value] of [['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));
  const checkCart = () => vi.fn(async () => ({ ok: true, items: ITEMS }));

  it('shows the reference the server made, and no reference before (AW-049)', async () => {
    calls.length = 0;
    render(page({ ...APPROVED, checkCart: checkCart() }));
    expect(document.body.textContent).not.toMatch(/ALW-/);
    fillContact();
    fillAddress();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.getByText('ALW-O-TEST000001')).toBeTruthy();
    expect(calls[0]).not.toHaveProperty('refNum');
  });

  it('says what the server refused, marks the field, and cites no reference (AW-198, AW-200)', async () => {
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(new Error('Enter a valid ZIP code'), { code: 'P0001', hint: 'invalid_zip' }); });
    render(page({ ...APPROVED, checkCart: checkCart() }));
    fillContact();
    fillAddress();
    await act(async () => { submitForm(); });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Enter a 5-digit ZIP code (or ZIP+4).');
    const zip = document.getElementById('ship-zip');
    expect(zip.getAttribute('aria-invalid')).toBe('true');
    expect(zip.getAttribute('aria-describedby')).toBe('quote-submit-error');
    expect(alert.id).toBe('quote-submit-error');
    // Editing the field clears the mark.
    fireEvent.change(zip, { target: { value: '35204' } });
    expect(zip.hasAttribute('aria-invalid')).toBe(false);

    submitOrder.mockImplementationOnce(async () => { throw new Error('boom'); });
    await act(async () => { submitForm(); });
    expect((await screen.findByRole('alert')).textContent).toMatch(/^We couldn’t place this order\. Please call the trade desk at \(205\)/);
    expect(document.querySelector('.form-error').textContent).not.toMatch(/ALW-|reference/);
  });

  it('says so when the server no longer sees the account as signed in or approved (20261014111000)', async () => {
    render(page({ ...APPROVED, checkCart: checkCart() }));
    fillAddress();
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(new Error('Sign in to place an order'), { code: 'P0001', hint: 'sign_in_required' }); });
    await act(async () => { submitForm(); });
    expect((await screen.findByRole('alert')).textContent).toBe('You’re signed out, so this order wasn’t sent. Sign in, then place it again.');
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(new Error('x'), { code: 'P0001', hint: 'account_not_approved' }); });
    await act(async () => { submitForm(); });
    expect((await screen.findByRole('alert')).textContent).toBe('Your account is being reviewed, so this order wasn’t sent. You can place orders once it’s approved.');
    expect(screen.queryByRole('heading', { level: 1, name: /Thank you/ })).toBeNull();
  });

  it('puts the delivery method first and hides the address for will-call (AW-079)', async () => {
    calls.length = 0;
    render(page({ ...APPROVED, checkCart: checkCart() }));
    const labels = [...document.querySelectorAll('.checkout-form-grid label')].map((l) => l.htmlFor);
    expect(labels.indexOf('quote-delivery')).toBeLessThan(labels.indexOf('ship-street'));
    fillContact();
    fillAddress();
    const delivery = screen.getByLabelText('Delivery method');
    fireEvent.change(delivery, { target: { value: 'willcall' } });
    for (const id of ['ship-street', 'ship-city', 'ship-state', 'ship-zip']) expect(document.getElementById(id)).toBeNull();
    const pickup = document.getElementById('quote-pickup');
    expect(pickup.textContent).toBe(`Pickup at ${COMPANY.addressShort} during business hours.`);
    expect(delivery.getAttribute('aria-describedby')).toBe('quote-pickup');
    // What was typed comes back with delivery.
    fireEvent.change(delivery, { target: { value: 'delivery' } });
    expect(document.getElementById('ship-street').value).toBe('1 Test Way');
    expect(document.getElementById('ship-street').required).toBe(true);
    fireEvent.change(delivery, { target: { value: 'willcall' } });
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(calls[0].formData.delivery).toBe('willcall');
  });

  it('carries the server’s limits on the fields (AW-198)', () => {
    render(page(APPROVED));
    const attr = (id, name) => document.getElementById(id).getAttribute(name);
    expect(['quote-business', 'quote-contact', 'quote-email', 'quote-phone', 'ship-street', 'ship-city', 'quote-notes'].map((id) => attr(id, 'maxlength')))
      .toEqual(['200', '120', '254', '40', '200', '100', '2000']);
    // The State is a list of the route states' 2-letter codes (AW-078).
    expect([...document.getElementById('ship-state').options].map((o) => o.value)).toEqual(['', 'AL', 'GA', 'MS']);
    expect(attr('ship-zip', 'pattern')).toBe('[0-9]{5}(-[0-9]{4})?');
    expect(attr('quote-date', 'min')).toBe(todayInBirmingham());
  });

  it('sends nothing when the honeypot is filled, and says what a failed save says (AW-198)', async () => {
    calls.length = 0;
    const check = checkCart();
    render(page({ ...APPROVED, checkCart: check }));
    const trap = document.getElementById('quote-company-website');
    expect(trap.tabIndex).toBe(-1);
    expect(trap.getAttribute('autocomplete')).toBe('off');
    expect(trap.closest('[aria-hidden="true"]').classList.contains('sr-only')).toBe(true);
    fillContact();
    fillAddress();
    fireEvent.change(trap, { target: { value: 'https://spam.example' } });
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t place this order\. Please call the trade desk at/);
    expect(calls).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });
});

// Removing lines and clearing the cart (AW-042): announced, and focus moves
// to a neighbour line or to the empty page's heading, never to <body>.
describe('QuotePage removals', () => {
  const LINES = [
    ITEMS[0],
    { lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO-CORN-STARCH', cat: 'FOOD STUFF', qty: 1, price: 10 },
  ];
  function Checkout(props) {
    const [items, setItems] = useState(LINES);
    return (
      <main id="main">
        {page({
          items, total: 0, removeLine: (key) => setItems((list) => list.filter((it) => it.lineKey !== key)), clearCart: () => setItems([]), ...props,
        })}
      </main>
    );
  }
  const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text);
  const removeButton = (name) => screen.getByRole('button', { name: `Remove ${name}` });

  afterEach(() => vi.mocked(announce).mockClear());

  it('focuses the next line’s quantity after ×, then the empty page’s heading', async () => {
    render(<Checkout />);
    removeButton('Kite cigarette tobacco').focus();
    fireEvent.click(removeButton('Kite cigarette tobacco'));
    expect(announced()).toEqual(['Removed Kite cigarette tobacco.']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quantity of Argo corn starch' })));
    fireEvent.click(removeButton('Argo corn starch'));
    expect(announced().at(-1)).toBe('Removed Argo corn starch.');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Your order is empty' }));
  });

  it('says every item went with "Clear all items", and focuses the empty page’s heading', () => {
    render(<Checkout />);
    const clear = screen.getByRole('button', { name: 'Clear all items' });
    clear.focus();
    fireEvent.click(clear);
    expect(announced()).toEqual(['Removed all items from your order.']);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Your order is empty' }));
    expect(document.activeElement).not.toBe(document.body);
  });

  it('says "order" to an approved buyer too', () => {
    render(<Checkout profile={A} isApprovedBuyer />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    expect(announced()).toEqual(['Removed all items from your order.']);
  });
});

// After the save (AW-012, AW-022, AW-108): one send at a time, only the lines
// that were sent leave the cart, and the receipt shows what was sent. App
// keeps the receipt for the history entry and passes it back as savedReceipt.
describe('QuotePage receipt', () => {
  const CORN = { lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO-CORN-STARCH', cat: 'FOOD STUFF', qty: 3, price: 10, sellUnit: 'case of 24' };
  const LINES = [ITEMS[0], CORN];
  const fillAll = () => {
    for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-000-0000'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203'],
      ['quote-date', '2030-01-15'], ['quote-notes', 'Back door, before 10']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  // An approved account's contact details come from its profile; the ship-to
  // address is typed (the form checks every required field, AW-173).
  const fillShipTo = () => {
    for (const [id, value] of [['ship-street', '1 Alpha Way'], ['ship-city', 'Hoover'], ['ship-state', 'AL'], ['ship-zip', '35216']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));
  const heading = () => screen.getByRole('heading', { level: 1 });
  const receiptText = () => document.querySelector('.receipt-head').textContent;
  const sentCount = () => vi.mocked(submitOrder).mock.calls.length;
  const SAVED = {
    ref: 'ALW-Q-SAVED00001', kind: 'quote', totalUnits: 2, subtotal: null, pricedLines: null, unpricedLines: null,
    lines: [{ lineKey: '14', name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, sellUnit: '' }],
    delivery: 'willcall', ship: null, preferredDate: '', notes: '', contact: 'Saved Buyer', business: 'Saved Market', reachAt: '205-000-0009', savedAt: 1,
  };

  it('removes exactly the lines that were sent and hands App the receipt, even when a line was added meanwhile (AW-012, AW-046)', async () => {
    const removeLines = vi.fn();
    const clearCart = vi.fn();
    const onSubmitted = vi.fn();
    let answer;
    submitOrder.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const checkCart = vi.fn(async () => ({ ok: true, items: LINES }));
    const props = { ...APPROVED, items: LINES, removeLines, clearCart, onSubmitted, checkCart, entryKey: 'k1' };
    const view = render(page(props));
    fillAll();
    await act(async () => { submitForm(); });
    expect(answer).toBeTypeOf('function');
    // Another tab adds a line while the order is on its way, and the buyer edits a field.
    const added = { lineKey: '200', productId: 200, variant: null, name: 'Chocolate bar', sku: 'AW-CHOC', cat: 'CANDIES', qty: 1, price: null };
    view.rerender(page({ ...props, items: [...LINES, added] }));
    fireEvent.change(document.getElementById('quote-contact'), { target: { value: 'Edited While Sending' } });
    await act(async () => { answer({ ok: true, order: { id: 'o9', ref_num: 'ALW-O-TEST000009', kind: 'order', total_units: 5, subtotal: null, priced_lines: 0, unpriced_lines: 2 } }); });
    await waitFor(() => expect(heading().textContent).toBe('Thank you, Test Buyer.'));
    expect(removeLines).toHaveBeenCalledTimes(1);
    expect(removeLines).toHaveBeenCalledWith(['14', '45']);
    expect(clearCart).not.toHaveBeenCalled();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    const receipt = onSubmitted.mock.calls[0][0];
    expect(receipt).toMatchObject({
      ref: 'ALW-O-TEST000009', kind: 'order', totalUnits: 5, subtotal: null, pricedLines: 0, unpricedLines: 2,
      lines: [
        { lineKey: '14', name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, sellUnit: '' },
        { lineKey: '45', name: 'Argo corn starch', sku: 'AW-ARGO-CORN-STARCH', qty: 3, sellUnit: 'case of 24' },
      ],
      delivery: 'delivery', ship: { street: '1 Test Way', city: 'Birmingham', state: 'AL', zip: '35203' },
      preferredDate: '2030-01-15', notes: 'Back door, before 10', contact: 'Test Buyer', business: 'Test Market', reachAt: '205-000-0000',
    });
    expect(receipt.savedAt).toBeTypeOf('number');
  });

  it('lists the lines, the delivery method, the ship-to address, the date and the notes, with no inline styles (AW-022, AW-108)', async () => {
    render(page({ ...APPROVED, items: LINES, checkCart: vi.fn(async () => ({ ok: true, items: LINES })) }));
    fillAll();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(heading().textContent).toMatch(/^Thank you/));
    expect(screen.getByText('ORDER RECEIVED')).toBeTruthy();
    expect(screen.getByText('ALW-O-TEST000001')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Items in your order' })).toBeTruthy();
    expect([...document.querySelectorAll('.receipt-items li')].map((li) => li.textContent)).toEqual([
      '2 × Kite cigarette tobacco (AW-KITE)',
      '3 × Argo corn starch (AW-ARGO-CORN-STARCH · sold by the case of 24)',
    ]);
    const details = Object.fromEntries([...document.querySelectorAll('.receipt-details > div')].map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
    // When it was sent comes first, on the warehouse's clock (NEW-062).
    expect(details).toEqual({
      Sent: expect.stringMatching(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M CT$/),
      Business: 'Test Market',
      'Delivery method': 'Next-day delivery (on route)',
      'Ship to': '1 Test WayBirmingham, AL 35203',
      'Preferred date': 'Tuesday, January 15, 2030',
      Notes: 'Back door, before 10',
    });
    // The phone as typed (205-000-0000), written the usual way (NEW-062).
    expect(receiptText()).toMatch(/Your order has been placed, and our team will prepare it\. A trade desk rep will reach out at \(205\) 000-0000 to confirm details\./);
    expect(receiptText()).not.toMatch(/quote/i);
    // AW-108: centred by class, never by inline style.
    const section = document.querySelector('section.page-head.receipt-head');
    expect(section.hasAttribute('style')).toBe(false);
    expect(section.querySelectorAll('[style]')).toHaveLength(0);
    // Nothing on the receipt sends again; the order is in the account's history.
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'View order history' }).getAttribute('href')).toBe('/account');
    expect(screen.getByRole('link', { name: 'Continue shopping' }).getAttribute('href')).toBe('/catalog');
    expect(screen.getByRole('button', { name: 'Print' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Call to discuss' }).getAttribute('href')).toBe(`tel:${COMPANY.phoneRaw}`);
    // The old "Back to home" (which emptied the cart) is gone.
    expect(screen.queryByRole('link', { name: 'Back to home' })).toBeNull();
  });

  it('says will-call and where to pick up, with no ship-to', async () => {
    render(page({ ...APPROVED, items: [CORN], checkCart: vi.fn(async () => ({ ok: true, items: [CORN] })) }));
    fireEvent.change(screen.getByLabelText('Delivery method'), { target: { value: 'willcall' } });
    await act(async () => { submitForm(); });
    await waitFor(() => expect(heading().textContent).toBe('Thank you, Alice Alpha.'));
    const details = Object.fromEntries([...document.querySelectorAll('.receipt-details > div')].map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
    expect(details).toEqual({
      Sent: expect.stringMatching(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s[AP]M CT$/),
      Business: 'Alpha Food Mart',
      'Delivery method': 'Will-call pickup',
      'Pickup at': '613 Graymont Ave N, Birmingham, AL 35203, during business hours',
    });
    // A signed-in buyer can find it again in the order history.
    expect(screen.getByRole('link', { name: 'View order history' }).getAttribute('href')).toBe('/account');
  });

  it('moves focus to the receipt’s heading', async () => {
    render(<main id="main">{page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) })}</main>);
    fillShipTo();
    submit().focus();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(heading().getAttribute('tabindex')).toBe('-1');
    expect(heading().textContent).toMatch(/Thank you/);
  });

  it('sends once when submit fires twice in a row (AW-012)', async () => {
    const before = sentCount();
    let finish;
    const checkCart = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    render(page({ ...APPROVED, checkCart }));
    fillShipTo();
    fireEvent.change(document.getElementById('ship-city'), { target: { value: 'Hoover' } });
    act(() => {
      submitForm();
      submitForm();
    });
    submitForm();
    await act(async () => { finish({ ok: true, items: ITEMS }); });
    await waitFor(() => expect(heading().textContent).toMatch(/Thank you/));
    expect(checkCart).toHaveBeenCalledTimes(1);
    expect(sentCount() - before).toBe(1);
  });

  it('allows another send after a failed one', async () => {
    const before = sentCount();
    submitOrder.mockImplementationOnce(async () => { throw new Error('boom'); });
    render(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fillShipTo();
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t place this order/);
    await act(async () => { submitForm(); });
    await waitFor(() => expect(heading().textContent).toMatch(/Thank you/));
    expect(sentCount() - before).toBe(2);
  });

  it('says ORDER RECEIVED whatever the database calls it (AW-024)', async () => {
    // The default answer has no kind, priced_lines or unpriced_lines (older signatures).
    const view = render(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fillShipTo();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByText('ORDER RECEIVED')).toBeTruthy());
    expect(screen.getByText('Items in your order')).toBeTruthy();
    view.unmount();
    // A database that saved it as a quote (an account it doesn't see as approved).
    submitOrder.mockImplementationOnce(async () => ({ ok: true, order: { id: 'o3', ref_num: 'ALW-Q-TEST000003', kind: 'quote', total_units: 2, subtotal: null } }));
    cleanupAndRender(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fillShipTo();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByText('ORDER RECEIVED')).toBeTruthy());
    expect(document.body.textContent).not.toMatch(/QUOTE|quote request/i);
  });

  it('says how many lines the trade desk prices beside a partial total', async () => {
    submitOrder.mockImplementationOnce(async () => ({ ok: true, order: { id: 'o4', ref_num: 'ALW-O-TEST000004', kind: 'order', total_units: 5, subtotal: 30, priced_lines: 1, unpriced_lines: 1 } }));
    render(page({ ...APPROVED, items: LINES, checkCart: vi.fn(async () => ({ ok: true, items: LINES })) }));
    fillShipTo();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByText('Saved total: $30.00 · 5 units')).toBeTruthy());
    expect(screen.getByText('1 line is priced by the trade desk.')).toBeTruthy();
  });

  it('shows the receipt App kept for this history entry, before the empty cart, and checkout on another entry', () => {
    const view = render(page({ ...GUEST, items: [], savedReceipt: SAVED, entryKey: 'k1' }));
    expect(heading().textContent).toBe('Thank you, Saved Buyer.');
    expect(screen.getByText('ALW-Q-SAVED00001')).toBeTruthy();
    expect(screen.getByText('ORDER RECEIVED')).toBeTruthy();
    expect(screen.queryByText('Your order is empty')).toBeNull();
    expect(screen.queryByRole('button', { name: /Place order/ })).toBeNull();
    // A fresh visit to /checkout (another entry): no saved receipt, so the empty cart.
    view.rerender(page({ ...GUEST, items: [], savedReceipt: null, entryKey: 'k2' }));
    expect(heading().textContent).toBe('Your order is empty');
  });

  it('forgets a receipt it showed when the history entry changes', async () => {
    const props = { ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })), entryKey: 'k1' };
    const view = render(page(props));
    fillShipTo();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(heading().textContent).toMatch(/Thank you/));
    view.rerender(page({ ...props, items: [], entryKey: 'k2' }));
    expect(heading().textContent).toBe('Your order is empty');
  });

  // NEW-062: a receipt kept from before (sessionStorage) benefits too; an
  // email or a receipt without a time stays as it is.
  it('writes the phone the usual way, keeps the notes’ lines and gives the time it was sent, also for a kept receipt', () => {
    const typed = { ...SAVED, reachAt: '2055550123', notes: 'Line one\nLine two of the notes', savedAt: Date.UTC(2026, 9, 9, 20, 45) };
    const view = render(page({ ...GUEST, items: [], savedReceipt: typed, entryKey: 'k1' }));
    expect(document.querySelector('.receipt-head > p:not([class]) strong').textContent).toBe('(205) 555-0123');
    const row = (name) => [...document.querySelectorAll('.receipt-details > div')].find((div) => div.querySelector('dt').textContent === name);
    expect(row('Notes').querySelector('dd').textContent).toBe('Line one\nLine two of the notes');
    expect(row('Notes').classList.contains('receipt-wide')).toBe(true);
    expect(row('Sent').querySelector('dd').textContent.replace(/\s/g, ' ')).toBe('Oct 9, 2026, 3:45 PM CT');
    view.rerender(page({ ...GUEST, items: [], savedReceipt: { ...typed, reachAt: 'buyer@example.test', savedAt: undefined }, entryKey: 'k1' }));
    expect(document.querySelector('.receipt-head > p:not([class]) strong').textContent).toBe('buyer@example.test');
    expect(row('Sent')).toBeUndefined();
  });

  it('copies the reference where the browser allows it, and says so once', async () => {
    const view = render(page({ ...GUEST, items: [], savedReceipt: SAVED, entryKey: 'k1' }));
    // jsdom has no clipboard: no button.
    expect(screen.queryByRole('button', { name: 'Copy reference number' })).toBeNull();
    view.unmount();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      render(page({ ...GUEST, items: [], savedReceipt: SAVED, entryKey: 'k1' }));
      vi.mocked(announce).mockClear();
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy reference number' })); });
      expect(writeText).toHaveBeenCalledWith('ALW-Q-SAVED00001');
      expect(vi.mocked(announce).mock.calls).toEqual([['Reference number copied.']]);
    } finally {
      delete window.navigator.clipboard;
    }
  });
});

// The order email (AW-024): once submit_quote has saved the order, checkout
// posts a copy to Netlify Forms for the orders inbox. Never before the save,
// never for a failed one, and never holding up the receipt.
describe('QuotePage order email (AW-024)', () => {
  const UUID = '3f2c9a1e-5b7d-4c11-8e2f-0a1b2c3d4e5f';
  const VARIANT = {
    lineKey: '1::red', productId: 1, variant: 'Red', name: 'Swisher Sweets cigarillos — Red', sku: 'AW-SS-RED', cat: 'TOBACCO', qty: 4, price: 5, sellUnit: 'box of 30',
  };
  const LINES = [ITEMS[0], VARIANT];
  const fill = () => {
    for (const [id, value] of [['ship-street', '1 Alpha Way'], ['ship-city', 'Hoover'], ['ship-state', 'AL'], ['ship-zip', '35216'],
      ['quote-date', '2030-01-15'], ['quote-notes', 'Back door']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };
  const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));
  beforeEach(() => {
    notices.length = 0;
    vi.mocked(sendOrderNotification).mockClear();
  });

  it('posts every field of the saved order once, after the save', async () => {
    let answer;
    submitOrder.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    render(page({ ...APPROVED, items: LINES, checkCart: vi.fn(async () => ({ ok: true, items: LINES })) }));
    fill();
    await act(async () => { submitForm(); });
    // Not before the order is saved.
    expect(sendOrderNotification).not.toHaveBeenCalled();
    await act(async () => { answer({ ok: true, order: { id: UUID, ref_num: 'ALW-O-5E4F3A2B1C', kind: 'order', total_units: 6 } }); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(sendOrderNotification).toHaveBeenCalledTimes(1);
    const fields = notices[0];
    expect(Object.keys(fields)).toEqual([...ORDER_NOTIFICATION_FIELDS]);
    expect(fields).toMatchObject({
      subject: 'New order ALW-O-5E4F3A2B1C from Alpha Food Mart',
      reference: 'ALW-O-5E4F3A2B1C',
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
      notes: 'Back door',
      'admin-link': `${window.location.origin}/admin/orders/${UUID}/print`,
    });
    expect(fields['placed-at']).toMatch(/ CT$/);
  });

  it('posts nothing for an order that wasn’t saved, or a send that was refused', async () => {
    render(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fill();
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(new Error('x'), { code: 'P0001', hint: 'invalid_zip' }); });
    await act(async () => { submitForm(); });
    await screen.findByRole('alert');
    submitOrder.mockImplementationOnce(async () => { throw new Error('boom'); });
    await act(async () => { submitForm(); });
    expect(sendOrderNotification).not.toHaveBeenCalled();
  });

  it('shows the receipt without waiting for the email, also when it never answers or fails', async () => {
    vi.mocked(sendOrderNotification).mockImplementationOnce(() => new Promise(() => {}));
    const view = render(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    view.unmount();
    vi.mocked(sendOrderNotification).mockImplementationOnce(async () => false);
    render(page({ ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: ITEMS })) }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

function cleanupAndRender(ui) {
  cleanup();
  return render(ui);
}
