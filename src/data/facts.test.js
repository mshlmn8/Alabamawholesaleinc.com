// Business facts are defined once, in src/data/content.js (AW-283), and the
// hours carry the time zone and never wrap mid-range (AW-275). index.html and
// public/site.webmanifest repeat some facts for the boot shell, structured
// data and install metadata; they must agree with content.js. Everything else
// prints the constants, so no source file may type a fact as a literal.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COMPANY, FREE_DELIVERY_THRESHOLD, HOURS, ORDER_MINIMUM, TIME_ZONE, TIME_ZONE_LABEL, TIME_ZONE_NAME,
  clockLabel, hoursLine, hoursRange, openStatus, openStatusLabel,
} from './content.js';
import { formatMoney, formatMoneyShort } from '../lib/format.js';

// Vitest runs from the repository root.
const ROOT = process.cwd();
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
const NBSP = '\u00A0';
const WJ = '\u2060';
const plain = (text) => text.replace(/\u00A0/g, ' ').replace(/\u2060/g, '');

describe('hours (AW-275)', () => {
  it('prints 24-hour times on a 12-hour clock', () => {
    expect(clockLabel('00:00')).toBe('12:00 AM');
    expect(clockLabel('07:00')).toBe('7:00 AM');
    expect(clockLabel('11:59')).toBe('11:59 AM');
    expect(clockLabel('12:00')).toBe('12:00 PM');
    expect(clockLabel('17:30')).toBe('5:30 PM');
    expect(clockLabel('18:00')).toBe('6:00 PM');
    expect(clockLabel('23:05')).toBe('11:05 PM');
  });

  it('builds a range and a line from a row of HOURS', () => {
    expect(hoursRange(HOURS[0], { nowrap: false })).toBe('7:00 AM – 6:00 PM');
    expect(hoursRange(HOURS[1], { nowrap: false })).toBe('8:00 AM – 5:30 PM');
    expect(plain(hoursRange(HOURS[0]))).toBe('7:00 AM – 6:00 PM');
    expect(hoursRange(HOURS[0])).toBe(`7:00${NBSP}AM${NBSP}–${WJ}${NBSP}6:00${NBSP}PM`);
    expect(hoursLine(HOURS[0], { nowrap: false })).toBe('Mon–Fri 7:00 AM – 6:00 PM CT');
    expect(hoursLine(HOURS[1], { nowrap: false, zone: false })).toBe('Sat–Sun 8:00 AM – 5:30 PM');
    expect(plain(hoursLine(HOURS[1]))).toBe('Sat–Sun 8:00 AM – 5:30 PM CT');
  });

  it('gives COMPANY hours lines that name the time zone and cannot wrap inside', () => {
    expect([TIME_ZONE, TIME_ZONE_LABEL, TIME_ZONE_NAME]).toEqual(['America/Chicago', 'CT', 'Central Time']);
    for (const [line, row] of [[COMPANY.hoursLine1, HOURS[0]], [COMPANY.hoursLine2, HOURS[1]]]) {
      expect(line).toBe(hoursLine(row));
      expect(line).not.toMatch(/[ \t\n]/);
      expect(line.endsWith(`${NBSP}${TIME_ZONE_LABEL}`)).toBe(true);
      // A word joiner after the day-range dash ('Mon–|Fri') and after the
      // time-range dash ('AM –| 6:00'), so no browser breaks after either.
      expect(line.startsWith(`${row.days.replace('–', `–${WJ}`)}${NBSP}`)).toBe(true);
      expect(line.split('–').length - 1).toBe(2);
      expect(line.split(`–${WJ}`).length - 1).toBe(2);
    }
  });

  it('lists every day of the week once', () => {
    const days = HOURS.flatMap(row => row.dayOfWeek);
    expect(days).toHaveLength(7);
    expect(new Set(days).size).toBe(7);
    for (const row of HOURS) {
      expect(row.opens).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(row.closes).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(row.opens < row.closes).toBe(true);
    }
  });
});

