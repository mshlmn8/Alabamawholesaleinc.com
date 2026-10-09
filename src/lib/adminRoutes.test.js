// The admin back office's URLs (AW-118): sections, detail views and the
// checked query, with nothing personal or unknown passed through.
import { describe, expect, it } from 'vitest';
import {
  ADMIN_SECTIONS, adminHref, adminPath, adminQueryString, adminSection, isIsoDate, parseAdminPath, parseAdminQuery,
} from './adminRoutes.js';
import { hrefFor, parseUrl, pathFor, resolveRoute } from './routes.js';

const UUID = '11111111-2222-4333-8444-555555555555';
const parse = (href) => {
  const url = new URL(href, 'https://example.test');
  return resolveRoute(parseUrl({ pathname: url.pathname, search: url.search }));
};

describe('parseAdminPath', () => {
  it('reads bare /admin as exactly the admin page (Orders)', () => {
    expect(parseAdminPath([], '?status=all')).toEqual({ page: 'admin' });
    expect(parseUrl({ pathname: '/admin' })).toEqual({ page: 'admin' });
    expect(adminSection({ page: 'admin' })).toBe('orders');
  });

  it('reads each section, its detail views and its query', () => {
    expect(ADMIN_SECTIONS).toEqual(['orders', 'accounts', 'products', 'pricing']);
    expect(parse('/admin/pricing?tier=gold')).toEqual({ page: 'admin', section: 'pricing', query: {} });
    expect(parse('/admin/orders')).toEqual({ page: 'admin', section: 'orders', query: {} });
    expect(parse('/admin/Accounts/')).toEqual({ page: 'admin', section: 'accounts', query: {} });
    expect(parse(`/admin/accounts/${UUID.toUpperCase()}`)).toEqual({ page: 'admin', section: 'accounts', id: UUID, query: {} });
    expect(parse(`/admin/orders/${UUID}/print`)).toEqual({ page: 'admin', section: 'orders', id: UUID, view: 'print', query: {} });
    // The print view takes only ?doc= (AW-110); the list's filters stay with the list.
    expect(parse(`/admin/orders/${UUID}/print?doc=SLIP&status=all&from=2026-10-01`)).toEqual({ page: 'admin', section: 'orders', id: UUID, view: 'print', query: { doc: 'slip' } });
    expect(parse(`/admin/orders/${UUID}/print?doc=invoice`).query).toEqual({});
    expect(parse('/admin/orders?doc=slip').query).toEqual({});
    expect(parse('/admin/products/12')).toEqual({ page: 'admin', section: 'products', id: 12, query: {} });
    expect(parse('/admin/products/new?from=12')).toEqual({ page: 'admin', section: 'products', id: 'new', query: { from: 12 } });
  });

  it('finds no page for an unknown section, a bad id or extra segments', () => {
    for (const href of ['/admin/prices', '/admin/pricing/silver', '/admin/orders/12', `/admin/orders/${UUID}`, `/admin/orders/${UUID}/edit`, '/admin/accounts/abc',
      '/admin/products/0', '/admin/products/012', '/admin/products/1.5', '/admin/products/-3', '/admin/products/12/x', `/admin/accounts/${UUID}/x`]) {
      expect(parse(href), href).toEqual({ page: 'not-found', kind: 'page' });
    }
  });

  it('keeps only known, valid query values and drops defaults', () => {
    expect(parseAdminQuery('orders', `?status=Picking&from=2026-10-01&to=2026-02-30&on=yesterday&method=willcall&account=${UUID.toUpperCase()}&email=a@b.test&q=Gus`))
      .toEqual({ status: 'picking', from: '2026-10-01', method: 'willcall', account: UUID });
    expect(parseAdminQuery('orders', '?status=new')).toEqual({});
    expect(parseAdminQuery('orders', '?status=lost')).toEqual({});
    // Accounts take only their status filter from the URL (AW-268), never
    // the search: it names people. 'pending' is the default.
    expect(parseAdminQuery('accounts', '?q=alice@example.test&status=pending')).toEqual({});
    expect(parseAdminQuery('accounts', '?q=alice@example.test&status=Approved')).toEqual({ status: 'approved' });
    expect(parseAdminQuery('accounts', '?status=suspended')).toEqual({ status: 'suspended' });
    expect(parseAdminQuery('accounts', '?status=all')).toEqual({ status: 'all' });
    expect(parseAdminQuery('accounts', '?status=deleted')).toEqual({});
    expect(parseAdminQuery('products', `?q=+swisher+&status=inactive&dept=drinks-and-bags&sub=Energy-Drinks&tag=NEW&photo=None&unit=none&stock=low_stock&sort=price&dir=desc&page=3&from=12&x=1`))
      .toEqual({ q: 'swisher', status: 'inactive', dept: 'drinks-and-bags', sub: 'energy-drinks', tag: 'new', photo: 'none', unit: 'none', stock: 'low_stock', sort: 'price', dir: 'desc', page: 3, from: 12 });
    expect(parseAdminQuery('products', '?page=1&dept=../etc&sort=evil&q=')).toEqual({});
    expect(parseAdminQuery('products', `?q=${'a'.repeat(140)}`).q).toHaveLength(100);
    expect(() => parseAdminQuery('orders', '?status=%E0%A4%A')).not.toThrow();
  });

  it('checks calendar dates', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });
});

