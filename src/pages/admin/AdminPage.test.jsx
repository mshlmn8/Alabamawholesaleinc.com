// Admin → Accounts with a fake Supabase client (no network): licence proof for
// every status (AW-197, AW-254), the details row with the application answers
// staff verify (AW-017), and licence answers on quotes (AW-014). Cursor's
// PR #12 behaviour, in the Phase 1 structure.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// Every status: the list opens on pending accounts (AW-268).
async function openAccounts() {
  await act(async () => { render(<AdminPage profile={ADMIN} account="ready" route={{ page: 'admin', section: 'accounts', query: { status: 'all' } }} />); });
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
    // It opens in a new tab, off the site: the external icon, and the screen
    // reader hears that it opens a new tab (AW-218). A button, signed on
    // click (AW-208).
    const view = within(row).getByRole('button', { name: /^View ?.* for Alpha Food Mart \(opens in a new tab\)$/ });
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

describe('licence documents, signed when View is clicked (AW-208)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const PATH = 'p-approved/tobacco_license/1-licence.pdf';
  const viewButton = () => within(rowFor('Alpha Food Mart')).getByRole('button', { name: /^View ?State retail tobacco license for Alpha Food Mart/ });
  const signs = () => fake.find({ kind: 'storage', op: 'createSignedUrl' });

  it('signs nothing on load, and one short-lived URL per click, loaded into a tab opened at once', async () => {
    const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    await openAccounts();
    expect(signs()).toHaveLength(0);
    await act(async () => { fireEvent.click(viewButton()); });
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(signs()).toEqual([expect.objectContaining({ bucket: 'application-documents', path: PATH, expiresIn: 60 })]);
    expect(tab.location.replace).toHaveBeenCalledWith(`https://files.example.test/${PATH}`);
    await act(async () => { fireEvent.click(viewButton()); });
    expect(signs()).toHaveLength(2);
    // Changing an account reloads the accounts, not the documents.
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Tier for Alpha Food Mart' }), { target: { value: 'silver' } });
    });
    expect(fake.find({ table: 'profile_documents' })).toHaveLength(1);
    expect(signs()).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /State retail tobacco license/ })).toBeNull();
  });

  it('closes the tab and says why when the document can’t be signed', async () => {
    const tab = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab);
    fake.respond = (request) => (request.kind === 'storage' ? { data: null, error: { message: 'Object not found', statusCode: '404' } } : undefined);
    await openAccounts();
    await act(async () => { fireEvent.click(viewButton()); });
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t open the state retail tobacco license for Alpha Food Mart (Object not found). Try again.');
  });

  it('offers the signed URL as a link while it lasts when the browser blocks the tab', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await openAccounts();
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(viewButton()); });
    const link = within(rowFor('Alpha Food Mart')).getByRole('link', { name: /^Open the state retail tobacco license ?for Alpha Food Mart \(opens in a new tab\)$/ });
    expect(link.getAttribute('href')).toBe(`https://files.example.test/${PATH}`);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    await act(async () => { vi.advanceTimersByTime(55 * 1000); });
    expect(within(rowFor('Alpha Food Mart')).queryByRole('link', { name: /^Open the state/ })).toBeNull();
  });
});

describe('an unsaved verification note (AW-118)', () => {
  it('asks before the page changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openAccounts();
    fireEvent.click(within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Details', 'Alpha Food Mart') }));
    act(() => navigate('/admin/orders'));
    expect(confirm).not.toHaveBeenCalled();
    act(() => navigate('/admin/accounts', { replace: true }));
    fireEvent.change(screen.getByLabelText('Verification note'), { target: { value: 'Checked twice' } });
    act(() => navigate('/admin/orders'));
    expect(confirm).toHaveBeenCalledWith('The verification note isn’t saved. Leave without saving it?');
    expect(window.location.pathname).toBe('/admin/accounts');
    confirm.mockRestore();
  });
});

describe('an unsaved verification note in the list (AW-118)', () => {
  afterEach(async () => {
    // ConfirmDialog's history entry is removed asynchronously.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  });

  it('asks before Details on another account or Hide drops it', async () => {
    await openAccounts();
    fireEvent.click(within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Details', 'Alpha Food Mart') }));
    fireEvent.change(screen.getByLabelText('Verification note'), { target: { value: 'Checked twice' } });
    fireEvent.click(within(rowFor('Bravo Tobacco Outlet')).getByRole('button', { name: named('Details', 'Bravo Tobacco Outlet') }));
    const dialog = screen.getByRole('alertdialog', { name: 'Discard the verification note for Alpha Food Mart?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByLabelText('Verification note').value).toBe('Checked twice');
    fireEvent.click(within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Hide', 'Alpha Food Mart') }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard the note' }));
    expect(screen.queryByLabelText('Verification note')).toBeNull();
    // A clean note goes without asking.
    fireEvent.click(within(rowFor('Bravo Tobacco Outlet')).getByRole('button', { name: named('Details', 'Bravo Tobacco Outlet') }));
    fireEvent.click(within(rowFor('Alpha Food Mart')).getByRole('button', { name: named('Details', 'Alpha Food Mart') }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByLabelText('Verification note').value).toBe('Checked');
    expect(updates()).toEqual([]);
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
