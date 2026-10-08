// Checkout while the account changes underneath it (AW-186, AW-190, AW-048).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';

// submitOrder is the only way out; record what it is asked to send.
const sent = vi.hoisted(() => []);
const forms = vi.hoisted(() => []);
vi.mock('../lib/orders.js', () => ({
  submitOrder: vi.fn(async ({ refNum, items, formData }) => {
    sent.push(items);
    forms.push(formData);
    return { ok: true, order: { id: 'o1', ref_num: refNum } };
  }),
}));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, unitPrice: 10, lineTotal: 20 }];
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

// A guest or unapproved account quoting tobacco or vape lines gives a
// tobacco licence, a resale certificate and a 21+ attestation (AW-014,
// Cursor's PR #12). Approved buyers are not asked again.
describe('QuotePage and tobacco licences', () => {
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
