// Which navigation link leads to the page on screen (AW-221), for its
// aria-current. Pure: no React, no window.
//
// currentFor(raw, target):
//   raw     the current URL's raw route, useRoute().raw (router.js)
//   target  the link's `to`: an href ('/account', '/category/novelties') or a
//           route object ({ page: 'category', category: 'NOVELTIES' })
// Returns 'page' when the link leads to this very page, 'true' when it leads
// to the department whose product line is on screen, and undefined
// otherwise, so the attribute is left off. A link to a part of a page
// ('/#new-arrivals') is never current.

import { parseUrl, slugify } from './routes.js';

// The target as { page, dept, sub, id, q }, in the shape of a raw route.
function targetRoute(target) {
  if (target && typeof target === 'object') {
    return target.page === 'category'
      ? { page: 'category', dept: target.category, sub: target.sub ?? null }
      : { ...target, id: target.productId ?? target.id };
  }
  if (typeof target !== 'string') return null;
  let url;
  try {
    url = new URL(target, 'http://localhost');
  } catch {
    return null;
  }
  if (url.hash) return null;
  return parseUrl({ pathname: url.pathname, search: url.search });
}

export function currentFor(raw, target) {
  const to = targetRoute(target);
  if (!raw || !to || raw.page !== to.page || raw.page === 'not-found') return undefined;
  if (raw.page === 'category') {
    if (!slugify(raw.dept) || slugify(raw.dept) !== slugify(to.dept)) return undefined;
    if (to.sub != null) return raw.sub != null && slugify(raw.sub) === slugify(to.sub) ? 'page' : undefined;
    return raw.sub != null ? 'true' : 'page';
  }
  if (raw.page === 'product') return String(raw.id) === String(to.id) ? 'page' : undefined;
  if (raw.page === 'search') return (raw.q || '').trim().toLowerCase() === (to.q || '').trim().toLowerCase() ? 'page' : undefined;
  return 'page';
}
