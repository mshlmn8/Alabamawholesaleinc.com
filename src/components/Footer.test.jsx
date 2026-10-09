// The footer's column headings follow the page's h1 and h2 in order (AW-313),
// the contact column is marked for the phone layout that spans it (AW-305),
// and the /shipping link is the delivery policy, not a second "Delivery"
// beside "Delivery & service area" (AW-316).
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { Footer, footerBlurb } from './Footer.jsx';

const noop = () => {};
const renderFooter = () => render(<Footer departments={departmentsFor(PRODUCTS)} onLoginClick={noop} onApplyClick={noop} />);

describe('Footer', () => {
  it('heads its columns with h2s, never skipping a level after the page’s headings', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getAllByRole('heading').map((h) => [h.tagName, h.textContent])).toEqual([
      ['H2', 'Departments'], ['H2', 'Account & help'], ['H2', 'Contact'],
    ]);
    expect(footer.querySelector('h3, h4, h5, h6')).toBeNull();
  });

  it('marks the contact column by class, so the phone layout spans it whatever the column order', () => {
    renderFooter();
    const contact = screen.getByRole('heading', { name: 'Contact' }).parentElement;
    expect(contact.className).toBe('footer-contact');
    expect(contact.parentElement.className).toBe('footer-grid');
  });

  it('names the /shipping link "Delivery policy", apart from "Delivery & service area"', () => {
    renderFooter();
    const policies = screen.getByRole('navigation', { name: 'Policies' });
    expect(within(policies).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Delivery policy', '/shipping'], ['Privacy', '/privacy'], ['Trade terms', '/terms'],
    ]);
    expect(screen.getByRole('link', { name: 'Delivery & service area' }).getAttribute('href')).toBe('/delivery');
    expect(screen.queryByRole('link', { name: 'Delivery' })).toBeNull();
  });
});

// Safari 14.0 and iOS 14.0–14.4 have no Intl.ListFormat (NEW-019): the
// footer's department list is written the same without it, and nothing
// touches it while the module loads.
describe('footerBlurb without Intl.ListFormat (NEW-019)', () => {
  afterEach(() => vi.resetModules());

  const lists = [[], ['tobacco'], ['tobacco', 'candies'], ['tobacco', 'novelties & vapes', 'candies'], departmentsFor(PRODUCTS).map((d) => d.label.toLowerCase())];

  it('writes the same words as Intl.ListFormat, which it uses where the browser has it', async () => {
    const withIntl = await import('./Footer.jsx');
    const real = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });
    for (const list of lists) expect(withIntl.listText(list)).toBe(real.format(list));
    expect(withIntl.listText(['tobacco', 'novelties & vapes', 'candies'])).toBe('tobacco, novelties & vapes, and candies');

    vi.resetModules();
    vi.stubGlobal('Intl', { ...Object.fromEntries(Object.getOwnPropertyNames(Intl).map((k) => [k, Intl[k]])), ListFormat: undefined });
    try {
      // Loading the module must not need it either.
      const without = await import('./Footer.jsx');
      expect(typeof Intl.ListFormat).toBe('undefined');
      for (const list of lists) expect([list, without.listText(list)]).toEqual([list, real.format(list)]);
      expect(without.footerBlurb(departmentsFor(PRODUCTS))).toBe(footerBlurb(departmentsFor(PRODUCTS)));
      expect(without.footerBlurb([])).toBe('Wholesale distributor. Serving licensed retail stores.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
