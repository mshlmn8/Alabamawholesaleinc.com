// Admin -> Site settings' form (AW-030): a site_settings row as the form's
// values, and the form's values back as a row, checked. Pure
// (siteSettingsForm.test.js); SiteSettingsSection.jsx renders it.
//
//   draftFromRow(row)    the form's values: the row's, or the site's own
//   rowFromDraft(draft)  { ok, errors, row }: the row to save, with null
//                        for every value that equals the site's own (so
//                        it keeps following src/data/content.js)
//   draftChanged(a, b)   whether two drafts differ
//
// A draft: { announcements: [text], ownAnnouncements, phone, email,
// hours: [{ days, time }], street, city, state, zip }. ownAnnouncements:
// the bar shows the site's own messages, whose volume-pricing line names the
// phone in the form as it changes; editing a message ends that.

import {
  EMAIL_FORMAT, SETTINGS_LIMITS, SITE_DEFAULTS, STATE_FORMAT, ZIP_FORMAT, defaultAnnouncements, normalizePhone, readSettings,
} from '../../data/siteFacts.js';

export const SITE_SETTINGS_SELECT = 'announcements,phone,email,hours,street,city,state,zip,updated_at,updated_by';

const text = (value) => (value == null ? '' : String(value));
const trim = (value) => text(value).trim();

// The phone the form's own messages name: the typed one once it is a
// valid number, else the saved one.
export const messagesPhone = (draft, fallback = SITE_DEFAULTS.phone) => normalizePhone(draft.phone) || fallback;

// The messages the form shows: the site's own (naming the form's phone) or
// staff's.
export const shownAnnouncements = (draft, fallbackPhone) => (draft.ownAnnouncements
  ? defaultAnnouncements(messagesPhone(draft, fallbackPhone))
  : draft.announcements);

export function draftFromRow(row) {
  const s = readSettings(row);
  const phone = s.phone || SITE_DEFAULTS.phone;
  const address = s.address || SITE_DEFAULTS;
  return {
    announcements: s.announcements ? [...s.announcements] : defaultAnnouncements(phone),
    ownAnnouncements: !s.announcements,
    phone,
    email: s.email || SITE_DEFAULTS.email,
    hours: (s.hours || SITE_DEFAULTS.hours).map((h) => ({ days: h.days, time: h.time })),
    street: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
  };
}

// The site's own values, as a draft (the form's "Use the site's own" buttons).
export const DEFAULT_DRAFT = Object.freeze(draftFromRow(null));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The field each error belongs to: phone, email, announcement:<i>,
// announcements, days:<i>, time:<i>, hours, street, city, state, zip.
export function rowFromDraft(draft) {
  const errors = {};
  const L = SETTINGS_LIMITS;

  const phone = normalizePhone(draft.phone);
  if (!phone) errors.phone = 'Enter a 10-digit US phone number, area code first, such as (205) 555-0123.';

  const email = trim(draft.email);
  if (!email) errors.email = 'Enter the email address buyers should write to.';
  else if (email.length > L.email || !EMAIL_FORMAT.test(email)) errors.email = 'Enter an email address such as orders@example.com.';

  const messages = (draft.ownAnnouncements ? defaultAnnouncements(phone || SITE_DEFAULTS.phone) : draft.announcements).map(trim);
  if (!draft.ownAnnouncements) {
    if (messages.length < 1) errors.announcements = 'Keep at least one message, or use the site’s own.';
    if (messages.length > L.announcements) errors.announcements = `Use at most ${L.announcements} messages.`;
    messages.forEach((m, i) => {
      if (!m) errors[`announcement:${i}`] = 'Write the message, or remove it.';
      else if (m.length > L.announcement) errors[`announcement:${i}`] = `Keep a message to ${L.announcement} characters.`;
    });
  }

  const hours = (draft.hours || []).map((h) => ({ days: trim(h.days), time: trim(h.time) }));
  if (hours.length < 1) errors.hours = 'Keep at least one row of hours.';
  if (hours.length > L.hours) errors.hours = `Use at most ${L.hours} rows of hours.`;
  hours.forEach((h, i) => {
    if (!h.days) errors[`days:${i}`] = 'Enter the days, such as Mon–Fri.';
    else if (h.days.length > L.days) errors[`days:${i}`] = `Keep the days to ${L.days} characters.`;
    if (!h.time) errors[`time:${i}`] = 'Enter the hours, or Closed.';
    else if (h.time.length > L.time) errors[`time:${i}`] = `Keep the hours to ${L.time} characters.`;
  });

  const street = trim(draft.street);
  const city = trim(draft.city);
  const state = trim(draft.state).toUpperCase();
  const zip = trim(draft.zip);
  if (!street) errors.street = 'Enter the street address.';
  else if (street.length > L.street) errors.street = `Keep the street to ${L.street} characters.`;
  if (!city) errors.city = 'Enter the city.';
  else if (city.length > L.city) errors.city = `Keep the city to ${L.city} characters.`;
  if (!STATE_FORMAT.test(state)) errors.state = 'Enter the state’s two letters, such as AL.';
  if (!ZIP_FORMAT.test(zip)) errors.zip = 'Enter a 5-digit ZIP code, or ZIP+4 (35203-1234).';

  if (Object.keys(errors).length) return { ok: false, errors, row: null };
  const ownAddress = same([street, city, state, zip], [SITE_DEFAULTS.street, SITE_DEFAULTS.city, SITE_DEFAULTS.state, SITE_DEFAULTS.zip]);
  return {
    ok: true,
    errors,
    row: {
      announcements: draft.ownAnnouncements || same(messages, defaultAnnouncements(phone)) ? null : messages,
      phone: phone === SITE_DEFAULTS.phone ? null : phone,
      email: email === SITE_DEFAULTS.email ? null : email,
      hours: same(hours, SITE_DEFAULTS.hours) ? null : hours,
      street: ownAddress ? null : street,
      city: ownAddress ? null : city,
      state: ownAddress ? null : state,
      zip: ownAddress ? null : zip,
    },
  };
}

// The groups of the form, for "Use the site's own" and for saying which
// ones differ from it.
export const GROUPS = Object.freeze({
  announcements: ['announcements', 'ownAnnouncements'],
  contact: ['phone', 'email'],
  hours: ['hours'],
  address: ['street', 'city', 'state', 'zip'],
});

// Whether a group of the draft holds the site's own values.
export function isOwn(draft, group) {
  if (group === 'announcements') return draft.ownAnnouncements;
  return GROUPS[group].every((key) => same(draft[key], DEFAULT_DRAFT[key]));
}

// The draft with a group back to the site's own values.
export function withOwn(draft, group) {
  const next = { ...draft };
  for (const key of GROUPS[group]) next[key] = Array.isArray(DEFAULT_DRAFT[key]) ? DEFAULT_DRAFT[key].map((v) => (typeof v === 'object' ? { ...v } : v)) : DEFAULT_DRAFT[key];
  if (group === 'announcements') next.announcements = defaultAnnouncements(messagesPhone(draft));
  return next;
}

// The site's own messages follow the phone, so their text isn't compared.
const comparable = (draft) => (draft.ownAnnouncements ? { ...draft, announcements: null } : draft);
export const draftChanged = (a, b) => !same(comparable(a), comparable(b));
