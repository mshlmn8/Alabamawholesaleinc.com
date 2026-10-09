// Search results page (AW-007): /search?q= with the catalog search rules
// (AW-063, AW-064). The bundled catalog carries no prices.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { navigate } from '../lib/router.js';
import { SEARCH_PAGE_SIZE, SearchPage } from './SearchPage.jsx';

const departments = departmentsFor(PRODUCTS);
const cardProps = { profile: null, isApprovedBuyer: false, cart: {}, addLine: () => {}, decLine: () => {}, onLoginClick: () => {} };
const show = (q) => render(<SearchPage q={q} products={PRODUCTS} departments={departments} {...cardProps} />);
const cards = () => [...document.querySelectorAll('.card-grid .content-card h3')].map((h) => h.textContent);
const note = () => screen.getByRole('status').textContent;

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/search?q=cigar', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('SearchPage', () => {
  it('names the query and lists every match as a product card', () => {
    show('cigar');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Results for “cigar”');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(within(crumbs).getByText('Search').getAttribute('aria-current')).toBe('page');
    expect(note()).toMatch(/^\d+ products$/);
    const total = Number(note().split(' ')[0]);
    expect(total).toBeGreaterThanOrEqual(30);
    expect(cards()).toHaveLength(total);
    expect(screen.getByRole('searchbox', { name: 'Search products, brands or SKUs' }).value).toBe('cigar');
  });

  it('finds names with either apostrophe (AW-064)', () => {
    show("reese's");
    expect(cards()[0]).toBe(PRODUCTS.find((p) => p.id === 166).name);
    expect(note()).toBe('1 product');
  });

  it('shows 48 cards, then all of them, moving focus to the first one added', () => {
    show('candy');
    const total = Number(note().split(' ')[0]);
    expect(total).toBeGreaterThan(SEARCH_PAGE_SIZE);
    expect(cards()).toHaveLength(SEARCH_PAGE_SIZE);
    fireEvent.click(screen.getByRole('button', { name: `Show all ${total}` }));
    expect(cards()).toHaveLength(total);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    expect(document.activeElement).toBe(document.querySelectorAll('.card-grid a.card-link')[SEARCH_PAGE_SIZE]);
  });

  it('labels related products when nothing matches every word', () => {
    show('red bull marlboro');
    expect(note()).toBe('No exact matches for “red bull marlboro”. Related products:');
    expect(cards().slice(0, 4).every((name) => name.startsWith('Red Bull'))).toBe(true);
  });

  it('offers the departments, the catalog and the trade desk when nothing matches', () => {
    show('marlboro');
    expect(note()).toBe('0 products');
    expect(cards()).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 2, name: 'No products match “marlboro”.' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Tobacco \(\d+\)$/ }).getAttribute('href')).toBe('/category/tobacco');
    expect(screen.getByRole('link', { name: 'Browse all products' }).getAttribute('href')).toBe('/catalog');
    expect(screen.getByRole('link', { name: 'Ask the trade desk about an item' }).getAttribute('href')).toBe('/contact');
  });

  it('asks for at least two characters', () => {
    for (const q of ['', 'a']) {
      const view = show(q);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Search the catalog');
      expect(note()).toBe('Type at least 2 characters.');
      expect(cards()).toHaveLength(0);
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
      view.unmount();
    }
  });

  it('searches again from its own box', () => {
    show('cigar');
    const box = screen.getByRole('searchbox', { name: 'Search products, brands or SKUs' });
    fireEvent.change(box, { target: { value: '  red bull ' } });
    fireEvent.submit(screen.getByRole('search', { name: 'Catalog' }));
    expect(window.location.pathname + window.location.search).toBe('/search?q=red+bull');
  });
});
