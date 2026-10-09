// Admin → Accounts with a fake Supabase client (no network): licence proof for
// every status (AW-197, AW-254), the details row with the application answers
// staff verify (AW-017), and licence answers on quotes (AW-014). Cursor's
// PR #12 behaviour, in the Phase 1 structure.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { navigate } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const APPROVED = {
  id: 'p-approved', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', status: 'approved',
  pricing_tier: 'standard', role: 'customer', ein: '12-3456789', license_no: 'TL-1', resale_cert_no: 'RC-1', phone: '205-000-0001',
  state: 'AL', store_street: '1 Alpha Way', store_city: 'Birmingham', store_zip: '35203', business_type: 'Convenience Store',
  expected_volume: '$5K — $15K', approved_at: '2026-10-01T15:00:00Z', approved_by: 'admin-1', verification_note: 'Checked',
  terms_accepted_at: '2026-09-30T15:00:00Z', terms_version: '2026-09',
};
// A row from a live database without the 2026-10-08 columns.
const PENDING = { id: 'p-pending', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', status: 'pending', pricing_tier: 'standard', role: 'customer' };
let updateError = null;

beforeEach(() => {
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  fake.tables = {
    profiles: [APPROVED, PENDING, ADMIN],
    orders: [],
    profile_documents: [{ profile_id: 'p-approved', document_type: 'tobacco_license', storage_path: 'p-approved/tobacco_license/1-licence.pdf' }],
  };
  updateError = null;
  fake.respond = (request) => (request.op === 'update' && updateError ? { data: null, error: updateError } : undefined);
});

const updates = () => fake.find({ op: 'update' }).map(({ table, filters, patch }) => ({ table, id: filters.find(([name]) => name === 'eq')[2], patch }));

async function openAccounts() {
  await act(async () => { render(<AdminPage profile={ADMIN} account="ready" route={{ page: 'admin', section: 'accounts', query: {} }} />); });
  expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('aria-current')).toBe('page');
}
// jsdom drops the space before an sr-only span in accessible names.
const named = (label, business) => new RegExp(`^${label} ?for ${business}$`);
const rowFor = (business) => screen.getByRole('cell', { name: business }).closest('tr');

describe('Admin accounts', () => {
  it('shows licence proof for approved accounts too', async () => {
    await openAccounts();
    const row = rowFor('Alpha Food Mart');
    expect(within(row).getByText('On file')).toBeTruthy();
    // A new-tab link that leaves the site: the external icon, and the screen
    // reader hears that it opens a new tab (AW-218).
    const view = await within(row).findByRole('link', { name: /^View ?.* for Alpha Food Mart \(opens in a new tab\)$/ });
    expect(view.querySelector('svg.icon')).toBeTruthy();
    // No proof on file for the pending account yet.
    expect(within(rowFor('Bravo Tobacco Outlet')).getAllByText('Not on file').length).toBe(2);
  });

  it('opens a details row with the application answers and approval', async () => {
    await openAccounts();
    const toggle = within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Details', 'Alpha Food Mart') });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const details = document.getElementById(toggle.getAttribute('aria-controls'));
    const facts = within(details);
    for (const text of ['12-3456789', 'TL-1', 'RC-1', '205-000-0001', '1 Alpha Way', 'Birmingham', '35203', 'Convenience Store', '$5K — $15K', 'Desk Admin']) {
      expect(facts.getByText(text)).toBeTruthy();
    }
    expect(facts.getByText(/2026-09$/)).toBeTruthy();
    expect(facts.getByLabelText('Verification note').value).toBe('Checked');
    fireEvent.click(within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Hide', 'Alpha Food Mart') }));
    expect(document.getElementById('account-details-p-approved')).toBeNull();
  });

  it('shows dashes for answers the live database does not have yet, and explains a note it cannot save', async () => {
    updateError = { code: 'PGRST204', message: "Could not find the 'verification_note' column of 'profiles' in the schema cache" };
    await openAccounts();
    fireEvent.click(within(rowFor('Bravo Tobacco Outlet')).getByRole('button', { name: named('Details', 'Bravo Tobacco Outlet') }));
    const details = within(document.getElementById('account-details-p-pending'));
    expect(details.getAllByText('—').length).toBeGreaterThan(5);
    fireEvent.change(details.getByLabelText('Verification note'), { target: { value: 'Called the store' } });
    await act(async () => { fireEvent.click(details.getByRole('button', { name: 'Save note' })); });
    expect(updates().at(-1)).toEqual({ table: 'profiles', id: 'p-pending', patch: { verification_note: 'Called the store' } });
    expect(screen.getByRole('alert').textContent).toMatch(/needs the October 2026 database update/);
  });
});

describe('Admin orders', () => {
  it('shows the licence answers a guest gave with a tobacco quote', async () => {
    fake.tables.orders = [{
      id: 'o1', ref_num: 'ALW-Q-12345', status: 'new', created_at: '2026-10-08T15:00:00Z', business: 'Guest Mart', contact: 'Gus', email: 'g@example.test',
      phone: '205-000-0002', ship_street: '2 Guest Rd', ship_city: 'Hoover', ship_state: 'AL', ship_zip: '35244',
      license_no: 'TL-9', resale_cert_no: 'RC-9', purchasers_21: true, order_items: [],
    }];
    await act(async () => { render(<AdminPage profile={ADMIN} account="ready" />); });
    expect(screen.getByText('Tobacco license: TL-9 · Resale certificate: RC-9 · 21+ purchasers confirmed')).toBeTruthy();
  });
});
