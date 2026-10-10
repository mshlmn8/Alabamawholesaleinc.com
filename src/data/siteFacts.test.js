// The facts staff edit in Admin -> Site settings (AW-030): with no row they
// are content.js's exactly, so the site looks as before; a row's checked
// values replace them; a value that fails its check is ignored.
import { afterEach, describe, expect, it } from 'vitest';
import { ANNOUNCEMENTS, COMPANY, HOURS, VOLUME_PRICING, hoursLine } from './content.js';
import {
  DEFAULT_SITE, SITE_DEFAULTS, currentSite, defaultAnnouncements, normalizePhone, phoneRawOf, readSettings, setCurrentSite, siteFacts,
} from './siteFacts.js';

const plain = (text) => text.replace(/\u00A0/g, ' ').replace(/\u2060/g, '');
const ROW = {
  announcements: ['Closed Monday for the holiday', '  Fresh stock every week  '],
  phone: '(205) 555-0129',
  email: 'desk@example.test',
  hours: [{ days: 'Mon–Fri', time: '6:30 AM – 6 PM' }, { days: 'Sun', time: 'Closed' }],
  street: '100 Test Street', city: 'Hoover', state: 'AL', zip: '35244',
};

afterEach(() => setCurrentSite(null));

describe('siteFacts without a row', () => {
  it('is content.js’s COMPANY, hours and announcements', () => {
    for (const key of ['name', 'phone', 'phoneRaw', 'email', 'addressShort', 'addressLine1', 'addressLine2', 'addressStreet', 'addressCity',
      'addressState', 'addressZip', 'hoursLine1', 'hoursLine2']) {
      expect(DEFAULT_SITE[key], key).toBe(COMPANY[key]);
    }
    expect(DEFAULT_SITE.announcements).toEqual(ANNOUNCEMENTS.map((text) => text.replace(/^★\s*/, '')));
    expect(DEFAULT_SITE.volumePricing).toBe(VOLUME_PRICING);
    expect(DEFAULT_SITE.hoursLines).toEqual(HOURS.map((row) => hoursLine(row)));
    expect(DEFAULT_SITE.hoursCustom).toBe(false);
    expect(DEFAULT_SITE.hours.map((row) => [row.days, row.long])).toEqual(HOURS.map((row) => [row.days, row.long]));
    expect(siteFacts({})).toEqual(DEFAULT_SITE);
    expect(siteFacts({ phone: null, email: null })).toEqual(DEFAULT_SITE);
  });

  it('offers the site’s own values to the form', () => {
    expect(SITE_DEFAULTS).toMatchObject({ phone: COMPANY.phone, email: COMPANY.email, street: COMPANY.addressStreet, zip: COMPANY.addressZip });
    expect(SITE_DEFAULTS.hours.map((h) => `${h.days} ${h.time}`)).toEqual(HOURS.map((row) => hoursLine(row, { nowrap: false })));
  });
});

describe('siteFacts with staff’s row', () => {
  it('prints staff’s phone, email, address, hours and messages', () => {
    const site = siteFacts(ROW);
    expect(site.phone).toBe('(205) 555-0129');
    expect(site.phoneRaw).toBe('+12055550129');
    expect(site.email).toBe('desk@example.test');
    expect(site.addressLine1).toBe('100 Test Street');
    expect(site.addressLine2).toBe('Hoover, AL 35244');
    expect(site.addressShort).toBe('100 Test Street, Hoover, AL 35244');
    expect([site.addressStreet, site.addressCity, site.addressState, site.addressZip]).toEqual(['100 Test Street', 'Hoover', 'AL', '35244']);
    expect(site.announcements).toEqual(['Closed Monday for the holiday', 'Fresh stock every week']);
    expect(site.hoursCustom).toBe(true);
    expect(site.hoursLines.map(plain)).toEqual(['Mon–Fri 6:30 AM – 6 PM', 'Sun Closed']);
    expect(site.hours[0]).toMatchObject({ days: 'Mon–Fri', long: 'Mon–Fri' });
    // A time keeps its AM or PM on its line.
    expect(site.hours[0].time).toBe('6:30\u00A0AM – 6\u00A0PM');
    expect(site.volumePricing).toBe('For volume pricing, email us or call (205) 555-0129.');
    expect(site.name).toBe(COMPANY.name);
  });

  it('keeps the site’s own messages, naming staff’s phone, until staff write their own', () => {
    const site = siteFacts({ phone: '(205) 555-0129' });
    expect(site.announcements).toEqual(defaultAnnouncements('(205) 555-0129'));
    expect(site.announcements.at(-1)).toBe('For volume pricing, email us or call (205) 555-0129.');
  });

  it('ignores a value that fails its check, keeping the site’s own', () => {
    const bad = {
      announcements: [], phone: '205-555-0129', email: 'not an email', hours: [{ days: 'Mon' }], street: '1 Main', city: 'X', state: 'Alabama', zip: '35',
    };
    expect(readSettings(bad)).toEqual({ announcements: null, phone: null, email: null, hours: null, address: null });
    expect(siteFacts(bad)).toEqual(DEFAULT_SITE);
    expect(readSettings({ announcements: ['x'.repeat(161)] }).announcements).toBeNull();
    expect(readSettings({ announcements: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }).announcements).toBeNull();
    expect(readSettings(null).phone).toBeNull();
  });
});

describe('phones', () => {
  it('writes a typed US number the way the table keeps it', () => {
    for (const typed of ['205-555-0129', '(205) 555 0129', '+1 205 555 0129', '2055550129', ' 205.555.0129 ']) {
      expect(normalizePhone(typed), typed).toBe('(205) 555-0129');
    }
    for (const typed of ['555-0129', '205-555-01290', 'call me', '']) expect(normalizePhone(typed), typed).toBeNull();
    expect(phoneRawOf('(205) 555-0129')).toBe('+12055550129');
  });
});

describe('currentSite', () => {
  it('follows the store, and falls back to the site’s own', () => {
    expect(currentSite()).toBe(DEFAULT_SITE);
    const site = siteFacts(ROW);
    setCurrentSite(site);
    expect(currentSite()).toBe(site);
    setCurrentSite(null);
    expect(currentSite()).toBe(DEFAULT_SITE);
  });
});
