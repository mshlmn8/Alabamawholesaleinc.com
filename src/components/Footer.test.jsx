// The footer's column headings follow the page's h1 and h2 in order (AW-313),
// the columns are marked for the phone layout that places them (AW-305), on
// phones Departments folds behind its heading (AW-305, LEFT-4),
// and the /shipping link is the delivery policy, not a second "Delivery"
// beside "Delivery & service area" (AW-316).
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANY, HOURS } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { FOOTER_FOLD_QUERY, Footer, footerBlurb } from './Footer.jsx';

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

// Phones (AW-305, LEFT-4): Departments is a <details> whose summary is the
// h2, closed until it is opened, with every link inside; wider screens get the
// plain heading. The email breaks after the '@', and each line of hours after
// its days, in the narrow phone column.
describe('Footer on phones (AW-305, LEFT-4)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const phone = (matches) => vi.stubGlobal('matchMedia', (query) => ({
    matches: matches && query === FOOTER_FOLD_QUERY, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
  const shopLinks = (root) => [...root.querySelectorAll('a')].map((a) => a.textContent);

  it('folds Departments behind its heading, closed, with the same links inside', () => {
    phone(false);
    const { unmount } = renderFooter();
    const open = shopLinks(screen.getByRole('heading', { name: 'Departments' }).parentElement);
    expect(document.querySelector('footer details')).toBeNull();
    unmount();

    phone(true);
    renderFooter();
    const heading = screen.getByRole('heading', { level: 2, name: 'Departments' });
    const summary = heading.parentElement;
    const details = summary.parentElement;
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.firstElementChild).toBe(heading);
    expect(details.tagName).toBe('DETAILS');
    expect(details.className).toBe('footer-departments footer-fold');
    expect(details.open).toBe(false);
    expect(shopLinks(details)).toEqual(open);
    expect(open).toHaveLength(departmentsFor(PRODUCTS).length + 3);
    // The same headings, in the same order.
    expect(within(screen.getByRole('contentinfo')).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Departments', 'Account & help', 'Contact']);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
  });

  it('marks Account & help by class too, so the phone grid can place it', () => {
    renderFooter();
    expect(screen.getByRole('heading', { name: 'Account & help' }).parentElement.className).toBe('footer-account');
    expect(screen.getByRole('heading', { name: 'Departments' }).parentElement.className).toBe('footer-departments');
  });

  it('breaks the email after the @ and each line of hours after its days, never inside the times', () => {
    renderFooter();
    const contact = screen.getByRole('heading', { name: 'Contact' }).parentElement;
    const email = within(contact).getByRole('link', { name: COMPANY.email });
    expect(email.getAttribute('href')).toBe(`mailto:${COMPANY.email}`);
    expect(email.querySelector('wbr')).toBeTruthy();
    const lines = [...contact.querySelectorAll('.footer-hours')];
    expect(lines.map((l) => l.textContent.replace(/[\u00A0\u2060]/g, (c) => (c === '\u2060' ? '' : ' ')))).toEqual(HOURS.map((row) => COMPANY[`hoursLine${HOURS.indexOf(row) + 1}`].replace(/[\u00A0\u2060]/g, (c) => (c === '\u2060' ? '' : ' '))));
    for (const line of lines) {
      const [days, times] = line.children;
      expect(days.textContent).not.toMatch(/ /);
      // The only ordinary space is the one between the days and the times.
      expect(times.textContent).not.toMatch(/ /);
      expect(line.textContent.split(' ')).toHaveLength(2);
    }
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
