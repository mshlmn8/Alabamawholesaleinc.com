// Breadcrumb trail (AW-043): a navigation landmark with an ordered list of
// links, the current page last with aria-current="page". Separators are drawn
// in CSS (.crumbs li + li::before).

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