describe('open now (AW-275)', () => {
  const at = (iso) => openStatus(new Date(iso));
  const label = (iso) => plain(openStatusLabel(at(iso)));

  it('is open from the opening minute up to, not including, the closing minute on a weekday', () => {
    // Wednesday 7 October 2026, Central Daylight Time (UTC−5).
    expect(at('2026-10-07T05:00:00Z')).toEqual({ open: false, opens: '07:00', inDays: 0, day: 'Wednesday' });
    expect(at('2026-10-07T11:59:00Z')).toEqual({ open: false, opens: '07:00', inDays: 0, day: 'Wednesday' });
    expect(at('2026-10-07T12:00:00Z')).toEqual({ open: true, closes: '18:00' });
    expect(at('2026-10-07T22:59:00Z')).toEqual({ open: true, closes: '18:00' });
    expect(at('2026-10-07T23:00:00Z')).toEqual({ open: false, opens: '07:00', inDays: 1, day: 'Thursday' });
  });

  it('uses the weekend hours on Saturday and Sunday', () => {
    expect(at('2026-10-09T23:30:00Z')).toEqual({ open: false, opens: '08:00', inDays: 1, day: 'Saturday' });
    expect(at('2026-10-10T12:59:00Z')).toEqual({ open: false, opens: '08:00', inDays: 0, day: 'Saturday' });
    expect(at('2026-10-10T13:00:00Z')).toEqual({ open: true, closes: '17:30' });
    expect(at('2026-10-10T22:29:00Z')).toEqual({ open: true, closes: '17:30' });
    expect(at('2026-10-10T22:30:00Z')).toEqual({ open: false, opens: '08:00', inDays: 1, day: 'Sunday' });
    expect(at('2026-10-11T22:30:00Z')).toEqual({ open: false, opens: '07:00', inDays: 1, day: 'Monday' });
  });

  it('follows the Central Time clock across daylight saving changes', () => {
    // Clocks went forward on Sunday 8 March 2026: 12:00 UTC is 6:00 AM CST on
    // the Friday before and 7:00 AM CDT on the Monday after.
    expect(at('2026-03-06T12:00:00Z').open).toBe(false);
    expect(at('2026-03-09T12:00:00Z')).toEqual({ open: true, closes: '18:00' });
    // Clocks go back on Sunday 1 November 2026: 13:30 UTC is 8:30 AM CDT on
    // Saturday but 7:30 AM CST on Sunday.
    expect(at('2026-10-31T13:30:00Z').open).toBe(true);
    expect(at('2026-11-01T13:30:00Z')).toEqual({ open: false, opens: '08:00', inDays: 0, day: 'Sunday' });
    expect(at('2026-11-01T14:00:00Z')).toEqual({ open: true, closes: '17:30' });
  });

  it('reads the clock in the time zone it is given', () => {
    // 7:30 AM in Birmingham is 8:30 AM in Atlanta.
    expect(openStatus(new Date('2026-10-10T12:30:00Z'), HOURS, 'America/New_York')).toEqual({ open: true, closes: '17:30' });
    expect(openStatus(new Date('2026-10-10T12:30:00Z'), HOURS, TIME_ZONE).open).toBe(false);
  });

  it('finds the next open day past days without hours', () => {
    const mondays = [{ dayOfWeek: ['Monday'], opens: '09:00', closes: '17:00' }];
    expect(openStatus(new Date('2026-10-09T23:30:00Z'), mondays)).toEqual({ open: false, opens: '09:00', inDays: 3, day: 'Monday' });
    expect(openStatus(new Date('2026-10-12T23:30:00Z'), mondays)).toEqual({ open: false, opens: '09:00', inDays: 7, day: 'Monday' });
    expect(openStatus(new Date('2026-10-12T23:30:00Z'), [])).toBeNull();
  });

  it('says it with the time zone, on one unbreakable time', () => {
    expect(label('2026-10-07T12:00:00Z')).toBe('Open now · closes 6:00 PM CT');
    expect(label('2026-10-10T12:59:00Z')).toBe('Closed · opens 8:00 AM CT');
    expect(label('2026-10-07T23:00:00Z')).toBe('Closed · opens tomorrow 7:00 AM CT');
    expect(plain(openStatusLabel({ open: false, opens: '09:00', inDays: 3, day: 'Monday' }))).toBe('Closed · opens Monday 9:00 AM CT');
    expect(openStatusLabel(null)).toBe('');
    expect(openStatusLabel(at('2026-10-07T12:00:00Z'))).toMatch(/closes 6:00\u00A0PM\u00A0CT$/);
  });
});

