// index.html repeats a few facts in its static boot shell, noscript message
// and structured data, which render before (or without) the app (AW-193).
// Keep them in step with the app's single source of truth.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY, STORAGE } from './data/content.js';
import { AGE_CONFIRMATION_MAX_AGE_MS, ageRecord, parseAgeRecord } from './lib/ageGate.js';

// Vitest runs from the repository root.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const between = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
// The head's inline script (not the JSON-LD block), without its tags.
const bootScript = () => between('<script>\n', '</script>').slice('<script>\n'.length);

describe('index.html boot shell', () => {
  it('renders a loading shell inside #root and a noscript message', () => {
    expect(between('<div id="root">', '</body>')).toContain('Loading the wholesale catalog');
    expect(between('<noscript>\n', '</noscript>')).toContain('This catalog needs JavaScript');
  });

  it('shows the trade desk phone and email from COMPANY', () => {
    for (const block of [between('<div id="root">', '<noscript>\n'), between('<noscript>\n', '</noscript>')]) {
      expect(block).toContain(`href="tel:${COMPANY.phoneRaw}"`);
      expect(block).toContain(`>${COMPANY.phone}</a>`);
      expect(block).toContain(`href="mailto:${COMPANY.email}"`);
      expect(block).toContain(`>${COMPANY.email}</a>`);
    }
  });

  it('reads the same age-confirmation key as the app', () => {
    expect(html).toContain(`localStorage.getItem('${STORAGE.age}')`);
  });

  // The head script colours the shell purple for visitors the age gate will
  // ask (AW-340). Run it against the values src/lib/ageGate.js reads.
  it('agrees with the app about which stored confirmations still count', () => {
    const script = bootScript();
    expect(script).toContain('aw-gate');
    expect(script).toContain(String(AGE_CONFIRMATION_MAX_AGE_MS));
    const now = Date.UTC(2026, 8, 28, 12);
    const day = 24 * 60 * 60 * 1000;
    const values = [
      null, '', 'yes', 'no', 'true', '{', 'null', '{}', '[]',
      ageRecord(now), ageRecord(now - day), ageRecord(now - AGE_CONFIRMATION_MAX_AGE_MS + 1000),
      ageRecord(now - AGE_CONFIRMATION_MAX_AGE_MS), ageRecord(now - 400 * day),
      ageRecord(now + 60 * 60 * 1000), ageRecord(now + 2 * day),
      JSON.stringify({ ok: false, at: now }), JSON.stringify({ ok: true, at: String(now) }),
      JSON.stringify({ ok: true, at: null }), JSON.stringify({ ok: true }),
    ];
    for (const value of values) {
      const classes = new Set();
      const run = new Function('localStorage', 'document', 'setTimeout', 'Date', script);
      run(
        { getItem: (key) => (key === STORAGE.age ? value : null) },
        { documentElement: { classList: { add: (c) => classes.add(c) } }, querySelector: () => null },
        () => {},
        { now: () => now },
      );
      expect([value, classes.has('aw-gate')]).toEqual([value, !parseAgeRecord(value, now).confirmed]);
    }
  });

  it('shows the gate colours when storage is blocked', () => {
    const script = bootScript();
    const classes = new Set();
    new Function('localStorage', 'document', 'setTimeout', script)(
      { getItem: () => { throw new Error('blocked'); } },
      { documentElement: { classList: { add: (c) => classes.add(c) } }, querySelector: () => null },
      () => {},
    );
    expect(classes.has('aw-gate')).toBe(true);
  });

  it('keeps the structured data contact details in step', () => {
    expect(html).toContain(`"email": "${COMPANY.email}"`);
    expect(html).toContain(`"telephone": "+1-${COMPANY.phoneRaw.slice(2, 5)}-${COMPANY.phoneRaw.slice(5, 8)}-${COMPANY.phoneRaw.slice(8)}"`);
  });
});
