// index.html repeats a few facts in its static boot shell, noscript message
// and structured data, which render before (or without) the app (AW-193).
// Keep them in step with the app's single source of truth.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY, STORAGE } from './data/content.js';

// Vitest runs from the repository root.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const between = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));

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

  it('keeps the structured data contact details in step', () => {
    expect(html).toContain(`"email": "${COMPANY.email}"`);
    expect(html).toContain(`"telephone": "+1-${COMPANY.phoneRaw.slice(2, 5)}-${COMPANY.phoneRaw.slice(5, 8)}-${COMPANY.phoneRaw.slice(8)}"`);
  });
});