describe('index.html and the web manifest agree with content.js (AW-283)', () => {
  const html = read('index.html');
  const ldJson = () => {
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    return JSON.parse(match[1]);
  };
  const digits = (text) => String(text).replace(/\D/g, '');
  const textOf = (fragment) => fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  it('structured data names the business, phone, email and address from COMPANY', () => {
    const data = ldJson();
    expect(data.name).toBe(COMPANY.name);
    expect(digits(data.telephone)).toBe(digits(COMPANY.phoneRaw));
    expect(data.email).toBe(COMPANY.email);
    expect(data.address).toMatchObject({
      streetAddress: COMPANY.addressStreet,
      addressLocality: COMPANY.addressCity,
      addressRegion: COMPANY.addressState,
      postalCode: COMPANY.addressZip,
    });
  });

  it('structured data opening hours are HOURS', () => {
    const spec = ldJson().openingHoursSpecification.map(({ dayOfWeek, opens, closes }) => ({ dayOfWeek, opens, closes }));
    expect(spec).toEqual(HOURS.map(({ dayOfWeek, opens, closes }) => ({ dayOfWeek, opens, closes })));
  });

  it('the boot shell help line and the noscript message give the phone and email', () => {
    const bootHelp = /<p class="boot-help">([\s\S]*?)<\/p>/.exec(html)[1];
    const noscript = html.slice(html.indexOf('<noscript>\n'), html.indexOf('</noscript>', html.indexOf('<noscript>\n')));
    for (const text of [textOf(bootHelp), textOf(noscript)]) {
      expect(text).toContain(COMPANY.phone);
      expect(text).toContain(COMPANY.email);
    }
  });

  it('the web manifest is named COMPANY.name', () => {
    expect(JSON.parse(read('public/site.webmanifest')).name).toBe(COMPANY.name);
  });
});

// The facts typed out: as published when this check was written, and as
// content.js has them now. A file that needs one prints the constant instead:
// formatMoney(ORDER_MINIMUM), formatMoneyShort(FREE_DELIVERY_THRESHOLD),
// COMPANY.phone, COMPANY.addressLine1, and COMPANY.hoursLine1/2 or
// hoursRange()/hoursLine() with HOURS.
const LITERALS = [...new Set([
  '$500.00', '$1,500', '354-4473', '613 Graymont', '7:00 AM', '5:30 PM',
  formatMoney(ORDER_MINIMUM),
  formatMoneyShort(FREE_DELIVERY_THRESHOLD),
  COMPANY.phone.slice(-8),
  COMPANY.addressLine1.split(' ').slice(0, 2).join(' '),
  ...HOURS.flatMap(row => [clockLabel(row.opens), clockLabel(row.closes)]),
])];

// Lines allowed to keep a literal for now: { file, text, reason }. `text` is
// part of the line, so the entry stops matching once the line changes.
// Lines allowed to type a fact, as { file, text, reason }. Empty since the
// home services copy prints formatMoneyShort(FREE_DELIVERY_THRESHOLD).
const ALLOWLIST = [];

// content.js defines the facts (its HERO_SLIDES copy is never rendered and
// belongs to the storefront lane, AW-004); products.js is catalog data.
const SKIP = new Set(['src/data/content.js', 'src/data/products.js']);
const sourceFiles = (dir) => readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
  if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return [];
  return SKIP.has(path) ? [] : [path];
});
// Comments may name a fact, for example an owner question.
const isComment = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line);

describe('no business fact is typed as a literal (AW-283)', () => {
  it('finds none outside content.js, except the allowlisted lines', () => {
    const hits = [];
    const allowed = new Set();
    for (const file of sourceFiles('src')) {
      const name = file.split(sep).join('/');
      read(file).split('\n').forEach((line, i) => {
        if (isComment(line)) return;
        for (const literal of LITERALS) {
          if (!line.includes(literal)) continue;
          const entry = ALLOWLIST.find(a => a.file === name && line.includes(a.text) && a.text.includes(literal));
          if (entry) allowed.add(entry);
          else hits.push(`${name}:${i + 1} ${literal}`);
        }
      });
    }
    expect(hits).toEqual([]);
    // An entry that matches nothing any more is stale: remove it.
    expect(ALLOWLIST.filter(a => !allowed.has(a)).map(a => a.file)).toEqual([]);
  });
});
