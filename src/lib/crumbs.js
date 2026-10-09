// The catalog's breadcrumb trail (AW-043, AW-226), as data: the visible
// trail (src/components/Breadcrumbs.jsx) and the page's BreadcrumbList
// structured data (src/lib/meta.js, AW-320) are built from it. Pure, with no
// React, so scripts/build-route-heads.mjs can load it through meta.js.

import { catLabel, sharesDepartmentName } from './format.js';

export const HOME_CRUMB = { label: 'Home', to: '/' };
export const ALL_PRODUCTS_CRUMB = { label: 'All products', to: '/catalog' };

// The trail of a catalog page (AW-226): Home / All products / department /
// product line / product, as deep as the page goes. Every parent is a link,
// so a line page leads back to its whole department; the page itself is last
// and not a link. `query` (a department page's filters) carries onto the
// department and line links. A line named like its department (Motor Oil's
// 'Motor Oil') keeps both levels, which are different pages: the department
// crumb says it is the department (NEW-029).
export function catalogCrumbs({ category, sub = null, product = null, query }) {
  const route = (line) => ({ page: 'category', category, sub: line, ...(query ? { query } : {}) });
  const department = sharesDepartmentName(category, sub) ? `${catLabel(category)} department` : catLabel(category);
  const trail = [{ label: department, to: route(null) }];
  if (sub) trail.push({ label: sub, to: route(sub) });
  if (product) trail.push({ label: product.name });
  const page = trail.length - 1;
  return [HOME_CRUMB, ALL_PRODUCTS_CRUMB, ...trail.map((item, i) => (i === page ? { label: item.label } : item))];
}
