// Departments derived from the loaded catalog: the navigation order first,
// then any department the live catalog adds, each with its product lines and
// SKU count.

import { NAV_ORDER } from '../data/products.js';
import { catLabel } from './format.js';

export function departmentsFor(products) {
  const known = new Set(NAV_ORDER);
  const extras = [];
  for (const p of products) {
    if (p.cat && !known.has(p.cat) && !extras.includes(p.cat)) extras.push(p.cat);
  }
  return [...NAV_ORDER, ...extras].map(name => {
    const rows = products.filter(p => p.cat === name);
    const subs = Array.from(new Set(rows.map(p => p.sub).filter(Boolean))).sort();
    return { key: name, label: catLabel(name), subs, count: rows.length };
  });
}

// A department's biggest product lines: the `n` with the most products, ties
// in name order (AW-061). The home page's department tiles and the header's
// Categories menu (AW-062) list these; `subs` above stays alphabetical for
// the routes, pages and meta.
export function topLines(products, deptKey, n = 3) {
  const counts = new Map();
  for (const p of products) {
    if (p.cat === deptKey && p.sub) counts.set(p.sub, (counts.get(p.sub) || 0) + 1);
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, n)
    .map(([sub]) => sub);
}
