// The site settings store (AW-030): one read of public.site_settings, whose
// values replace content.js's; a database without the table, an error or no
// backend keep content.js's; Admin's save shows at once. With the fake
// client (src/pages/admin/fakeSupabase.js); nothing on the network.
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createFakeSupabase } from '../pages/admin/fakeSupabase.js';
import { COMPANY } from '../data/content.js';
import { DEFAULT_SITE, currentSite } from '../data/siteFacts.js';
import { getSiteSettingsState, refreshSiteSettings, resetSiteSettingsForTests, showSiteSettings, useSite } from './siteSettings.js';

const ROW = { announcements: ['Closed Monday'], phone: '(205) 555-0129', email: 'desk@example.test', hours: null, street: null, city: null, state: null, zip: null };

function Phone() {
  const site = useSite();
  return <p data-testid="phone">{site.phone}</p>;
}
const phone = () => screen.getByTestId('phone').textContent;
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => resetSiteSettingsForTests({ client: null }));

describe('useSite', () => {
  it('shows content.js’s values, then the row’s once it loads', async () => {
    const fake = createFakeSupabase({ tables: { site_settings: [ROW] } });
    resetSiteSettingsForTests({ client: fake.client });
    render(<Phone />);
    expect(phone()).toBe(COMPANY.phone);
    await settle();
    expect(phone()).toBe('(205) 555-0129');
    expect(currentSite().email).toBe('desk@example.test');
    expect(getSiteSettingsState().status).toBe('live');
    const [request] = fake.find({ table: 'site_settings' });
    expect(request).toMatchObject({ op: 'select', single: 'maybe', filters: [['eq', 'id', true]] });
    expect(request.columns).toBe('announcements,phone,email,hours,street,city,state,zip,updated_at');
  });

  it('reads the table once a page load, however many components ask', async () => {
    const fake = createFakeSupabase({ tables: { site_settings: [ROW] } });
    resetSiteSettingsForTests({ client: fake.client });
    render(<><Phone /><Phone /></>);
    await settle();
    render(<Phone />);
    await settle();
    expect(fake.find({ table: 'site_settings' })).toHaveLength(1);
  });

  it('keeps content.js’s values on a database without the table, an error or no backend', async () => {
    for (const error of [{ code: 'PGRST205', message: 'Could not find the table' }, { code: '42P01' }, { code: 'XX000', message: 'boom' }]) {
      const fake = createFakeSupabase({ respond: () => ({ data: null, error }) });
      resetSiteSettingsForTests({ client: fake.client });
      const view = render(<Phone />);
      await settle();
      expect(phone()).toBe(COMPANY.phone);
      expect(getSiteSettingsState().status).toBe(error.code === 'XX000' ? 'error' : 'missing');
      view.unmount();
    }
    resetSiteSettingsForTests({ client: null });
    render(<Phone />);
    await settle();
    expect(getSiteSettingsState().status).toBe('static');
    expect(currentSite()).toBe(DEFAULT_SITE);
  });

  it('keeps content.js’s values for an empty row, and shows Admin’s save at once', async () => {
    const fake = createFakeSupabase({ tables: { site_settings: [] } });
    resetSiteSettingsForTests({ client: fake.client });
    render(<Phone />);
    await settle();
    expect(phone()).toBe(COMPANY.phone);
    act(() => showSiteSettings(ROW));
    expect(phone()).toBe('(205) 555-0129');
    fake.tables.site_settings = [{ ...ROW, phone: '(205) 555-0130' }];
    await act(async () => { await refreshSiteSettings(); });
    expect(phone()).toBe('(205) 555-0130');
  });
});
