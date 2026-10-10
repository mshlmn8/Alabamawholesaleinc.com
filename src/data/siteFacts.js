// The facts staff edit in Admin -> Site settings (AW-030, owner answer
// 2026-10): the announcement bar's messages, the public phone and email, the
// opening hours and the warehouse address. content.js holds the site's own
// values; they are the defaults, shown until the site_settings table
// (supabase/migrations/20261014121000_site_settings.sql) holds staff's, and
// whenever it can't be read (a database without it, an error, no backend).
// A value left as the site's own is stored as null, so it follows content.js.
//
//   readSettings(row)   a site_settings row, checked: each value that is
//                       missing or fails its check is null (the default)
//   siteFacts(row)      what the storefront prints: COMPANY's shape (phone,
//                       phoneRaw, email, addressLine1/2/Short, the address
//                       parts, hoursLine1/2) plus hours rows, hoursLines,
//                       announcements and volumePricing
//   currentSite()       the facts the site shows now (setCurrentSite is the
//                       store's, src/lib/siteSettings.js), for code outside
//                       React: error messages, order emails, the will-call
//                       address an order sends
//
// Pure and Node-safe (siteFacts.test.js); the table is loaded by
// src/lib/siteSettings.js and edited by src/pages/admin/SiteSettingsSection.jsx.
// The structured data and boot shell in index.html, the route heads written
// at build time and the web manifest keep content.js's values: they are
// built into the site, not read from the table.

import { COMPANY, HOURS, TIME_ZONE_LABEL, announcementsFor, hoursLine, hoursRange, volumePricingText } from './content.js';
import { usPhone } from '../lib/phone.js';

const NBSP = '\u00A0';

// The limits the table's checks and the form share.
export const SETTINGS_LIMITS = Object.freeze({
  announcements: 6, announcement: 160, hours: 4, days: 40, time: 40, email: 254, street: 100, city: 60,
});
// As stored: '(205) 458-4788'. normalizePhone() writes it.
export const PHONE_FORMAT = /^\(\d{3}\) \d{3}-\d{4}$/;
// Something@something.tld, no spaces: what a mailto: link needs.
export const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
export const STATE_FORMAT = /^[A-Z]{2}$/;
export const ZIP_FORMAT = /^\d{5}(-\d{4})?$/;

// '205-458-4788', '(205) 458 4788', '+1 205 458 4788' -> '(205) 458-4788';
// null for anything that isn't a ten-digit US number (src/lib/phone.js).
export const normalizePhone = (text) => usPhone(String(text ?? '').trim())?.formatted ?? null;
// '(205) 458-4788' -> '+12054584788', for tel: links.
export const phoneRawOf = (phone) => `+1${String(phone).replace(/\D/g, '').slice(-10)}`;

const stripStar = (text) => text.replace(/^★\s*/, '');
// The trade bar's announcements as the site has them, naming `phone`.
export const defaultAnnouncements = (phone = COMPANY.phone) => announcementsFor(phone).map(stripStar);

// The site's own values, as the settings form shows them.
export const SITE_DEFAULTS = Object.freeze({
  phone: COMPANY.phone,
  email: COMPANY.email,
  street: COMPANY.addressStreet,
  city: COMPANY.addressCity,
  state: COMPANY.addressState,
  zip: COMPANY.addressZip,
  hours: Object.freeze(HOURS.map((row) => Object.freeze({ days: row.days, time: `${hoursRange(row, { nowrap: false })} ${TIME_ZONE_LABEL}` }))),
});

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const lineOk = (value, max) => text(value).length > 0 && String(value).length <= max;

