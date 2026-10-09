// Header search (AW-007, AW-063, AW-064): the best 8 matches with the total,
// a link to every result, and Enter opening /search?q= with the text kept.
// The combobox rewrite (AW-171) keeps these behaviours.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { navigate } from '../lib/router.js';
import { searchProducts } from '../lib/search.js';
import { Header } from './Header.jsx';

const departments = departmentsFor(PRODUCTS);
const noop = () => {};
const renderHeader = () => render(
  <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={null} isAdmin={false}
          onLoginClick={noop} onSignupClick={noop} onLogout={noop} onHelp={noop} />,
);
const box = () => screen.getByRole('searchbox', { name: 'Search products' });
const type = (text) => fireEvent.change(box(), { target: { value: text } });
const status = () => document.querySelector('.aw-search-heading [role="status"]')?.textContent ?? null;
const listed = () => [...document.querySelectorAll('.aw-search-list a[href^="/product/"]')];

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});

describe('Header search', () => {
  it('names no product count in its placeholder', () => {
    renderHeader();
    expect(box().getAttribute('placeholder')).toBe('Search products, brands or SKUs');
  });

  it('lists the best 8, says how many there are and links to all of them', () => {
    renderHeader();
    type('cigar');
    const { total } = searchProducts(PRODUCTS, 'cigar');
    expect(total).toBeGreaterThan(8);
    expect(status()).toBe(`Showing 8 of ${total} results`);
    expect(listed()).toHaveLength(8);
    const all = screen.getByRole('link', { name: `See all ${total} results for “cigar”` });
    expect(all.getAttribute('href')).toBe('/search?q=cigar');
  });

  it('counts a short list and says when nothing or only related products match', () => {
    renderHeader();
    type('red bull');
    expect(status()).toBe('4 results');
    expect(screen.getByRole('link', { name: 'See all 4 results for “red bull”' })).toBeTruthy();
    type('red bull marlboro');
    expect(status()).toBe('No exact matches — related products');
    type('marlboro');
    expect(status()).toBe('No matches');
    expect(listed()).toHaveLength(0);
    expect(screen.queryByRole('link', { name: /^See / })).toBeNull();
  });

  it('opens /search on Enter and keeps the text; a short query says it is too short', () => {
    renderHeader();
    type('c');
    expect(status()).toBeNull();
    fireEvent.submit(box().closest('form'));
    expect(status()).toBe('Type at least 2 characters');
    expect(window.location.pathname).toBe('/');
    type(' cigar ');
    fireEvent.submit(box().closest('form'));
    expect(window.location.pathname + window.location.search).toBe('/search?q=cigar');
    expect(box().value).toBe(' cigar ');
    expect(status()).toBeNull();
  });

  it('leaves the page title alone (AW-338)', () => {
    document.title = 'Home title';
    renderHeader();
    type('wraps');
    expect(document.title).toBe('Home title');
  });
});
