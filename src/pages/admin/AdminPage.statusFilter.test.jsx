// Admin -> Accounts' status filter (AW-268) and the admin's navigation
// semantics (AW-269), with the fake client: status pills with counts in a
// labelled group of toggle buttons, ?status= in the URL (pending by default),
// the filter then the search, the empty states, an account approved from the
// list staying where it is, and Back from an account's page. No tab roles
// anywhere: the sections are links with aria-current (AW-118).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetOrderStatusForTests } = await import('./OrdersSection.jsx');
const { resetOrdersSeenForTests } = await import('./ordersSeen.js');
const { navigate, useRoute } = await import('../../lib/router.js');

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

const uuid = (n) => `11111111-2222-4333-8444-${String(n).padStart(12, '0')}`;
const account = (n, business, status, extra = {}) => ({
  id: uuid(n), business, name: `${business} owner`, email: `${business.split(' ')[0].toLowerCase()}@example.test`, status, role: 'customer', pricing_tier: 'standard', ...extra,
});
const ADMIN = { ...account(1, 'Alabama Wholesale', 'approved'), role: 'admin' };
const PROFILES = [
  ADMIN,
  account(2, 'Alpha Food Mart', 'approved'),
  account(3, 'Bravo Tobacco Outlet', 'pending'),
  account(4, 'Charlie Corner Store', 'pending'),
  account(5, 'Delta Gas', 'suspended'),
  account(6, 'Echo Market', 'pending'),
  account(7, 'Foxtrot Deli', 'approved'),
];
const url = () => window.location.pathname + window.location.search;

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  resetOrdersSeenForTests();
  fake.tables = {
    orders: [
      { id: 'o1', ref_num: 'ALW-O-1', user_id: uuid(2), status: 'new', created_at: '2026-10-06T15:00:00Z', business: 'Alpha Food Mart', kind: 'order', subtotal: 10, profiles: null, order_items: [] },
    ],
    profiles: PROFILES.map((p) => ({ ...p })),
    pricing_tiers: [],
    profile_documents: [],
    profile_admin_notes: [],
    profile_status_log: [],
  };
});
afterEach(async () => {
  // ConfirmDialog's history entry is removed asynchronously.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.restoreAllMocks();
});

const open = async (path) => {
  if (path) act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
  await act(async () => {});
};
const pills = () => within(screen.getByRole('group', { name: 'Account status' })).getAllByRole('button');
const pill = (name) => within(screen.getByRole('group', { name: 'Account status' })).getByRole('button', { name });
const listed = () => [...document.querySelectorAll('table .account-link')].map((a) => a.textContent);
const count = () => document.querySelector('.admin-count').textContent;
const row = (business) => screen.getByRole('link', { name: business }).closest('tr');

