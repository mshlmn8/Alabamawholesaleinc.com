// Hash router: #/ #/category/X[/Sub] #/product/ID #/quote #/account #/admin
// and the support pages. Every piece of URL knowledge lives in this module so
// the path router (AW-043) can replace it in one place.

import { useCallback, useEffect, useState } from 'react';

// Static support pages: #/<page> — see src/pages/support/.
export const SUPPORT_PAGES = ['catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply', 'reset-password'];

export function parseHash(rawHash = window.location.hash) {
  const hash = rawHash.replace(/^#\/?/, '');
  if (!hash) return { page: 'home' };
  const [section, ...rest] = hash.split('/');
  if (section === 'product' && rest[0]) return { page: 'product', productId: Number(decodeURIComponent(rest[0])) };
  if (section === 'category' && rest[0]) return { page: 'category', category: decodeURIComponent(rest[0]), sub: rest[1] ? decodeURIComponent(rest[1]) : null };
  if (section === 'quote') return { page: 'quote' };
  if (section === 'account') return { page: 'account' };
  if (section === 'admin') return { page: 'admin' };
  if (SUPPORT_PAGES.includes(section)) return { page: section };
  return { page: 'home' };
}

export function routeToHash(r) {
  if (r.page === 'product') return `#/product/${r.productId}`;
  if (r.page === 'category') return `#/category/${encodeURIComponent(r.category)}${r.sub ? '/' + encodeURIComponent(r.sub) : ''}`;
  if (r.page === 'quote') return '#/quote';
  if (r.page === 'account') return '#/account';
  if (r.page === 'admin') return '#/admin';
  if (SUPPORT_PAGES.includes(r.page)) return `#/${r.page}`;
  return '#/';
}

// The current route plus navigate(route, { scroll }). Back/Forward and edited
// hashes update the route through popstate/hashchange.
export function useRoute() {
  const [route, setRoute] = useState(() => parseHash());

  useEffect(() => {
    const onPop = () => setRoute(parseHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  const navigate = useCallback((next, { scroll = true } = {}) => {
    window.history.pushState(null, '', routeToHash(next));
    setRoute(next);
    if (scroll) window.scrollTo(0, 0);
  }, []);

  return { route, navigate };
}
