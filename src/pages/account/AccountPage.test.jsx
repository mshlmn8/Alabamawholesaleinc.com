// Account and admin pages while auth loads (AW-186, AW-087), when the
// profile fails (AW-089), and "Sign out of all devices" (AW-337). Signed
// out, My account says what an account gives and offers Sign in and Apply,
// and a link to a section that arrives before the account does opens it
// once the account has loaded (AW-086). Change password and Sign out
// (AW-252). Order history ten at a time, with filters, in the buyer's words
// (AW-104, AW-105).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../../lib/router.js';
import { AuthContext } from '../../lib/auth.jsx';

// No network: order history reads from a fake client.
vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('../admin/fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AccountPage, SIGNED_OUT_TEXT } = await import('./AccountPage.jsx');
const { AdminPage } = await import('../admin/AdminPage.jsx');

beforeEach(() => {
  fake.reset();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  act(() => navigate('/account', { replace: true }));
});
afterEach(() => { delete Element.prototype.scrollIntoView; });

const PROFILE = { id: 'u1', business: 'Test Market LLC', name: 'Test Buyer', email: 'buyer@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };

describe('AccountPage', () => {
  it('says it is loading, not "sign in", while the account loads', () => {
    render(<AccountPage profile={null} account="loading" onSignIn={vi.fn()} onApplyClick={vi.fn()} />);
    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByText(SIGNED_OUT_TEXT)).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign in|Apply/ })).toBeNull();
  });

  it('offers Try again and Sign out when the profile did not load', () => {
    const onRetry = vi.fn();
    const onSignOut = vi.fn();
    render(<AccountPage profile={null} account="no-profile" onRetry={onRetry} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onSignOut).toHaveBeenCalled();
  });

  it('tells a signed-out visitor what an account gives, with Sign in and Apply (AW-086)', () => {
    const onSignIn = vi.fn();
    const onApplyClick = vi.fn();
    render(<AccountPage profile={null} account="signed-out" onSignIn={onSignIn} onApplyClick={onApplyClick} />);
    expect(SIGNED_OUT_TEXT).toBe('A trade account shows your order history, lets you reorder by SKU with Quick Reorder, and shows your wholesale prices once it is approved.');
    expect(screen.getByText(SIGNED_OUT_TEXT).tagName).toBe('P');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply for a trade account' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('keeps one heading element from loading to loaded', () => {
    const view = render(<AccountPage profile={null} account="loading" />);
    const heading = screen.getByRole('heading', { level: 1 });
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(heading.textContent).toBe('Test Market LLC');
  });

  it('shows the account’s status and tier as labels, and no Role to a customer (AW-149)', () => {
    // A pending account's page holds the documents panel, which reads auth.
    const auth = { session: null, loading: false, isBackendConfigured: false };
    const view = render(<AccountPage profile={{ ...PROFILE, status: 'pending', pricing_tier: 'standard' }} account="ready" products={[]} />,
      { wrapper: ({ children }) => <AuthContext.Provider value={auth}>{children}</AuthContext.Provider> });
    const stats = () => [...document.querySelectorAll('.stat-card')].map((card) => [card.querySelector('span').textContent, card.querySelector('b').textContent]);
    expect(stats()).toEqual([['Account status', 'Pending approval'], ['Pricing tier', 'Standard']]);
    view.rerender(<AccountPage profile={{ ...PROFILE, status: 'suspended' }} account="ready" products={[]} />);
    expect(stats()).toEqual([['Account status', 'On hold'], ['Pricing tier', 'Silver']]);
    // Staff see their role.
    view.rerender(<AccountPage profile={{ ...PROFILE, role: 'admin' }} account="ready" products={[]} />);
    expect(stats()).toEqual([['Account status', 'Approved'], ['Pricing tier', 'Silver'], ['Role', 'Admin']]);
  });

  it('offers Change password and Sign out under the email (AW-252)', () => {
    const onSignOut = vi.fn();
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOut={onSignOut} />);
    const email = screen.getByText(PROFILE.email);
    const links = email.nextElementSibling;
    expect(links.className).toBe('dialog-actions compact-actions account-links');
    expect(screen.getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe('/reset-password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect([...links.children].map((el) => el.textContent)).toEqual(['Change password', 'Sign out']);
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOut={onSignOut} signingOut />);
    // It says so while it works, like the header's and the phone menu's (NEW-068).
    const signingOut = within(links).getByRole('button', { name: 'Signing out…' });
    expect(signingOut.disabled).toBe(true);
    // Its words in a span of their own (translate-safe, AW-039).
    expect(signingOut.firstElementChild.tagName).toBe('SPAN');
    expect(signingOut.childNodes).toHaveLength(1);
    expect(within(links).queryByRole('button', { name: 'Sign out' })).toBeNull();
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOut={onSignOut} />);
    expect(within(links).getByRole('button', { name: 'Sign out' }).disabled).toBe(false);
  });

  it('signs out of all devices on request', () => {
    const onSignOutEverywhere = vi.fn();
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOutEverywhere={onSignOutEverywhere} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    expect(onSignOutEverywhere).toHaveBeenCalled();
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} onSignOutEverywhere={onSignOutEverywhere} signingOut />);
    expect(screen.getByRole('button', { name: 'Signing out…' }).disabled).toBe(true);
  });
});

