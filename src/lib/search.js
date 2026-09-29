// Product search: the header's ranked suggestions and the department page's
// in-category text filter share the same searchable text.

export const productText = (p) => `${p.name} ${p.brand} ${p.cat} ${p.sub} ${p.sku} ${(p.variants || []).join(' ')}`.toLowerCase();

export const getSearchMatches = (products, query, limit = 10) => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return products
    .map(p => {
      const h = productText(p);
      const score =
        (p.name.toLowerCase().includes(q) ? 80 : 0) +
        (String(p.sku).toLowerCase().includes(q) ? 70 : 0) +
        (p.brand.toLowerCase().includes(q) ? 45 : 0) +
        (p.cat.toLowerCase().includes(q) ? 24 : 0) +
        (terms.every(t => h.includes(t)) ? 30 : 0) +
        terms.filter(t => h.includes(t)).length * 8;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(x => x.p);
};
