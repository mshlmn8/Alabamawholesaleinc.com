// Checkout while the account changes underneath it (AW-186, AW-190, AW-048),
// and against submit_quote v3 (AW-049, AW-079, AW-198, AW-201, AW-014).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';
import { submitOrder, todayInBirmingham } from '../lib/orders.js';
import { COMPANY } from '../data/content.js';

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
    // No kind, like a database without v3: the account decides order or quote.
    return { ok: true, order: { id: 'o1', ref_num: 'ALW-Q-TEST000001' } };
  }),
}));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: 10 }];
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
    submitOrder.mockImplementationOnce(async () => ({ ok: true, order: { id: 'o2', ref_num: 'ALW-O-TEST000002', kind: 'order', subtotal: 1234.5, total_units: 7 } }));
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true, pricesStatus: 'ready', checkCart }));
    fill();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.getByText('Saved total: $1,234.50 · 7 units')).toBeTruthy();
    expect(screen.getByText('ALW-O-TEST000002')).toBeTruthy();
    expect(screen.getByText('ORDER RECEIVED')).toBeTruthy();
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
    expect(screen.getByRole('alert').textContent).toMatch(/call the trade desk at/);
    expect(screen.getByRole('alert').textContent).not.toMatch(/ALW-|reference/);
    expect(sent).toEqual([]);
    expect(submit().disabled).toBe(false);
  });
});