// A guest's Quick Reorder, then sign-in; a reload of /account#documents
// (AW-086).
describe('AccountPage sections a link points at', () => {
  const quickReorder = () => screen.getByRole('heading', { level: 2, name: 'Reorder by SKU' });

  it('brings Quick Reorder into view and focuses its heading once the account has loaded', async () => {
    act(() => navigate('/account#quick-reorder'));
    const view = render(<AccountPage profile={null} account="loading" />);
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(document.activeElement).toBe(quickReorder()));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // Once: later updates leave focus where the buyer puts it.
    act(() => document.body.focus());
    quickReorder().blur();
    view.rerender(<AccountPage profile={{ ...PROFILE }} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
  });

  it('waits for a dialog over the page to close, so it lands after the dialog hands focus back', async () => {
    act(() => navigate('/account#quick-reorder'));
    const cover = document.body.appendChild(document.createElement('div'));
    cover.setAttribute('inert', '');
    const view = render(<AccountPage profile={null} account="loading" />, { container: cover.appendChild(document.createElement('div')) });
    view.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).not.toBe(quickReorder());
    cover.removeAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(quickReorder()));
    view.unmount();
    cover.remove();
  });

  it('leaves a page that was ready from the start, or another address, to the router', async () => {
    act(() => navigate('/account#quick-reorder'));
    const view = render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
    view.unmount();
    act(() => navigate('/account#order-history'));
    const other = render(<AccountPage profile={null} account="loading" />);
    other.rerender(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(document.body);
  });
});

// 23 orders, newest first: every status, orders and quote requests,
// delivery and will-call. Synthetic prices.
const STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'];
const ORDERS = Array.from({ length: 23 }, (_, i) => {
  const quote = i % 4 === 1;
  return {
    id: `o${i + 1}`, ref_num: `ALW-${quote ? 'Q' : 'O'}-${10100 - i}`, status: STATUSES[i % 9], kind: quote ? 'quote' : 'order',
    total_units: 6, subtotal: quote ? null : 61.5, created_at: new Date(Date.UTC(2026, 9, 8, 15) - i * 86400000).toISOString(),
    delivery: i % 3 === 2 ? 'willcall' : 'delivery', preferred_date: i === 0 ? '2026-10-20' : null,
    ship_street: '1200 Example Ave N', ship_city: 'Birmingham', ship_state: 'AL', ship_zip: '35203',
    notes: i === 0 ? 'Ring the bell at the back door.' : null,
    order_items: Array.from({ length: i === 0 ? 5 : 1 }, (__, j) => ({
      id: `${i}-${j}`, product_id: 14, variant: null, product_name: `Kite cigarette tobacco ${j + 1}`, sku: 'AW-KITE', qty: j + 1, unit_price: quote ? null : 10.25,
    })),
  };
});
// Answers the orders query as PostgREST would: the status group, the
// reference search, the page and the count.
function serveOrders(request) {
  if (request.table !== 'orders') return undefined;
  let rows = ORDERS;
  for (const [name, column, value] of request.filters) {
    if (name === 'in') rows = rows.filter((row) => value.includes(row[column]));
    if (name === 'ilike') rows = rows.filter((row) => row[column].toLowerCase().includes(value.slice(1, -1).toLowerCase()));
  }
  const range = request.modifiers.find(([name]) => name === 'range');
  return { data: range ? rows.slice(range[1], range[2] + 1) : rows, error: null, count: request.options?.count ? rows.length : null };
}
const ordersAsked = () => fake.find({ table: 'orders' });
const cards = () => [...document.querySelectorAll('.order-card')];
const countLine = () => document.querySelector('.order-count')?.textContent;
const announced = () => new Promise((resolve) => setTimeout(() => resolve(document.getElementById('aw-announcer')?.textContent), 150));

