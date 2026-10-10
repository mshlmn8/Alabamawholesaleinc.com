// Admin -> Site settings (AW-030): it loads the one row, shows the site's own
// values for an empty one, checks the phone, email and the rest before it
// saves, saves null for what equals the site's own, shows the save on the
// storefront at once, and on a database without the table says it needs the
// update. With the fake client (fakeSupabase.js).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { SETTINGS_MISSING, SETTINGS_SAVED } = await import('./SiteSettingsSection.jsx');
const { COMPANY } = await import('../../data/content.js');
const { currentSite } = await import('../../data/siteFacts.js');
const { resetSiteSettingsForTests } = await import('../../lib/siteSettings.js');
const { navigate } = await import('../../lib/router.js');

const STAFF = { id: 'staff-1', name: 'Sam Staff', business: 'Desk Staff', email: 'sam@example.test', role: 'staff', status: 'approved', pricing_tier: 'standard' };
const EMPTY = { announcements: null, phone: null, email: null, hours: null, street: null, city: null, state: null, zip: null, updated_at: '2026-10-14T12:00:00Z', updated_by: null };

beforeEach(() => {
  act(() => navigate('/admin/settings', { replace: true }));
  fake.reset();
  resetSiteSettingsForTests({ client: null });
  fake.tables = { site_settings: [EMPTY], orders: [] };
});

const open = async () => {
  await act(async () => { render(<AdminPage profile={STAFF} account="ready" route={{ page: 'admin', section: 'settings', query: {} }} />); });
  return screen.getByRole('form', { name: 'Site settings' });
};
const group = (legend) => screen.getByRole('group', { name: legend });
const saves = () => fake.find({ table: 'site_settings', op: 'update' });
const save = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save site settings' })); });
const type = (field, value) => act(async () => { fireEvent.change(field, { target: { value } }); });

describe('Admin -> Site settings (AW-030)', () => {
  it('shows the site’s own values for an empty row, with Save off until something changes', async () => {
    await open();
    expect(within(group('Phone and email')).getByLabelText('Public phone').value).toBe(COMPANY.phone);
    expect(within(group('Phone and email')).getByLabelText('Public email').value).toBe(COMPANY.email);
    expect(within(group('Warehouse address')).getByLabelText('Street').value).toBe(COMPANY.addressStreet);
    const messages = within(group('Announcement bar')).getAllByRole('textbox');
    expect(messages).toHaveLength(3);
    expect(messages[2].value).toBe(`For volume pricing, email us or call ${COMPANY.phone}.`);
    expect(screen.getByRole('button', { name: 'Save site settings' }).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Use the site’s own/ })).toBeNull();
    const [read] = fake.find({ table: 'site_settings', op: 'select' });
    expect(read).toMatchObject({ single: 'maybe', filters: [['eq', 'id', true]] });
  });

  it('checks the phone and email before saving, and focuses the first problem', async () => {
    await open();
    const phone = within(group('Phone and email')).getByLabelText('Public phone');
    const email = within(group('Phone and email')).getByLabelText('Public email');
    await type(phone, '555-0129');
    await type(email, 'desk@');
    await save();
    expect(saves()).toHaveLength(0);
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(phone.getAttribute('aria-describedby').split(' ').at(-1)).textContent)
      .toBe('Enter a 10-digit US phone number, area code first, such as (205) 555-0123.');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(phone);
  });

  it('saves staff’s values, null for what is the site’s own, and the storefront shows them at once', async () => {
    fake.respond = (request) => (request.table === 'site_settings' && request.op === 'update'
      ? { data: [{ ...EMPTY, ...request.patch, updated_at: '2026-10-14T13:00:00Z', updated_by: 'staff-1' }], error: null }
      : undefined);
    await open();
    await type(within(group('Phone and email')).getByLabelText('Public phone'), '205.555.0129');
    const announcements = group('Announcement bar');
    await type(within(announcements).getAllByRole('textbox')[0], 'Closed Monday for the holiday');
    await act(async () => { fireEvent.click(within(announcements).getByRole('button', { name: 'Add a message' })); });
    expect(document.activeElement).toBe(within(announcements).getAllByRole('textbox')[3]);
    await type(document.activeElement, 'New candy in stock');
    const hours = group('Opening hours');
    await type(within(hours).getByLabelText('Hours, row 2'), 'Closed');
    await save();
    expect(saves()).toHaveLength(1);
    const [request] = saves();
    expect(request.filters).toEqual([['eq', 'id', true]]);
    expect(request.patch).toEqual({
      announcements: [
        'Closed Monday for the holiday',
        'WILL-CALL · Pickup at the Birmingham warehouse during business hours',
        'For volume pricing, email us or call (205) 555-0129.',
        'New candy in stock',
      ],
      phone: '(205) 555-0129',
      email: null,
      hours: [{ days: 'Mon–Fri', time: expect.any(String) }, { days: 'Sat–Sun', time: 'Closed' }],
      street: null, city: null, state: null, zip: null,
    });
    expect(document.querySelector('.admin-status-text').textContent).toBe(SETTINGS_SAVED);
    expect(currentSite().phone).toBe('(205) 555-0129');
    expect(currentSite().announcements[0]).toBe('Closed Monday for the holiday');
    expect(within(group('Phone and email')).getByLabelText('Public phone').value).toBe('(205) 555-0129');
    expect(screen.getByRole('button', { name: 'Save site settings' }).disabled).toBe(true);
  });

  it('puts a group back to the site’s own values', async () => {
    fake.tables.site_settings = [{ ...EMPTY, street: '100 Test Street', city: 'Hoover', state: 'AL', zip: '35244' }];
    await open();
    const address = group('Warehouse address');
    expect(within(address).getByLabelText('Street').value).toBe('100 Test Street');
    await act(async () => { fireEvent.click(within(address).getByRole('button', { name: 'Use the site’s own address' })); });
    expect(within(address).getByLabelText('Street').value).toBe(COMPANY.addressStreet);
    await save();
    expect(saves()[0].patch).toMatchObject({ street: null, city: null, state: null, zip: null });
  });

  it('says it needs the database update, and shows the site’s own values without Save, on a database without the table', async () => {
    fake.respond = (request) => (request.table === 'site_settings' ? { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } } : undefined);
    await open();
    expect(screen.getByText(SETTINGS_MISSING)).toBeTruthy();
    expect(within(group('Phone and email')).getByLabelText('Public phone').value).toBe(COMPANY.phone);
    expect(group('Phone and email').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save site settings' })).toBeNull();
  });

  it('says a refused save in staff wording', async () => {
    fake.respond = (request) => (request.table === 'site_settings' && request.op === 'update' ? { data: [], error: null } : (
      request.table === 'site_settings' && request.op === 'insert' ? { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } } : undefined));
    await open();
    await type(within(group('Phone and email')).getByLabelText('Public email'), 'desk@example.test');
    await save();
    expect(screen.getByRole('alert').textContent).toBe('The settings weren’t saved: your account isn’t allowed to do that.');
  });
});
