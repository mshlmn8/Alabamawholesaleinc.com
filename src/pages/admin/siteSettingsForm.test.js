// Admin -> Site settings' form (AW-030): a row as the form's values, and the
// values back as a row, with null for what equals the site's own and the
// table's checks made first.
import { describe, expect, it } from 'vitest';
import { COMPANY } from '../../data/content.js';
import { SITE_DEFAULTS, defaultAnnouncements } from '../../data/siteFacts.js';
import { DEFAULT_DRAFT, draftChanged, draftFromRow, isOwn, rowFromDraft, shownAnnouncements, withOwn } from './siteSettingsForm.js';

const NULL_ROW = { announcements: null, phone: null, email: null, hours: null, street: null, city: null, state: null, zip: null };

describe('draftFromRow', () => {
  it('shows the site’s own values for an empty row', () => {
    expect(draftFromRow(null)).toEqual(DEFAULT_DRAFT);
    expect(DEFAULT_DRAFT).toMatchObject({ phone: COMPANY.phone, email: COMPANY.email, street: COMPANY.addressStreet, ownAnnouncements: true });
    expect(DEFAULT_DRAFT.announcements).toEqual(defaultAnnouncements());
    expect(DEFAULT_DRAFT.hours).toEqual(SITE_DEFAULTS.hours.map((h) => ({ ...h })));
  });

  it('shows staff’s values', () => {
    const draft = draftFromRow({ announcements: ['One'], phone: '(205) 555-0129', street: '1 Test St', city: 'Hoover', state: 'AL', zip: '35244' });
    expect(draft).toMatchObject({ announcements: ['One'], ownAnnouncements: false, phone: '(205) 555-0129', email: COMPANY.email, street: '1 Test St', zip: '35244' });
  });
});

describe('rowFromDraft', () => {
  it('saves nothing but nulls when everything is the site’s own', () => {
    expect(rowFromDraft(DEFAULT_DRAFT)).toEqual({ ok: true, errors: {}, row: NULL_ROW });
  });

  it('writes the phone the way the table keeps it, and staff’s other values trimmed', () => {
    const draft = {
      ...DEFAULT_DRAFT, phone: '205.555.0129', email: ' desk@example.test ', state: 'al', street: ' 1 Test St ', city: 'Hoover', zip: '35244-1234',
      announcements: [' Closed Monday ', 'Fresh stock'], ownAnnouncements: false,
      hours: [{ days: ' Mon–Fri ', time: ' 6 AM – 6 PM ' }],
    };
    expect(rowFromDraft(draft)).toEqual({
      ok: true,
      errors: {},
      row: {
        announcements: ['Closed Monday', 'Fresh stock'], phone: '(205) 555-0129', email: 'desk@example.test',
        hours: [{ days: 'Mon–Fri', time: '6 AM – 6 PM' }], street: '1 Test St', city: 'Hoover', state: 'AL', zip: '35244-1234',
      },
    });
  });

  it('keeps the site’s own messages (null) when only the phone changes, so they name the new phone', () => {
    const { row } = rowFromDraft({ ...DEFAULT_DRAFT, phone: '(205) 555-0129' });
    expect(row.announcements).toBeNull();
    expect(row.phone).toBe('(205) 555-0129');
    expect(shownAnnouncements({ ...DEFAULT_DRAFT, phone: '205 555 0129' }).at(-1)).toBe('For volume pricing, email us or call (205) 555-0129.');
    // Typed again exactly as the site has them, staff's messages are the site's own.
    expect(rowFromDraft({ ...DEFAULT_DRAFT, ownAnnouncements: false }).row.announcements).toBeNull();
  });

  it('names each field that fails its check', () => {
    const draft = {
      ...DEFAULT_DRAFT, phone: '555-0129', email: 'desk@', ownAnnouncements: false, announcements: ['ok', '  ', 'x'.repeat(161)],
      hours: [{ days: '', time: 'x'.repeat(41) }], street: '', city: '', state: 'Ala', zip: '3520',
    };
    const { ok, errors, row } = rowFromDraft(draft);
    expect(ok).toBe(false);
    expect(row).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['announcement:1', 'announcement:2', 'city', 'days:0', 'email', 'phone', 'state', 'street', 'time:0', 'zip'].sort());
    expect(errors.phone).toBe('Enter a 10-digit US phone number, area code first, such as (205) 555-0123.');
    expect(errors['announcement:1']).toBe('Write the message, or remove it.');
    expect(errors.zip).toBe('Enter a 5-digit ZIP code, or ZIP+4 (35203-1234).');
  });

  it('refuses no messages and too many messages or rows', () => {
    expect(rowFromDraft({ ...DEFAULT_DRAFT, ownAnnouncements: false, announcements: [] }).errors.announcements).toBe('Keep at least one message, or use the site’s own.');
    expect(rowFromDraft({ ...DEFAULT_DRAFT, ownAnnouncements: false, announcements: ['1', '2', '3', '4', '5', '6', '7'] }).errors.announcements).toBe('Use at most 6 messages.');
    expect(rowFromDraft({ ...DEFAULT_DRAFT, hours: [] }).errors.hours).toBe('Keep at least one row of hours.');
    const five = Array.from({ length: 5 }, () => ({ days: 'Mon', time: 'Closed' }));
    expect(rowFromDraft({ ...DEFAULT_DRAFT, hours: five }).errors.hours).toBe('Use at most 4 rows of hours.');
  });
});

describe('groups', () => {
  it('says which groups are the site’s own, and puts one back', () => {
    const draft = { ...DEFAULT_DRAFT, phone: '(205) 555-0129', city: 'Hoover', ownAnnouncements: false, announcements: ['One'] };
    expect(['announcements', 'contact', 'hours', 'address'].map((g) => isOwn(draft, g))).toEqual([false, false, true, false]);
    const back = withOwn(withOwn(draft, 'address'), 'announcements');
    expect(back.city).toBe(COMPANY.addressCity);
    expect(back.ownAnnouncements).toBe(true);
    expect(back.phone).toBe('(205) 555-0129');
    // The site's own messages follow the phone: their text isn't a change.
    expect(draftChanged(withOwn(back, 'contact'), DEFAULT_DRAFT)).toBe(false);
    expect(draftChanged(draft, DEFAULT_DRAFT)).toBe(true);
    expect(rowFromDraft(withOwn(back, 'contact')).row).toEqual(NULL_ROW);
  });
});
