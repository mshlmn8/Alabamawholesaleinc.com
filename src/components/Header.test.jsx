// Header search (AW-007, AW-063, AW-064): the best 8 matches with the total,
// a link to every result, and Enter opening /search?q= with the text kept,
// through the combobox (AW-171; its keys and focus rules are in
// HeaderSearch.test.jsx). And the Categories menu, which closes when focus
// leaves it (AW-165).
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
const box = () => screen.getByRole('combobox', { name: 'Search products' });
const type = (text) => fireEvent.change(box(), { target: { value: text } });
// The panel heading (plain text; the count is announced by a separate status).
const status = () => document.querySelector('.aw-search-heading p')?.textContent ?? null;
const listed = () => [...document.querySelectorAll('.aw-search-list [role="option"][href^="/product/"]')];

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
    const all = screen.getByRole('option', { name: `See all ${total} results for “cigar”` });
    expect(all.getAttribute('href')).toBe('/search?q=cigar');
  });

  it('counts a short list and says when nothing or only related products match', () => {
    renderHeader();
    type('red bull');
    expect(status()).toBe('4 results');
    expect(screen.getByRole('option', { name: 'See all 4 results for “red bull”' })).toBeTruthy();
    type('red bull marlboro');
    expect(status()).toBe('No exact matches — related products');
    type('marlboro');
    expect(status()).toBe('No matches');
    expect(listed()).toHaveLength(0);
    expect(screen.queryByRole('option', { name: /^See / })).toBeNull();
  });

  it('opens /search on Enter and keeps the query; a short query says it is too short', () => {
    renderHeader();
    type('c');
    expect(status()).toBeNull();
    fireEvent.submit(box().closest('form'));
    expect(status()).toBe('Type at least 2 characters');
    expect(window.location.pathname).toBe('/');
    type(' cigar ');
    fireEvent.submit(box().closest('form'));
    expect(window.location.pathname + window.location.search).toBe('/search?q=cigar');
    // The box shows the results page's query.
    expect(box().value).toBe('cigar');
    expect(status()).toBeNull();
  });

  it('leaves the page title alone (AW-338)', () => {
    document.title = 'Home title';
    renderHeader();
    type('wraps');
    expect(document.title).toBe('Home title');
  });
});

describe('Categories menu (AW-165)', () => {
  const toggle = () => screen.getByRole('button', { name: 'Categories', exact: true });
  const menu = () => document.getElementById('aw-mega-menu');

  it('points aria-controls at the menu only while it is open', () => {
    renderHeader();
    expect(toggle().hasAttribute('aria-controls')).toBe(false);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-controls')).toBe('aw-mega-menu');
    expect(menu()).toBeTruthy();
  });

  it('labels each department as a group, not a navigation landmark, and counts products', () => {
    renderHeader();
    fireEvent.click(toggle());
    expect(menu().querySelectorAll('nav')).toHaveLength(0);
    const groups = screen.getAllByRole('group');
    expect(groups.map((g) => document.getElementById(g.getAttribute('aria-labelledby')).textContent))
      .toEqual(departments.map((d) => d.label));
    expect(screen.getByRole('group', { name: departments[0].label })).toBeTruthy();
    expect(menu().querySelector('.aw-menu-footer span').textContent).toBe(`${departments.length} departments · ${PRODUCTS.length} products`);
  });

  it('closes when Tab moves focus past its last link, and stays open while focus is inside', () => {
    renderHeader();
    fireEvent.click(toggle());
    const links = [...menu().querySelectorAll('a')];
    fireEvent.blur(toggle(), { relatedTarget: menu().querySelector('button') });
    fireEvent.blur(links[0], { relatedTarget: links[1] });
    expect(menu()).toBeTruthy();
    // Safari clicking a link: no relatedTarget, the click handles it.
    fireEvent.blur(links[1], { relatedTarget: null });
    expect(menu()).toBeTruthy();
    // Shift+Tab from the first control back onto the toggle.
    fireEvent.blur(menu().querySelector('button'), { relatedTarget: toggle() });
    expect(menu()).toBeTruthy();
    fireEvent.blur(links.at(-1), { relatedTarget: screen.getByRole('link', { name: 'New Arrivals' }) });
    expect(menu()).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when focus leaves the toggle for another control', () => {
    renderHeader();
    fireEvent.click(toggle());
    fireEvent.blur(toggle(), { relatedTarget: screen.getByRole('combobox', { name: 'Search products' }) });
    expect(menu()).toBeNull();
  });

  it('closes when the search list opens', () => {
    renderHeader();
    fireEvent.click(toggle());
    type('wraps');
    expect(menu()).toBeNull();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});

// The header logo: the photo, or the brand in text when it fails (AW-341).
describe('Header logo', () => {
  const logoProps = {
    cartCount: 0, onCart: vi.fn(), products: [], departments: [], user: null, isAdmin: false,
    onLoginClick: vi.fn(), onSignupClick: vi.fn(), onLogout: vi.fn(), onHelp: vi.fn(),
  };
  it('reserves the logo slot with the photo\'s size, and shows the brand in text when it fails', () => {
    render(<Header {...logoProps} />);
    const home = screen.getByRole('link', { name: 'Alabama Wholesale home' });
    const logo = home.querySelector('img');
    expect(logo.getAttribute('alt')).toBe('');
    expect([logo.getAttribute('width'), logo.getAttribute('height')]).toEqual(['320', '320']);
    fireEvent.error(logo);
    expect(home.querySelector('img')).toBeNull();
    expect(home.querySelector('.aw-logo-text').textContent).toBe('AlabamaWHOLESALE INC.');
    // Same link, same name, still the home page.
    expect(screen.getByRole('link', { name: 'Alabama Wholesale home' })).toBe(home);
    expect(home.getAttribute('href')).toBe('/');
    // The photo comes back with the connection.
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(home.querySelector('img')).not.toBeNull();
    expect(home.querySelector('.aw-logo-text')).toBeNull();
  });
});
