// Staff accounts in Admin (AW-030, AW-031; owner answer 2026-10): an approved
// staff account gets every section but Pricing, and in Accounts sees the
// tier and role as text and can't change a staff or admin account; an admin
// makes someone staff (with a reason) or takes it away. The admin home has
// "How to use Admin". With the fake client (fakeSupabase.js).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage, PRICING_ADMIN_ONLY } = await import('./AdminPage.jsx');
const { HELP_TOPICS } = await import('./AdminHelp.jsx');
const { navigate } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Olive Owner', business: 'Alabama Wholesale', email: 'owner@example.test', role: 'admin', status: 'approved', pricing_tier: 'standard', created_at: '2026-01-01T00:00:00Z' };
const STAFF = { id: 'staff-1', name: 'Sam Staff', business: 'Desk Staff', email: 'sam@example.test', role: 'staff', status: 'approved', pricing_tier: 'standard', created_at: '2026-02-01T00:00:00Z' };
const BUYER = { id: 'buyer-1', name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', role: 'customer', status: 'pending', pricing_tier: 'silver', created_at: '2026-09-01T00:00:00Z' };

beforeEach(() => {
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  fake.tables = {
    profiles: [ADMIN, STAFF, BUYER],
    profile_documents: [],
    pricing_tiers: [{ tier: 'standard', discount_pct: 0 }, { tier: 'silver', discount_pct: 5 }],
    orders: [],
  };
});

const render$ = async (profile, route) => { await act(async () => { render(<AdminPage profile={profile} account="ready" route={route} />); }); };
const sections = () => [...screen.getByRole('navigation', { name: 'Admin sections' }).querySelectorAll('a')].map((a) => a.textContent);
const rowOf = (business) => screen.getByRole('cell', { name: business }).closest('tr');
const updates = () => fake.find({ table: 'profiles', op: 'update' }).map(({ filters, patch }) => ({ id: filters.find(([n]) => n === 'eq')[2], patch }));

describe('a staff account in Admin (AW-030)', () => {
  it('gets every section but Pricing', async () => {
    await render$(STAFF, { page: 'admin' });
    expect(sections()).toEqual(['Orders', 'Accounts', 'Products', 'Homepage', 'Site settings']);
    expect(screen.getByText('Orders, account approvals, catalog edits, the home page and the site settings.')).toBeTruthy();
  });

  it('is told an admin changes the pricing tiers, at /admin/pricing', async () => {
    await render$(STAFF, { page: 'admin', section: 'pricing', query: {} });
    expect(screen.getByText(PRICING_ADMIN_ONLY)).toBeTruthy();
    expect(fake.find({ table: 'pricing_tiers', op: 'select' })).toHaveLength(0);
  });

  it('is told a pending or suspended staff account’s access is on hold', () => {
    for (const status of ['pending', 'suspended']) {
      const view = render(<AdminPage profile={{ ...STAFF, status }} account="ready" />);
      expect(screen.getByText('Your staff access is on hold. Contact the owner.')).toBeTruthy();
      expect(screen.queryByRole('navigation', { name: 'Admin sections' })).toBeNull();
      view.unmount();
    }
  });

  it('sees the tier and role as text, changes a customer’s status, and can’t change a staff or admin account', async () => {
    await render$(STAFF, { page: 'admin', section: 'accounts', query: { status: 'all' } });
    await screen.findByRole('table');
    const buyer = rowOf('Test Market LLC');
    expect(within(buyer).queryByRole('combobox', { name: /Tier for/ })).toBeNull();
    expect(within(buyer).queryByRole('combobox', { name: /Role for/ })).toBeNull();
    expect(buyer.textContent).toContain('Silver');
    expect(buyer.textContent).toContain('Customer');
    const status = within(buyer).getByRole('combobox', { name: 'Status for Test Market LLC' });
    expect(status.disabled).toBe(false);
    await act(async () => { fireEvent.click(within(buyer).getByRole('button', { name: /^Approve ?Test Market LLC$/ })); });
    expect(updates()).toEqual([{ id: 'buyer-1', patch: { status: 'approved' } }]);

    // The owner's account, and their own: locked, with the reason.
    for (const business of ['Alabama Wholesale', 'Desk Staff']) {
      const select = within(rowOf(business)).getByRole('combobox', { name: `Status for ${business}` });
      expect(select.disabled).toBe(true);
      expect(document.getElementById(select.getAttribute('aria-describedby')).textContent).toBe('Only an admin can change a staff or admin account.');
      expect(within(rowOf(business)).queryByRole('button', { name: /^Approve/ })).toBeNull();
    }
  });

  it('opens a customer’s page without the tier and role selects', async () => {
    await render$(STAFF, { page: 'admin', section: 'accounts', id: 'buyer-1', query: {} });
    const controls = screen.getByRole('heading', { name: 'Status, tier and role' }).closest('section');
    expect(within(controls).getByLabelText('Status')).toBeTruthy();
    expect(within(controls).queryByLabelText('Tier')).toBeNull();
    expect(within(controls).queryByLabelText('Role')).toBeNull();
    expect(controls.querySelector('.account-facts').textContent).toBe('TierSilverRoleCustomer');
  });

  it('reads an admin’s page with everything locked', async () => {
    await render$(STAFF, { page: 'admin', section: 'accounts', id: 'admin-1', query: {} });
    const controls = screen.getByRole('heading', { name: 'Status, tier and role' }).closest('section');
    expect(within(controls).getByLabelText('Status').disabled).toBe(true);
    expect(within(controls).getByText('Only an admin can change a staff or admin account.')).toBeTruthy();
    const contact = screen.getByRole('heading', { name: 'Contact and store' }).closest('section');
    expect(within(contact).getByLabelText('Business name').readOnly).toBe(true);
    expect(within(contact).getByRole('button', { name: 'Save changes' }).disabled).toBe(true);
  });
});

describe('an admin and staff roles (AW-030)', () => {
  it('makes a customer staff after a reason, approving a pending account too', async () => {
    await render$(ADMIN, { page: 'admin', section: 'accounts', query: { status: 'all' } });
    await screen.findByRole('table');
    const role = within(rowOf('Test Market LLC')).getByRole('combobox', { name: 'Role for Test Market LLC' });
    expect([...role.options].map((o) => o.textContent)).toEqual(['Customer', 'Staff', 'Admin']);
    await act(async () => { fireEvent.change(role, { target: { value: 'staff' } }); });
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Make Test Market LLC staff?');
    expect(dialog.textContent).toContain('They can’t change roles or pricing tiers. This also approves the account.');
    await act(async () => { fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'New warehouse clerk' } }); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Make staff' })); });
    expect(updates()).toEqual([{ id: 'buyer-1', patch: { role: 'staff', status: 'approved' } }]);
    expect(fake.find({ table: 'profile_admin_notes', op: 'insert' })[0].rows).toEqual({ profile_id: 'buyer-1', body: 'Made staff: New warehouse clerk' });
  });

  it('takes staff access away after a reason', async () => {
    await render$(ADMIN, { page: 'admin', section: 'accounts', query: { status: 'all' } });
    await screen.findByRole('table');
    const role = within(rowOf('Desk Staff')).getByRole('combobox', { name: 'Role for Desk Staff' });
    expect(role.value).toBe('staff');
    await act(async () => { fireEvent.change(role, { target: { value: 'customer' } }); });
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Remove staff access from Desk Staff?');
    await act(async () => { fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Left the company' } }); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Remove staff access' })); });
    expect(updates()).toEqual([{ id: 'staff-1', patch: { role: 'customer' } }]);
  });

  it('says the Staff role needs the database update when the role check refuses it', async () => {
    fake.respond = (request) => (request.table === 'profiles' && request.op === 'update'
      ? { data: null, error: { code: '23514', message: 'new row for relation "profiles" violates check constraint "profiles_role_chk"' } }
      : undefined);
    await render$(ADMIN, { page: 'admin', section: 'accounts', query: { status: 'all' } });
    await screen.findByRole('table');
    await act(async () => { fireEvent.change(within(rowOf('Test Market LLC')).getByRole('combobox', { name: 'Role for Test Market LLC' }), { target: { value: 'staff' } }); });
    const dialog = screen.getByRole('alertdialog');
    await act(async () => { fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Clerk' } }); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Make staff' })); });
    expect(screen.getByRole('alert').textContent).toBe('Staff accounts need the October 2026 database update (see BACKEND.md).');
  });
});

