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