describe('adminPath and adminQueryString', () => {
  it('writes the keys in a fixed order and leaves defaults and unknown keys out', () => {
    expect(adminQueryString('orders', { method: 'delivery', status: 'all', junk: 1, account: 'not-a-uuid' })).toBe('?status=all&method=delivery');
    expect(adminQueryString('orders', { status: 'new' })).toBe('');
    expect(adminQueryString('products', { page: 1, q: '  swisher sweets ', sort: 'name' })).toBe('?q=swisher+sweets&sort=name');
    expect(adminQueryString('accounts', { q: 'alice' })).toBe('');
    expect(adminQueryString('accounts', { status: 'pending' })).toBe('');
    expect(adminQueryString('accounts', { status: 'all', q: 'alice' })).toBe('?status=all');
  });

  it('builds paths that resolve back to the same route', () => {
    const routes = [
      { page: 'admin' },
      { page: 'admin', section: 'orders', query: { status: 'all', from: '2026-10-01', to: '2026-10-07' } },
      { page: 'admin', section: 'orders', id: UUID, view: 'print', query: {} },
      { page: 'admin', section: 'orders', id: UUID, view: 'print', query: { doc: 'pick' } },
      { page: 'admin', section: 'orders', id: UUID, view: 'print', query: { doc: 'slip' } },
      { page: 'admin', section: 'accounts', query: {} },
      { page: 'admin', section: 'accounts', query: { status: 'suspended' } },
      { page: 'admin', section: 'accounts', id: UUID, query: {} },
      { page: 'admin', section: 'products', query: { q: 'swisher', status: 'inactive', page: 2 } },
      { page: 'admin', section: 'products', id: 42, query: {} },
      { page: 'admin', section: 'products', id: 'new', query: { from: 42 } },
    ];
    for (const route of routes) expect(parse(hrefFor(route)), hrefFor(route)).toEqual(route);
    expect(pathFor({ page: 'admin', section: 'products', id: 42, query: { q: 'x' } })).toBe('/admin/products/42');
    expect(adminPath({ section: 'nowhere' })).toBe('/admin');
    expect(adminHref({ section: 'orders', query: { status: 'picking' } })).toBe('/admin/orders?status=picking');
    expect(adminHref({ section: 'accounts', query: { status: 'approved' } })).toBe('/admin/accounts?status=approved');
    expect(adminHref({ section: 'accounts', query: { status: 'pending' } })).toBe('/admin/accounts');
    expect(adminHref({ section: 'orders', id: UUID, view: 'print', query: { doc: 'slip', status: 'all' } })).toBe(`/admin/orders/${UUID}/print?doc=slip`);
  });
});