// A guest or unapproved account quoting tobacco or vape lines gives a
// tobacco licence, a resale certificate and a 21+ attestation (AW-014,
// Cursor's PR #12). Approved buyers are not asked again.
describe('QuotePage and tobacco licenses', () => {
  const CIGARETTES = [{ ...ITEMS[0], cat: 'TOBACCO', sub: 'Cigarettes' }];
  const CANDY = [{ lineKey: '200', productId: 200, variant: null, name: 'Chocolate bar', sku: 'AW-CHOC', qty: 1, cat: 'CANDIES', sub: 'Chocolate Bars' }];
  const licence = () => document.getElementById('quote-license');
  const fillAll = () => {
    for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-000-0000'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) {
      fireEvent.change(document.getElementById(id), { target: { value } });
    }
  };

  it('asks a guest with a cigarette line for the licence, resale certificate and 21+, and links to sign-in and apply', async () => {
    forms.length = 0;
    const onSignIn = vi.fn();
    const onApplyClick = vi.fn();
    render(page({ items: CIGARETTES, profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false, onSignIn, onApplyClick }));
    expect(licence().required).toBe(true);
    expect(screen.getByLabelText('Sales-tax / resale certificate #').required).toBe(true);
    const attest = screen.getByRole('checkbox', { name: 'I confirm this business holds a valid tobacco retail license and all purchasers are 21+' });
    expect(attest.required).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Have an account? Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'New? Apply for a trade account' }));
    expect(onSignIn).toHaveBeenCalled();
    expect(onApplyClick).toHaveBeenCalled();

    fillAll();
    fireEvent.change(licence(), { target: { value: 'TL-123' } });
    fireEvent.change(screen.getByLabelText('Sales-tax / resale certificate #'), { target: { value: 'RC-456' } });
    fireEvent.click(attest);
    await act(async () => { fireEvent.submit(licence().closest('form')); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(forms.at(-1)).toMatchObject({ licenseNo: 'TL-123', resaleCert: 'RC-456', purchasers21: true });
  });

  it('asks a pending account too, but not an approved buyer', () => {
    const view = render(page({ items: CIGARETTES, profile: B, account: 'ready', signedIn: true, isApprovedBuyer: false }));
    expect(licence()).not.toBeNull();
    // Signed in: no sign-in or apply links.
    expect(screen.queryByRole('button', { name: 'Have an account? Sign in' })).toBeNull();
    view.rerender(page({ items: CIGARETTES, profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(licence()).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('asks nothing for a cart without tobacco or vape lines, and sends no licence answers', async () => {
    forms.length = 0;
    render(page({ items: CANDY, profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false }));
    expect(licence()).toBeNull();
    fillAll();
    await act(async () => { fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]')); });
    await waitFor(() => expect(forms.length).toBe(1));
    expect(forms[0]).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
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

// submit_quote on the page (AW-049, AW-079, AW-198, AW-201, AW-014).
describe('QuotePage and submit_quote', () => {
  const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
  const PENDING = { profile: { ...B }, account: 'ready', signedIn: true, isApprovedBuyer: false };
  const APPROVED = { profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true };
  const CANDY = [{ lineKey: '40', productId: 40, variant: null, name: 'Test candy', sku: 'AW-CANDY', cat: 'CANDIES', qty: 1, price: null }];
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
    render(page({ ...GUEST, checkCart: checkCart() }));
    expect(document.body.textContent).not.toMatch(/ALW-/);
    fillContact();
    fillAddress();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(screen.getByText('ALW-Q-TEST000001')).toBeTruthy();
    expect(calls[0]).not.toHaveProperty('refNum');
  });

  it('says what the server refused, marks the field, and cites no reference (AW-198, AW-200)', async () => {
    submitOrder.mockImplementationOnce(async () => { throw Object.assign(new Error('Enter a valid ZIP code'), { code: 'P0001', hint: 'invalid_zip' }); });
    render(page({ ...GUEST, checkCart: checkCart() }));
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
    expect((await screen.findByRole('alert')).textContent).toMatch(/^We couldn’t save this quote\. Please call the trade desk at \(205\)/);
    expect(document.querySelector('.form-error').textContent).not.toMatch(/ALW-|reference/);
  });

  it('puts the delivery method first and hides the address for will-call (AW-079)', async () => {
    calls.length = 0;
    render(page({ ...GUEST, checkCart: checkCart() }));
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
    render(page(GUEST));
    const attr = (id, name) => document.getElementById(id).getAttribute(name);
    expect(['quote-business', 'quote-contact', 'quote-email', 'quote-phone', 'ship-street', 'ship-city', 'quote-notes'].map((id) => attr(id, 'maxlength')))
      .toEqual(['200', '120', '254', '40', '200', '100', '2000']);
    expect([attr('ship-state', 'maxlength'), attr('ship-state', 'pattern')]).toEqual(['2', '[A-Za-z]{2}']);
    expect(attr('ship-zip', 'pattern')).toBe('[0-9]{5}(-[0-9]{4})?');
    expect(attr('quote-date', 'min')).toBe(todayInBirmingham());
  });

  it('sends nothing when the honeypot is filled, and says what a failed save says (AW-198)', async () => {
    calls.length = 0;
    const check = checkCart();
    render(page({ ...GUEST, checkCart: check }));
    const trap = document.getElementById('quote-company-website');
    expect(trap.tabIndex).toBe(-1);
    expect(trap.getAttribute('autocomplete')).toBe('off');
    expect(trap.closest('[aria-hidden="true"]').classList.contains('sr-only')).toBe(true);
    fillContact();
    fillAddress();
    fireEvent.change(trap, { target: { value: 'https://spam.example' } });
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t save this quote\. Please call the trade desk at/);
    expect(calls).toEqual([]);
    expect(check).not.toHaveBeenCalled();
  });

  it('tells a suspended account ordering is paused, instead of a submit button (AW-201)', () => {
    const suspended = { ...A, status: 'suspended' };
    const view = render(page({ profile: suspended, account: 'ready', signedIn: true, isApprovedBuyer: false, isSuspended: true }));
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull();
    const paused = document.querySelector('.quote-paused');
    expect(paused.textContent).toMatch(/^Ordering is paused on this account\. Call \(205\) 354-4473 or email/);
    expect(paused.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
    // Not the "send it as a quote instead" warning, nor pricing talk.
    expect(screen.queryByText(/can’t place orders yet/)).toBeNull();
    expect(document.querySelector('.checkout-total').textContent).toBe('2 unitsOrdering paused');
    // No license fields: the account can't submit anyway.
    expect(document.getElementById('quote-license')).toBeNull();
    // An approved buyer suspended mid-checkout gets the same.
    view.rerender(page({ ...APPROVED }));
    view.rerender(page({ profile: suspended, account: 'ready', signedIn: true, isApprovedBuyer: false, isSuspended: true }));
    expect(screen.queryByRole('button', { name: /Submit|Send it as a quote/ })).toBeNull();
    expect(document.querySelector('.quote-paused')).toBeTruthy();
  });

  it('offers guests sign-in and apply links above the form (AW-014)', () => {
    const onSignIn = vi.fn();
    const view = render(page({ ...GUEST, onSignIn }));
    fireEvent.click(screen.getByRole('button', { name: 'Have an account? Sign in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    // Without the apply dialog, the link goes to the apply page.
    expect(screen.getByRole('link', { name: 'New? Apply for a trade account' }).getAttribute('href')).toBe('/apply');
    expect(document.querySelector('.quote-account-links').textContent).toBe('Have an account? Sign in · New? Apply for a trade account');
    view.rerender(page({ ...PENDING }));
    expect(document.querySelector('.quote-account-links')).toBeNull();
  });

  it('asks guests and pending accounts with a tobacco or vape line for the license answers, all required (AW-014)', async () => {
    calls.length = 0;
    const view = render(page({ ...GUEST, checkCart: checkCart() }));
    const license = screen.getByLabelText('State tobacco/retail license #');
    const resale = screen.getByLabelText('Sales-tax / resale certificate #');
    const attest = screen.getByRole('checkbox', { name: 'I confirm this business holds a valid tobacco retail license and all purchasers are 21+' });
    for (const input of [license, resale]) {
      expect(input.required).toBe(true);
      expect(input.getAttribute('autocomplete')).toBe('off');
      expect(input.getAttribute('aria-describedby')).toBe('quote-license-note');
      expect(input.getAttribute('maxlength')).toBe('64');
    }
    expect(attest.required).toBe(true);
    fillContact();
    fillAddress();
    fireEvent.change(license, { target: { value: 'TL-TEST-1' } });
    fireEvent.change(resale, { target: { value: 'RS-TEST-1' } });
    fireEvent.click(attest);
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(calls[0].formData).toMatchObject({ licenseNo: 'TL-TEST-1', resaleCert: 'RS-TEST-1', purchasers21: true });

    view.unmount();
    const pending = render(page({ ...PENDING }));
    expect(screen.getByLabelText('State tobacco/retail license #')).toBeTruthy();
    // A vape line asks too; a kava line in the same department doesn't (PR #12's rule).
    pending.rerender(page({ ...PENDING, items: [{ ...CANDY[0], cat: 'NOVELTIES', sub: 'Disposable Vapes' }] }));
    expect(screen.getByLabelText('State tobacco/retail license #')).toBeTruthy();
    pending.rerender(page({ ...PENDING, items: [{ ...CANDY[0], cat: 'NOVELTIES', sub: 'Kratom & Kava' }] }));
    expect(screen.queryByLabelText('State tobacco/retail license #')).toBeNull();
  });

  it('doesn’t ask approved buyers, or for a cart without restricted lines (AW-014)', async () => {
    calls.length = 0;
    const view = render(page({ ...APPROVED }));
    expect(screen.queryByLabelText(/license #/)).toBeNull();
    view.rerender(page({ ...GUEST, items: CANDY, checkCart: vi.fn(async () => ({ ok: true, items: CANDY })) }));
    expect(screen.queryByLabelText(/license #/)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fillContact();
    fillAddress();
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(calls[0].formData).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
  });
});