describe('AccountPage order history (AW-104, AW-105)', () => {
  beforeEach(() => { fake.respond = serveOrders; });

  it('shows ten orders, then ten more on request, keeping focus on the button while more are left', async () => {
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(cards()).toHaveLength(10));
    expect(countLine()).toBe('Showing 10 of 23 orders');
    const more = screen.getByRole('button', { name: 'Show 10 more orders' });
    more.focus();
    fireEvent.click(more);
    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(ordersAsked().map((call) => call.modifiers.find(([name]) => name === 'range').slice(1))).toEqual([[0, 9], [10, 19]]);
    expect(countLine()).toBe('Showing 20 of 23 orders');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show 3 more orders' }));
    expect(await announced()).toBe('Showing 20 of 23 orders');
    fireEvent.click(screen.getByRole('button', { name: 'Show 3 more orders' }));
    await waitFor(() => expect(cards()).toHaveLength(23));
    expect(screen.queryByRole('button', { name: /more orders/ })).toBeNull();
    // No more left: focus goes to the first order it added.
    await waitFor(() => expect(document.activeElement.textContent).toBe('Order ALW-O-10080'));
    expect(countLine()).toBe('Showing 23 orders');
  });

  it('says what each entry was, when, how it was to arrive, its status in the buyer’s words and the buyer’s notes', async () => {
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(cards()).toHaveLength(10));
    const [first, second, third] = cards();
    expect(within(first).getByRole('heading', { level: 3 }).textContent).toBe('Order ALW-O-10100');
    const placed = new Date(ORDERS[0].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    expect(first.querySelector('.order-head small').textContent).toBe(`${placed} · 6 units · $61.50`);
    expect(first.querySelector('.order-ship').textContent).toBe('Delivery to 1200 Example Ave N, Birmingham, AL 35203 · Requested Oct 20, 2026');
    expect(first.querySelector('.status-pill').textContent).toBe('Received');
    expect(first.querySelector('.order-notes').textContent).toBe('Your notes: Ring the bell at the back door.');
    expect(within(first).getByRole('button', { name: 'Reorder ALW-O-10100' })).toBeTruthy();
    // The status is a tag under the reference; Reorder is the head's only action (NEW-070).
    expect(first.querySelector('.order-summary .order-status > .status-pill')).toBe(first.querySelector('.status-pill'));
    expect([...first.querySelector('.order-actions').children].map((el) => el.textContent)).toEqual(['Reorder ALW-O-10100']);
    // A quote request: no prices yet.
    expect(within(second).getByRole('heading', { level: 3 }).textContent).toBe('Quote request ALW-Q-10099');
    expect(second.querySelector('.order-head small').textContent).toMatch(/· 6 units · Price on confirmation$/);
    expect(second.querySelector('.line-total').textContent).toBe('Price on confirmation');
    expect(second.querySelector('.status-pill').textContent).toBe('Confirming with a rep');
    expect(third.querySelector('.order-ship').textContent).toBe('Will-call pickup');
    expect(screen.getByText(/^How an order moves: Received, Confirming with a rep/)).toBeTruthy();
  });

  it('shows the first three lines of a long order until Show all', async () => {
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(cards()).toHaveLength(10));
    const first = cards()[0];
    expect(first.querySelectorAll('.order-items li')).toHaveLength(3);
    const toggle = within(first).getByRole('button', { name: 'Show all 5 items' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe(first.querySelector('.order-items').id);
    fireEvent.click(toggle);
    expect(first.querySelectorAll('.order-items li')).toHaveLength(5);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('Show fewer items');
    expect(cards()[1].querySelector('.order-items-toggle')).toBeNull();
  });

  it('filters by status and order number from the first page, and offers Clear filters when nothing matches', async () => {
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    await waitFor(() => expect(cards()).toHaveLength(10));
    fireEvent.click(screen.getByRole('button', { name: 'Show 10 more orders' }));
    await waitFor(() => expect(cards()).toHaveLength(20));
    const filters = screen.getByRole('search', { name: 'Find orders' });
    fireEvent.change(within(filters).getByLabelText('Show'), { target: { value: 'cancelled' } });
    await waitFor(() => expect(countLine()).toBe('Showing 2 matching orders'));
    expect(cards().map((card) => card.querySelector('.status-pill').textContent)).toEqual(['Cancelled', 'Cancelled']);
    const last = ordersAsked().at(-1);
    expect(last.filters).toContainEqual(['in', 'status', ['cancelled']]);
    expect(last.modifiers).toContainEqual(['range', 0, 9]);
    expect(await announced()).toBe('Showing 2 matching orders');
    fireEvent.change(within(filters).getByLabelText('Show'), { target: { value: 'all' } });
    fireEvent.change(within(filters).getByLabelText('Order number'), { target: { value: 'q-10099' } });
    fireEvent.submit(filters);
    await waitFor(() => expect(cards().map((card) => card.querySelector('.order-ref').textContent)).toEqual(['ALW-Q-10099']));
    expect(ordersAsked().at(-1).filters).toContainEqual(['ilike', 'ref_num', '%q-10099%']);
    fireEvent.change(within(filters).getByLabelText('Order number'), { target: { value: 'nothing-like-it' } });
    await waitFor(() => expect(screen.getByRole('heading', { level: 3, name: 'No orders match' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(document.activeElement).toBe(within(filters).getByLabelText('Show'));
    await waitFor(() => expect(countLine()).toBe('Showing 10 of 23 orders'));
    expect(within(filters).getByLabelText('Order number').value).toBe('');
  });

  it('keeps the empty history as it was, with no filters', async () => {
    fake.respond = (request) => (request.table === 'orders' ? { data: [], error: null, count: 0 } : undefined);
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    expect(await screen.findByText('No orders yet')).toBeTruthy();
    expect(screen.queryByRole('search')).toBeNull();
    expect(document.querySelector('.order-count')).toBeNull();
  });

  it('says what to do when the history did not load, and Try again loads it', async () => {
    let fail = true;
    fake.respond = (request) => {
      if (request.table !== 'orders') return undefined;
      return fail ? { data: null, error: { code: '42501', message: 'permission denied for table orders' } } : serveOrders(request);
    };
    render(<AccountPage profile={PROFILE} account="ready" products={[]} />);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText(/^We couldn’t load your orders\./)).toBeTruthy();
    expect(screen.queryByText(/permission denied/)).toBeNull();
    fail = false;
    retry.focus();
    fireEvent.click(retry);
    await waitFor(() => expect(cards()).toHaveLength(10));
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Order history' })));
  });
});

describe('AdminPage', () => {
  it('shows a loading state, never access denied, while auth loads (AW-087)', () => {
    render(<AdminPage profile={null} account="loading" onSignIn={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Admin');
    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByText(/Sign in to continue|trade desk/)).toBeNull();
  });

  it('still helps signed-out visitors and other accounts', () => {
    const view = render(<AdminPage profile={null} account="signed-out" onSignIn={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign in to continue');
    view.rerender(<AdminPage profile={PROFILE} account="ready" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('This page is for the trade desk');
    expect(screen.getByRole('link', { name: /My account/ }).getAttribute('href')).toBe('/account');
  });
});
