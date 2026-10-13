// Breadcrumb trail (AW-043): a navigation landmark with an ordered list of
// links, the current page last with aria-current="page". Separators are drawn
// in CSS after every crumb but the last (.crumbs li:not(:last-child)::after),
// so a trail that wraps ends its first row with the slash and never starts
// a row with one (NEW-041). Every crumb is a link or a span, never a button,
// so all of them take the trail's capitals (AW-325).

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

// The catalog trail is built in src/lib/crumbs.js, which meta.js also reads
// for the page's BreadcrumbList (AW-320).
export { ALL_PRODUCTS_CRUMB, HOME_CRUMB, catalogCrumbs } from '../lib/crumbs.js';
