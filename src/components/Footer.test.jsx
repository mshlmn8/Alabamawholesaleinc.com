// The footer's column headings follow the page's h1 and h2 in order (AW-313),
// the contact column is marked for the phone layout that spans it (AW-305),
// and the /shipping link is the delivery policy, not a second "Delivery"
// beside "Delivery & service area" (AW-316).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { Footer } from './Footer.jsx';

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
