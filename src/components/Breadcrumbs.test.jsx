// Breadcrumbs (AW-043) and the catalog trail (AW-226, AW-325, NEW-029).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hrefFor } from '../lib/routes.js';
import { ALL_PRODUCTS_CRUMB, Breadcrumbs, catalogCrumbs, HOME_CRUMB } from './Breadcrumbs.jsx';

const href = (to) => (typeof to === 'string' ? to : hrefFor(to));
const hrefs = (items) => items.map((item) => ({ label: item.label, href: item.to ? href(item.to) : null }));

describe('catalogCrumbs (AW-226)', () => {
  it('a department: Home / All products / the department', () => {
    const items = catalogCrumbs({ category: 'DRINKS & BAGS' });
    expect(items.slice(0, 2)).toEqual([HOME_CRUMB, ALL_PRODUCTS_CRUMB]);
    expect(hrefs(items)).toEqual([
      { label: 'Home', href: '/' },
      { label: 'All products', href: '/catalog' },
      { label: 'Drinks & Bags', href: null },
    ]);
  });

  it('a product line: the department is a link, the line is the page', () => {
    expect(hrefs(catalogCrumbs({ category: 'TOBACCO', sub: 'Cigars & Cigarillos' }))).toEqual([
      { label: 'Home', href: '/' },
      { label: 'All products', href: '/catalog' },
      { label: 'Tobacco', href: '/category/tobacco' },
      { label: 'Cigars & Cigarillos', href: null },
    ]);
  });

  it('a product: department and line are links, the product is the page', () => {
    expect(hrefs(catalogCrumbs({ category: 'NOVELTIES', sub: 'Disposable Vapes', product: { id: 61, name: 'Geek Bar Pulse X 25K' } }))).toEqual([
      { label: 'Home', href: '/' },
      { label: 'All products', href: '/catalog' },
      { label: 'Novelties & Vapes', href: '/category/novelties' },
      { label: 'Disposable Vapes', href: '/category/novelties/disposable-vapes' },
      { label: 'Geek Bar Pulse X 25K', href: null },
    ]);
    // Without its line, the product sits under the department.
    expect(hrefs(catalogCrumbs({ category: 'NOVELTIES', product: { name: 'Geek Bar' } })).map((c) => c.label)).toEqual(['Home', 'All products', 'Novelties & Vapes', 'Geek Bar']);
  });

  it('carries a department page’s filters onto its parent links', () => {
    const query = { q: '', sort: 'brand', tags: [], brands: ['game'], variants: false };
    expect(hrefs(catalogCrumbs({ category: 'TOBACCO', sub: 'Wraps & Leafs', query }))[2]).toEqual({ label: 'Tobacco', href: '/category/tobacco?sort=brand&brand=game' });
  });

  it('says which crumb is the department when the line has its name, keeping both levels (NEW-029)', () => {
    expect(hrefs(catalogCrumbs({ category: 'MOTOR OIL', sub: 'Motor Oil' }))).toEqual([
      { label: 'Home', href: '/' },
      { label: 'All products', href: '/catalog' },
      { label: 'Motor Oil department', href: '/category/motor-oil' },
      { label: 'Motor Oil', href: null },
    ]);
    // A product page under it, and any case.
    expect(hrefs(catalogCrumbs({ category: 'MOTOR OIL', sub: 'motor oil', product: { id: 57, name: 'Pure Guard motor oil' } })).slice(2)).toEqual([
      { label: 'Motor Oil department', href: '/category/motor-oil' },
      { label: 'motor oil', href: '/category/motor-oil/motor-oil' },
      { label: 'Pure Guard motor oil', href: null },
    ]);
    // The department page itself, and a line with a name of its own, are unchanged.
    expect(catalogCrumbs({ category: 'MOTOR OIL' }).map((c) => c.label)).toEqual(['Home', 'All products', 'Motor Oil']);
    expect(catalogCrumbs({ category: 'TOBACCO', sub: 'Cigarettes' })[2].label).toBe('Tobacco');
  });

  it('never changes the shared Home and All products crumbs', () => {
    catalogCrumbs({ category: 'TOBACCO', sub: 'Cigarettes' });
    expect(HOME_CRUMB).toEqual({ label: 'Home', to: '/' });
    expect(ALL_PRODUCTS_CRUMB).toEqual({ label: 'All products', to: '/catalog' });
  });
});

describe('Breadcrumbs', () => {
  it('renders links and a current page, never a button, so every crumb takes the trail’s capitals (AW-325)', () => {
    const { container } = render(<Breadcrumbs items={catalogCrumbs({ category: 'TOBACCO', sub: 'Cigars & Cigarillos' })} />);
    const nav = container.querySelector('nav.crumbs');
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    const crumbs = [...nav.querySelectorAll('ol > li > *')];
    expect(crumbs.map((el) => el.tagName)).toEqual(['A', 'A', 'A', 'SPAN']);
    expect(crumbs.map((el) => el.textContent)).toEqual(['Home', 'All products', 'Tobacco', 'Cigars & Cigarillos']);
    expect(crumbs[2].getAttribute('href')).toBe('/category/tobacco');
    expect(crumbs[3].getAttribute('aria-current')).toBe('page');
    expect(nav.querySelector('button')).toBeNull();
  });
});
