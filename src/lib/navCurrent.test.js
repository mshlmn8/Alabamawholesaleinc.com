// The current-page mark on navigation links (AW-221).
import { describe, expect, it } from 'vitest';
import { parseUrl } from './routes.js';
import { currentFor } from './navCurrent.js';

const at = (url) => {
  const [pathname, search = ''] = url.split('?');
  return parseUrl({ pathname, search: search ? `?${search}` : '' });
};
const EXOTICS = { page: 'category', category: 'NOVELTIES' };

describe('currentFor', () => {
  it('marks a department link page on its department page, and true on one of its line pages', () => {
    expect(currentFor(at('/category/novelties'), EXOTICS)).toBe('page');
    expect(currentFor(at('/category/novelties?sort=brand&tags=new'), EXOTICS)).toBe('page');
    expect(currentFor(at('/category/novelties/disposable-vapes'), EXOTICS)).toBe('true');
    expect(currentFor(at('/category/tobacco'), EXOTICS)).toBeUndefined();
    expect(currentFor(at('/category/drinks-and-bags'), { page: 'category', category: 'DRINKS & BAGS' })).toBe('page');
  });

  it('marks a line link page only on that line', () => {
    const vapes = { page: 'category', category: 'NOVELTIES', sub: 'Disposable Vapes' };
    expect(currentFor(at('/category/novelties/disposable-vapes'), vapes)).toBe('page');
    expect(currentFor(at('/category/novelties/vape-pods'), vapes)).toBeUndefined();
    expect(currentFor(at('/category/novelties'), vapes)).toBeUndefined();
  });

  it('reads hrefs as well as route objects', () => {
    expect(currentFor(at('/category/novelties'), '/category/novelties')).toBe('page');
    expect(currentFor(at('/category/novelties/disposable-vapes'), '/category/novelties')).toBe('true');
    expect(currentFor(at('/account'), '/account')).toBe('page');
    expect(currentFor(at('/terms'), '/terms')).toBe('page');
    expect(currentFor(at('/privacy'), '/terms')).toBeUndefined();
    expect(currentFor(at('/catalog'), '/catalog')).toBe('page');
    expect(currentFor(at('/'), '/')).toBe('page');
    expect(currentFor(at('/product/12'), '/product/12')).toBe('page');
    expect(currentFor(at('/product/12'), { page: 'product', productId: 13 })).toBeUndefined();
  });

  it('never marks a link to a part of a page, an unknown address or a page elsewhere', () => {
    expect(currentFor(at('/'), '/#new-arrivals')).toBeUndefined();
    expect(currentFor(at('/'), '/#bestsellers')).toBeUndefined();
    expect(currentFor(at('/nope'), '/nope')).toBeUndefined();
    expect(currentFor(at('/account'), '/catalog')).toBeUndefined();
    expect(currentFor(at('/account'), 'http://[bad')).toBeUndefined();
    expect(currentFor(null, '/account')).toBeUndefined();
    expect(currentFor(at('/account'), null)).toBeUndefined();
  });
});