describe('How to use Admin (AW-030, AW-031)', () => {
  it('is on the admin home only, folded, with a link to each job’s section', async () => {
    await render$(ADMIN, { page: 'admin' });
    const help = document.querySelector('details.admin-help');
    expect(help.open).toBe(false);
    expect(within(help).getByRole('heading', { level: 2 }).textContent).toBe('How to use Admin');
    expect([...help.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(HELP_TOPICS.map((t) => t.title));
    expect([...help.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/admin/products', '/admin/products?unit=none', '/admin/homepage', '/admin/settings', '/admin/accounts', '/admin/accounts?status=all',
    ]);
    expect(HELP_TOPICS.map((t) => t.title)).toEqual([
      'Change a product photo', 'Set sell units', 'Edit the home page’s photos', 'Change the announcements, phone, email, hours or address',
      'Approve an account', 'Make someone staff',
    ]);
  });

  it('isn’t on the sections’ own pages', async () => {
    await render$(ADMIN, { page: 'admin', section: 'orders', query: {} });
    expect(document.querySelector('details.admin-help')).toBeNull();
  });

  it('tells staff to ask the owner to make someone staff', async () => {
    await render$(STAFF, { page: 'admin' });
    const help = document.querySelector('details.admin-help');
    const staffTopic = [...help.querySelectorAll('li')].find((li) => li.querySelector('h3').textContent === 'Make someone staff');
    expect(staffTopic.querySelector('p').textContent).toBe('Only an admin can make someone staff or change pricing tiers. Ask the owner.');
    expect(staffTopic.querySelector('a')).toBeNull();
  });
});