// Each value of a site_settings row, checked as the table checks it; null
// for a value that is missing or wrong (the site's own is shown then).
export function readSettings(row) {
  const r = row && typeof row === 'object' ? row : {};
  const announcements = Array.isArray(r.announcements)
    && r.announcements.length >= 1 && r.announcements.length <= SETTINGS_LIMITS.announcements
    && r.announcements.every((line) => lineOk(line, SETTINGS_LIMITS.announcement))
    ? r.announcements.map(text) : null;
  const phone = typeof r.phone === 'string' && PHONE_FORMAT.test(r.phone) ? r.phone : null;
  const email = typeof r.email === 'string' && r.email.length <= SETTINGS_LIMITS.email && EMAIL_FORMAT.test(r.email) ? r.email : null;
  const hours = Array.isArray(r.hours) && r.hours.length >= 1 && r.hours.length <= SETTINGS_LIMITS.hours
    && r.hours.every((h) => h && lineOk(h.days, SETTINGS_LIMITS.days) && lineOk(h.time, SETTINGS_LIMITS.time))
    ? r.hours.map((h) => ({ days: text(h.days), time: text(h.time) })) : null;
  const address = lineOk(r.street, SETTINGS_LIMITS.street) && lineOk(r.city, SETTINGS_LIMITS.city)
    && STATE_FORMAT.test(r.state ?? '') && ZIP_FORMAT.test(r.zip ?? '')
    ? { street: text(r.street), city: text(r.city), state: r.state, zip: r.zip } : null;
  return { announcements, phone, email, hours, address };
}

// A time that doesn't break inside itself: '7:00 AM' keeps its AM.
const keepTimes = (value) => value.replace(/(\d) ?([AaPp]\.?[Mm]\.?)(?=\W|$)/g, `$1${NBSP}$2`);

// The facts the storefront prints, from a site_settings row (or null for the
// site's own). With no row they equal content.js's COMPANY, HOURS and
// ANNOUNCEMENTS exactly.
export function siteFacts(row) {
  const s = readSettings(row);
  const phone = s.phone || COMPANY.phone;
  const email = s.email || COMPANY.email;
  const address = s.address
    ? {
      addressStreet: s.address.street, addressCity: s.address.city, addressState: s.address.state, addressZip: s.address.zip,
      addressLine1: s.address.street,
      addressLine2: `${s.address.city}, ${s.address.state} ${s.address.zip}`,
      addressShort: `${s.address.street}, ${s.address.city}, ${s.address.state} ${s.address.zip}`,
    }
    : {
      addressStreet: COMPANY.addressStreet, addressCity: COMPANY.addressCity, addressState: COMPANY.addressState, addressZip: COMPANY.addressZip,
      addressLine1: COMPANY.addressLine1, addressLine2: COMPANY.addressLine2, addressShort: COMPANY.addressShort,
    };
  // Hours rows: days (short), long (the contact page's label), range (the
  // times alone) and time (with the zone, as the footer prints them).
  // Staff's own rows are free text, so `custom` tells pages not to work out
  // "Open now" from the site's schedule.
  const hours = s.hours
    ? s.hours.map((h) => ({ days: h.days, long: h.days, range: keepTimes(h.time), time: keepTimes(h.time) }))
    : HOURS.map((row) => ({ days: row.days, long: row.long, range: hoursRange(row), time: `${hoursRange(row)}${NBSP}${TIME_ZONE_LABEL}` }));
  const hoursLines = s.hours ? s.hours.map((h) => `${h.days} ${keepTimes(h.time)}`) : HOURS.map((row) => hoursLine(row));
  return Object.freeze({
    name: COMPANY.name,
    phone,
    phoneRaw: s.phone ? phoneRawOf(phone) : COMPANY.phoneRaw,
    email,
    ...address,
    hours,
    hoursCustom: !!s.hours,
    hoursLines,
    hoursLine1: hoursLines[0] || '',
    hoursLine2: hoursLines[1] || '',
    announcements: s.announcements || defaultAnnouncements(phone),
    volumePricing: volumePricingText(phone),
  });
}

export const DEFAULT_SITE = siteFacts(null);

// The facts on screen now, for code outside React. The store
// (src/lib/siteSettings.js) sets them when the table loads.
let current = DEFAULT_SITE;
export const currentSite = () => current;
export const setCurrentSite = (site) => { current = site || DEFAULT_SITE; };
