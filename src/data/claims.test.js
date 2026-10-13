// The owner's answers of October 2026 (AW-005, AW-025, AW-246) settle the
// business claims: there are no Net-30 or other credit terms and no volume
// discounts (volume pricing goes through the trade desk), no approval or
// response time is promised, no count of accounts and no "three
// generations" is published, and the sourcing is "the manufacturer or an
// established wholesale distributor", never "direct from the manufacturer"
// alone. Nothing the site renders may say otherwise: the code under src
// (comments left out), index.html (the boot shell, noscript text, meta and
// structured data) and the web manifest.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANNOUNCEMENTS, COMPANY, FAQS, HERO_SLIDES, SOURCING, TRUST, VOLUME_PRICING, YEARS_IN_BUSINESS } from './content.js';

const ROOT = process.cwd();
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');

// Comments may name a retired claim (an owner answer, a finding); code may not.
const code = (text) => text.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const html = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

const sourceFiles = (dir) => readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
  if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return [];
  return [path];
});

const RETIRED = [
  ['Net-30 terms', /\bnet[- ]?30\b/i],
  ['credit terms', /\bcredit (terms|verification|application)/i],
  ['volume discounts', /\bvolume discount/i],
  ['a percentage off for volume', /\bup to \d+ ?%|\b18 ?%/i],
  ['three generations', /\bthree generations\b|\bfamily[- ]owned\b/i],
  ['an approval or response time', /\bbusiness days?\b|\bapproved within\b|\bwithin (one|1|two|2|24|48) (business )?(day|days|hour|hours)\b/i],
  ['direct from the manufacturer', /\bdirect(ly)? from (the )?manufacturers?\b/i],
  ['a count of accounts', /\b\d[\d,]*\+? (retail )?(accounts|stores|retailers|customers) (served|trust)/i],
  // The number published before the owner's phone answer.
  ['the old phone number', /354[-. ]?4473|\+?1?2053544473/],
];

const published = () => [
  ...sourceFiles('src').map((file) => ({ name: file.split(sep).join('/'), text: code(read(file)) })),
  { name: 'index.html', text: html(read('index.html')) },
  { name: 'public/site.webmanifest', text: read('public/site.webmanifest') },
];

describe('retired business claims (AW-005, AW-025, AW-246)', () => {
  it('appear nowhere the site prints', () => {
    const hits = [];
    for (const { name, text } of published()) {
      text.split('\n').forEach((line, i) => {
        for (const [what, pattern] of RETIRED) if (pattern.test(line)) hits.push(`${name}:${i + 1} ${what}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('are gone from the unpublished copy too: the FAQ answers, and the hero photos\' descriptions', () => {
    // The hero slides are the owner's warehouse photos (AW-006): a photo and
    // its description, with no slide copy of their own any more.
    const text = [...FAQS.flatMap(({ q, a }) => [q, a]), ...HERO_SLIDES.map((s) => s.alt)].join('\n');
    for (const [what, pattern] of RETIRED) expect(text, what).not.toMatch(pattern);
  });
});

describe('volume pricing (AW-025)', () => {
  it('is one sentence with the published phone, the trade bar\'s last announcement', () => {
    expect(VOLUME_PRICING).toBe(`For volume pricing, email us or call ${COMPANY.phone}.`);
    expect(ANNOUNCEMENTS.at(-1)).toBe(`★ ${VOLUME_PRICING}`);
    expect(ANNOUNCEMENTS.join(' ')).not.toMatch(/NET-30|DISCOUNT/);
  });

  it('is the FAQ answer, with the email spelled out', () => {
    const faq = FAQS.find((f) => /volume/i.test(f.q));
    expect(faq.a).toBe(`For volume pricing, email us at ${COMPANY.email} or call ${COMPANY.phone}.`);
  });
});

describe('the published phone (owner answer, 2026-10)', () => {
  it('is (205) 458-4788, dialled as +12054584788', () => {
    expect(COMPANY.phone).toBe('(205) 458-4788');
    expect(COMPANY.phoneRaw).toBe('+12054584788');
  });
});

describe('trust facts (AW-005)', () => {
  it('are the two the owner confirmed and the sourcing sentence, with no count of accounts', () => {
    expect(YEARS_IN_BUSINESS).toBe(20);
    expect(TRUST.map((f) => `${f.figure} ${f.label}`)).toEqual(['20 years in business', '100% authentic products']);
    expect(SOURCING).toBe('Every product comes from the manufacturer or an established wholesale distributor.');
  });
});
