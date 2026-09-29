// Not-found page (AW-188, AW-232): a way forward instead of a dead end.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from './NotFoundPage.jsx';

const products = [
  { id: 11, name: 'Backwoods cigars', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BW', variants: [] },
  { id: 12, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
];
const departments = [
  { key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 2 },
  { key: 'DRINKS & BAGS', label: 'Drinks & Bags', subs: [], count: 0 },
];

describe('NotFoundPage', () => {
  it('names what was not found without echoing the address', () => {
    render(<NotFoundPage kind="product" products={products} departments={departments} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Product not found');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
  });

  it('links every department, the full catalog and home', () => {
    render(<NotFoundPage products={products} departments={departments} />);
    const browse = screen.getByRole('navigation', { name: 'Browse by department' });
    expect(within(browse).getByRole('link', { name: 'Drinks & Bags (0)' }).getAttribute('href')).toBe('/category/drinks-and-bags');
    expect(within(browse).getByRole('link', { name: 'All products' }).getAttribute('href')).toBe('/catalog');
    expect(within(browse).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
  });

  it('offers the department of a missing product line', () => {
    render(<NotFoundPage kind="line" category="TOBACCO" products={products} departments={departments} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Product line not found');
    expect(screen.getByRole('link', { name: /Browse all Tobacco/ }).getAttribute('href')).toBe('/category/tobacco');
  });

  it('searches the catalog and lists matches as product links', () => {
    render(<NotFoundPage products={products} departments={departments} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Product, brand or SKU' }), { target: { value: 'kite' } });
    expect(screen.getByRole('status').textContent).toBe('1 matching product');
    expect(screen.getByRole('link', { name: /Kite tobacco/ }).getAttribute('href')).toBe('/product/12');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Product, brand or SKU' }), { target: { value: 'zzz' } });
    expect(screen.getByRole('status').textContent).toMatch(/^No matches/);
  });

  it('says it is loading, not "not found", while the live catalog loads (AW-204)', () => {
    const view = render(<NotFoundPage kind="product" catalog="loading" products={products} departments={departments} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Loading product…');
    expect(screen.queryByRole('search')).toBeNull();
    // The heading element stays when the catalog fails to load.
    const onRetry = vi.fn();
    view.rerender(<NotFoundPage kind="product" catalog="error" onRetry={onRetry} products={products} departments={departments} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(h1);
    expect(h1.textContent).toBe('We couldn’t load this product');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    view.rerender(<NotFoundPage kind="product" catalog="error" retrying onRetry={onRetry} products={products} departments={departments} />);
    expect(screen.getByRole('button', { name: 'Trying again…' }).disabled).toBe(true);
    // Once loaded, a product that isn't there is not found.
    view.rerender(<NotFoundPage kind="product" products={products} departments={departments} />);
    expect(screen.getByRole('heading', { level: 1 })).toBe(h1);
    expect(h1.textContent).toBe('Product not found');
  });

  it('ignores the catalog state for addresses that are not catalog pages', () => {
    render(<NotFoundPage kind="page" catalog="loading" products={products} departments={departments} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page not found');
  });
});

