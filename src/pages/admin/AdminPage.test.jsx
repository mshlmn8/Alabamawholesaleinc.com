// The admin page for an approved admin only (AW-352), and the Accounts tab's
// approval record, documents for every status and the admin's own row
// (AW-197, AW-352).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ profiles: [], documents: [], updates: [], updateResult: null }));

vi.mock('../../lib/supabase.js', () => {
  const result = (table) => {
    if (table === 'profiles') return { data: db.profiles, error: null };
    if (table === 'profile_documents') return { data: db.documents, error: null };
    if (table === 'pricing_tiers') return { data: [{ tier: 'standard', discount_pct: 0 }, { tier: 'silver', discount_pct: 5 }], error: null };
    return { data: [], error: null };
  };
  const from = (table) => {
    let patch = null;
    const q = {
      select: () => q,
      order: () => q,
      limit: () => q,
      eq: (_col, id) => { if (patch) db.updates.push({ table, id, patch }); return q; },
      update: (next) => { patch = next; return q; },
      then: (resolve, reject) => Promise.resolve(patch ? (db.updateResult || { data: [{ id: 'x' }], error: null }) : result(table)).then(resolve, reject),
    };
    return q;
  };
  const storage = { from: () => ({ createSignedUrl: async (path) => ({ data: { signedUrl: `https://files.example.test/${path}` }, error: null }) }) };
  return { supabase: { from, storage, rpc: async () => ({ data: {}, error: null }) }, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { AdminPage, approvalLine } = await import('./AdminPage.jsx');

const ADMIN = { id: 'admin-1', name: 'Olive Owner', business: 'Alabama Wholesale', email: 'owner@example.test', role: 'admin', status: 'approved', pricing_tier: 'standard', created_at: '2026-01-01T00:00:00Z' };
const APPROVED = {
  id: 'buyer-1', name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', role: 'customer', status: 'approved', pricing_tier: 'silver',
  approved_at: '2026-09-28T15:00:00Z', approved_by: 'admin-1', created_at: '2026-09-01T00:00:00Z',
};
const PENDING = { id: 'buyer-2', name: 'New Buyer', business: 'New Store', email: 'new@example.test', role: 'customer', status: 'pending', pricing_tier: 'standard', created_at: '2026-09-02T00:00:00Z' };

beforeEach(() => {
  db.profiles = [ADMIN, APPROVED, PENDING];
  db.documents = [{ profile_id: 'buyer-1', document_type: 'tobacco_license', storage_path: 'buyer-1/tobacco_license/l.pdf', original_filename: 'l.pdf', uploaded_at: '2026-09-02T00:00:00Z' }];
  db.updates = [];
  db.updateResult = null;
});

async function openAccounts(profile = ADMIN) {
  render(<AdminPage profile={profile} account="ready" />);
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Accounts' })); });
  return screen.findByRole('table');
}
const rowOf = (business) => screen.getByRole('cell', { name: business }).closest('tr');

describe('AdminPage access (AW-352)', () => {
  it('tells a suspended or pending admin their access is on hold', () => {
    for (const status of ['suspended', 'pending']) {
      const view = render(<AdminPage profile={{ ...ADMIN, status }} account="ready" />);
      expect(screen.getByText('Your admin access is on hold. Contact the owner.')).toBeTruthy();
      expect(screen.queryByRole('tablist')).toBeNull();
      view.unmount();
    }
  });

  it('keeps customers out', () => {
    render(<AdminPage profile={{ ...APPROVED }} account="ready" />);
    expect(screen.getByText(/Your account doesn’t have access/)).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('AdminPage accounts', () => {
  it('locks the admin’s own status and role, and no other row’s', async () => {
    await openAccounts();
    const own = rowOf('Alabama Wholesale');
    expect(within(own).getByRole('combobox', { name: 'Status for Alabama Wholesale' }).disabled).toBe(true);
    expect(within(own).getByRole('combobox', { name: 'Role for Alabama Wholesale' }).disabled).toBe(true);
    expect(within(own).getByText('Your own status and role can’t be changed here.')).toBeTruthy();
    expect(within(rowOf('New Store')).getByRole('combobox', { name: 'Status for New Store' }).disabled).toBe(false);
  });

  it('shows who approved an account and when, and its documents after approval (AW-197)', async () => {
    await openAccounts();
    const row = rowOf('Test Market LLC');
    expect(within(row).getByText(approvalLine(APPROVED, db.profiles))).toBeTruthy();
    expect(approvalLine(APPROVED, db.profiles)).toMatch(/^Approved Sep 2[89], 2026 by Olive Owner$/);
    expect(within(row).getByText('On file')).toBeTruthy();
    expect(within(rowOf('New Store')).getAllByText('Not on file')).toHaveLength(2);
    expect(approvalLine(PENDING, db.profiles)).toBeNull();
    expect(approvalLine({ ...APPROVED, approved_by: null }, db.profiles)).toMatch(/^Approved Sep 2[89], 2026$/);
  });

  it('approves an account made admin, and shows a refused change', async () => {
    await openAccounts();
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Role for New Store' }), { target: { value: 'admin' } });
    });
    expect(db.updates.at(-1)).toEqual({ table: 'profiles', id: 'buyer-2', patch: { role: 'admin', status: 'approved' } });
    db.updateResult = { data: null, error: { code: '42501', message: 'Only your name, phone and store address can be changed here' } };
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Status for Test Market LLC' }), { target: { value: 'suspended' } });
    });
    expect(screen.getByRole('alert').textContent).toBe('That change to Test Market LLC isn’t allowed.');
    db.updateResult = { data: [], error: null };
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Tier for Test Market LLC' }), { target: { value: 'standard' } });
    });
    expect(screen.getByRole('alert').textContent).toBe('The change to Test Market LLC wasn’t saved. Try again.');
  });
});
