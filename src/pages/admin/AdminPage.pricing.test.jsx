// Admin -> Pricing with the fake client (AW-114): the tiers load into a
// table with the key read-only, the label and discount are checked, a save
// is one checked update per changed tier after a confirmation, and a refused
// save says so.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const TIERS = [
  { tier: 'standard', label: 'Standard', discount_pct: 0 },
  { tier: 'silver', label: 'Silver (5% off)', discount_pct: 5 },
  { tier: 'gold', label: 'Gold (10% off)', discount_pct: 10 },
];

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  fake.reset();
  fake.tables = { pricing_tiers: TIERS, profiles: [ADMIN], orders: [] };
});
afterEach(async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.restoreAllMocks();
});

const renderPricing = async () => {
  act(() => navigate('/admin/pricing', { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
};
const label = (tier) => screen.getByLabelText(`Label of the ${tier} tier`);
const pct = (tier) => screen.getByLabelText(`Discount of the ${tier} tier, in percent`);
const type = (box, value) => act(async () => { fireEvent.change(box, { target: { value } }); });
const save = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save tiers' })); });
const confirm = async () => {
  await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getAllByRole('button')[0]); });
};
const updates = () => fake.find({ table: 'pricing_tiers', op: 'update' });
const statusText = () => document.querySelector('.admin-status-text').textContent;

describe('Admin -> Pricing (AW-114)', () => {
  it('is a section of its own, listing each tier with its key read-only and its label and discount editable', async () => {
    await renderPricing();
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect(within(nav).getByRole('link', { name: 'Pricing' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Pricing tiers' })).toBeTruthy();
    expect(screen.getByText(/Approved buyers see the new prices on their next page load; orders already saved keep their prices\./)).toBeTruthy();
    const select = fake.find({ table: 'pricing_tiers', op: 'select' })[0];
    expect(select.columns).toBe('tier,label,discount_pct');
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['standard', 'silver', 'gold']);
    expect([label('silver').value, pct('silver').value]).toEqual(['Silver (5% off)', '5']);
    // No adding or removing tiers.
    expect(screen.queryByRole('button', { name: /add|remove|delete/i })).toBeNull();
  });

  it('checks the label and the discount before anything is sent', async () => {
    await renderPricing();
    await type(pct('silver'), '120');
    await type(label('gold'), ' ');
    await save();
    expect(pct('silver').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(pct('silver').getAttribute('aria-describedby')).textContent).toBe('Enter a discount from 0 to 99.99, with at most two decimals.');
    expect(document.getElementById(label('gold').getAttribute('aria-describedby')).textContent).toBe('Enter the tier’s label.');
    expect(document.activeElement).toBe(pct('silver'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(updates()).toHaveLength(0);
    await type(pct('silver'), '7.555');
    await save();
    expect(pct('silver').getAttribute('aria-invalid')).toBe('true');
  });

  it('saves each changed tier with a checked update after a confirmation', async () => {
    await renderPricing();
    await save();
    expect(screen.getByRole('alert').textContent).toBe('Nothing has changed.');
    await type(pct('silver'), '7');
    await type(label('silver'), 'Silver (7% off)');
    await save();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Save the silver tier?');
    expect(within(dialog).getByText(/^silver: discount 5% to 7%, label “Silver \(5% off\)” to “Silver \(7% off\)”\. Approved buyers/)).toBeTruthy();
    await confirm();
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).toMatchObject({ patch: { label: 'Silver (7% off)', discount_pct: 7 }, filters: [['eq', 'tier', 'silver']], returning: 'tier' });
    expect(statusText()).toBe('Saved the silver tier');
    expect(pct('silver').value).toBe('7');
    expect(screen.queryByRole('button', { name: 'Undo changes' })).toBeNull();
  });

  it('says when a save is refused, and keeps the change on screen', async () => {
    fake.respond = (request) => (request.table === 'pricing_tiers' && request.op === 'update' ? { data: [], error: null } : undefined);
    await renderPricing();
    await type(pct('gold'), '12');
    await save();
    await confirm();
    expect(screen.getByRole('alert').textContent).toBe('The gold tier wasn’t saved: your account isn’t allowed to change it, or it no longer exists.');
    expect(pct('gold').value).toBe('12');
    expect(screen.getByRole('button', { name: 'Undo changes' })).toBeTruthy();
  });

  it('says when the database refuses the discount', async () => {
    fake.respond = (request) => (request.table === 'pricing_tiers' && request.op === 'update'
      ? { data: null, error: { code: '23514', message: 'new row violates check constraint "pricing_tiers_discount_range"' } } : undefined);
    await renderPricing();
    await type(pct('gold'), '12');
    await save();
    await confirm();
    expect(screen.getByRole('alert').textContent).toBe('The gold tier wasn’t saved: a value is outside what the database accepts.');
  });

  it('shows a failed load with Try again', async () => {
    fake.respond = (request) => (request.table === 'pricing_tiers' ? { data: null, error: { code: 'XX000', message: 'upstream timeout' }, status: 500 } : undefined);
    await renderPricing();
    expect(screen.getByRole('alert').textContent).toMatch(/^The pricing tiers didn’t load/);
    fake.respond = null;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); });
    expect(label('standard').value).toBe('Standard');
  });
});