describe('the Accounts status filter (AW-268)', () => {
  it('opens on the pending accounts, with a count per status in a labelled group of toggle buttons', async () => {
    await open('/admin/accounts');
    expect(pills().map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['pending (3)', 'true'], ['approved (3)', 'false'], ['suspended (1)', 'false'], ['all (7)', 'false'],
    ]);
    expect(listed()).toEqual(['Bravo Tobacco Outlet', 'Charlie Corner Store', 'Echo Market']);
    expect(count()).toBe('3 pending accounts');
    expect(url()).toBe('/admin/accounts');
    // The table scrolls in a named region the keyboard can reach (AW-266).
    const region = screen.getByRole('region', { name: 'Accounts table' });
    expect(region.tabIndex).toBe(0);
    expect(region.querySelector('table').className).toBe('aw-table admin-accounts');
  });

  it('writes the status into the URL, leaving the default out, and reads it back', async () => {
    await open('/admin/accounts');
    await act(async () => { fireEvent.click(pill('suspended (1)')); });
    expect(url()).toBe('/admin/accounts?status=suspended');
    expect(pill('suspended (1)').getAttribute('aria-pressed')).toBe('true');
    expect(pill('pending (3)').getAttribute('aria-pressed')).toBe('false');
    expect(listed()).toEqual(['Delta Gas']);
    expect(count()).toBe('1 suspended account');
    await act(async () => { fireEvent.click(pill('all (7)')); });
    expect(url()).toBe('/admin/accounts?status=all');
    expect(listed()).toHaveLength(7);
    expect(count()).toBe('7 accounts');
    await act(async () => { fireEvent.click(pill('pending (3)')); });
    expect(url()).toBe('/admin/accounts');
    // The section link brings the last filter back after another section.
    await act(async () => { fireEvent.click(pill('approved (3)')); });
    await act(async () => { navigate('/admin/orders'); });
    const link = screen.getByRole('navigation', { name: 'Admin sections' }).querySelector('a[href^="/admin/accounts"]');
    expect(link.getAttribute('href')).toBe('/admin/accounts?status=approved');
  });

  it('tidies an unknown or upper-case status in the address bar', async () => {
    await open('/admin/accounts?status=APPROVED');
    expect(url()).toBe('/admin/accounts?status=approved');
    expect(listed()).toEqual(['Alabama Wholesale', 'Alpha Food Mart', 'Foxtrot Deli']);
    await act(async () => { navigate('/admin/accounts?status=deleted', { replace: true }); });
    await act(async () => {});
    expect(url()).toBe('/admin/accounts');
    expect(pill('pending (3)').getAttribute('aria-pressed')).toBe('true');
  });

  it('says when a status has no accounts, instead of an empty table', async () => {
    fake.tables.profiles = PROFILES.filter((p) => p.status !== 'suspended');
    await open('/admin/accounts?status=suspended');
    expect(pill('suspended (0)').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('No suspended accounts.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(count()).toBe('0 suspended accounts');
  });

  it('filters by status, then by the search, and offers to search every status', async () => {
    await open('/admin/accounts');
    const box = screen.getByLabelText('Search accounts');
    fireEvent.change(box, { target: { value: 'charlie' } });
    expect(listed()).toEqual(['Charlie Corner Store']);
    expect(count()).toBe('1 of 3 pending accounts');
    // An approved account isn't among the pending ones.
    fireEvent.change(box, { target: { value: 'foxtrot' } });
    expect(screen.getByText('No pending account matches “foxtrot”.')).toBeTruthy();
    expect(screen.queryByText('No pending accounts.')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search all accounts' })); });
    expect(url()).toBe('/admin/accounts?status=all');
    expect(listed()).toEqual(['Foxtrot Deli']);
    expect(count()).toBe('1 of 7 accounts');
    expect(document.activeElement).toBe(box);
    // In every status there is nothing more to offer.
    fireEvent.change(box, { target: { value: 'nobody' } });
    expect(screen.getByText('No account matches “nobody”.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Search all accounts' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(box.value).toBe('');
    expect(document.activeElement).toBe(box);
    // The search stays out of the URL (it names people).
    expect(url()).toBe('/admin/accounts?status=all');
  });

  it('keeps an account approved from the pending list where it is, marked, with the focus on its status', async () => {
    await open('/admin/accounts');
    await act(async () => { fireEvent.click(within(row('Charlie Corner Store')).getByRole('button', { name: /^Approve ?Charlie Corner Store$/ })); });
    expect(fake.find({ op: 'update' }).map((c) => c.patch)).toEqual([{ status: 'approved' }]);
    const select = within(row('Charlie Corner Store')).getByRole('combobox', { name: 'Status for Charlie Corner Store' });
    expect(select.value).toBe('approved');
    expect(document.activeElement).toBe(select);
    expect(within(row('Charlie Corner Store')).getByText('Moved to approved')).toBeTruthy();
    expect(listed()).toEqual(['Bravo Tobacco Outlet', 'Charlie Corner Store', 'Echo Market']);
    expect(count()).toBe('2 pending accounts · 1 moved');
    // The counts are the accounts' statuses now.
    expect(pill('pending (2)')).toBeTruthy();
    expect(pill('approved (4)')).toBeTruthy();
    // Another filter starts afresh: it is listed as approved, and gone from pending.
    await act(async () => { fireEvent.click(pill('approved (4)')); });
    expect(listed()).toContain('Charlie Corner Store');
    expect(screen.queryByText('Moved to approved')).toBeNull();
    await act(async () => { fireEvent.click(pill('pending (2)')); });
    expect(listed()).toEqual(['Bravo Tobacco Outlet', 'Echo Market']);
  });

  it('Back from an account’s page opened elsewhere goes to the list of its status, which focuses its link', async () => {
    await open(`/admin/accounts/${uuid(5)}`);
    const back = screen.getByRole('link', { name: 'Back to accounts' });
    expect(back.getAttribute('href')).toBe('/admin/accounts?status=suspended');
    await act(async () => { fireEvent.click(back); });
    await act(async () => {});
    expect(url()).toBe('/admin/accounts?status=suspended');
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Delta Gas' }));
    // A pending account's list is the default one.
    await act(async () => { navigate(`/admin/accounts/${uuid(3)}`); });
    expect(screen.getByRole('link', { name: 'Back to accounts' }).getAttribute('href')).toBe('/admin/accounts');
  });

  it('Back from an account approved on its own page finds it in the pending list it was opened from', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {
      act(() => navigate('/admin/accounts', { replace: true }));
    });
    await open('/admin/accounts');
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Echo Market' })); });
    expect(screen.getByRole('heading', { level: 2, name: 'Echo Market' })).toBeTruthy();
    await act(async () => { fireEvent.change(screen.getByLabelText('Status', { exact: true }), { target: { value: 'approved' } }); });
    expect(fake.find({ op: 'update' }).map((c) => c.patch)).toEqual([{ status: 'approved' }]);
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Back to accounts' })); });
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(listed()).toEqual(['Bravo Tobacco Outlet', 'Charlie Corner Store', 'Echo Market']);
    expect(within(row('Echo Market')).getByText('Moved to approved')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Echo Market' }));
  });
});

describe('admin navigation semantics (AW-269, done by AW-118)', () => {
  it('uses no tab roles: the sections are links marking the current page, and the status pills are toggle buttons in labelled groups', async () => {
    await open('/admin/orders');
    for (const role of ['tablist', 'tab', 'tabpanel']) expect(screen.queryAllByRole(role), role).toHaveLength(0);
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect(within(nav).getByRole('link', { name: 'Orders' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Accounts' }).hasAttribute('aria-current')).toBe(false);
    const orderPills = within(screen.getByRole('group', { name: 'Order status' })).getAllByRole('button');
    expect(orderPills.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['new (1)']);
    expect(orderPills.every((b) => ['true', 'false'].includes(b.getAttribute('aria-pressed')))).toBe(true);

    await act(async () => { fireEvent.click(within(nav).getByRole('link', { name: 'Accounts' })); });
    for (const role of ['tablist', 'tab', 'tabpanel']) expect(screen.queryAllByRole(role), role).toHaveLength(0);
    expect(within(nav).getByRole('link', { name: 'Accounts' }).getAttribute('aria-current')).toBe('page');
    expect(pills().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['pending (3)']);
  });
});
