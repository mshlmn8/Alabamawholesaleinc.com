// Breadcrumb trail (AW-043): a navigation landmark with an ordered list of
// links, the current page last with aria-current="page". Separators are drawn
// in CSS (.crumbs li + li::before). Every crumb is a link or a span, never a
// button, so all of them take the trail's capitals (AW-325).

import { catLabel } from '../lib/format.js';
import { Link } from '../lib/router.js';

// items: [{ label, to, onClick }], where `to` is an href or a route object.
// The last item is the current page and is not a link.
export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`}>
            {i < items.length - 1 && item.to
              ? <Link to={item.to} onClick={item.onClick}>{item.label}</Link>
              : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const HOME_CRUMB = { label: 'Home', to: '/' };
export const ALL_PRODUCTS_CRUMB = { label: 'All products', to: '/catalog' };

// The trail of a catalog page (AW-226): Home / All products / department /
// product line / product, as deep as the page goes. Every parent is a link,
// so a line page leads back to its whole department; the page itself is last
// and not a link. `query` (a department page's filters) carries onto the
// department and line links.
export function catalogCrumbs({ category, sub = null, product = null, query }) {
  const route = (line) => ({ page: 'category', category, sub: line, ...(query ? { query } : {}) });
  const trail = [{ label: catLabel(category), to: route(null) }];
  if (sub) trail.push({ label: sub, to: route(sub) });
  if (product) trail.push({ label: product.name });
  const page = trail.length - 1;
  return [HOME_CRUMB, ALL_PRODUCTS_CRUMB, ...trail.map((item, i) => (i === page ? { label: item.label } : item))];
}
