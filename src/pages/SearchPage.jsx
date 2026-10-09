// Search results (AW-007): /search?q=. Every product that matches the query
// under the catalog search rules (src/lib/search.js, AW-063, AW-064), as
// product cards; the first 48, then "Show all". A query no product matches
// in full shows related products, labelled as such, and one that matches
// nothing offers the departments, the full catalog and the trade desk.
//
// The page is noindex and its title names the query (src/lib/meta.js); it
// is not in the sitemap. App keys it by URL, so each query starts fresh, and
// each query is a page of its own (pageKeyFor): its h1 takes focus and is
// announced.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, navigate } from '../lib/router.js';
import { MIN_QUERY_LENGTH, searchProducts } from '../lib/search.js';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { PricingNotice } from '../components/PricingNotice.jsx';

// Cards shown before "Show all".
export const SEARCH_PAGE_SIZE = 48;

export function SearchPage({ q = '', products, departments, ...cardProps }) {
  const query = String(q).trim();
  const ready = query.length >= MIN_QUERY_LENGTH;
  const result = useMemo(() => searchProducts(products, query), [products, query]);
  const [draft, setDraft] = useState(query);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? result.items : result.items.slice(0, SEARCH_PAGE_SIZE);

  // "Show all" goes away when pressed; focus moves to the first card it added.
  const grid = useRef(null);
  useEffect(() => {
    if (showAll) grid.current?.querySelectorAll('a.card-link')[SEARCH_PAGE_SIZE]?.focus();
  }, [showAll]);

  const submit = (e) => {
    e.preventDefault();
    navigate({ page: 'search', q: draft.trim() });
  };

  let note = `Type at least ${MIN_QUERY_LENGTH} characters.`;
  if (ready && result.related) note = `No exact matches for “${query}”. Related products:`;
  else if (ready) note = `${result.total} product${result.total === 1 ? '' : 's'}`;

  return (
    <section className="search-page">
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Search' }]} />
        <p className="eyebrow">SEARCH</p>
        <h1>{ready ? `Results for “${query}”` : 'Search the catalog'}</h1>
        <form className="search-form" role="search" aria-label="Catalog" onSubmit={submit}>
          <label className="filter-search" htmlFor="search-page-input"><span>Search products, brands or SKUs</span>
            <input id="search-page-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
          </label>
          <button className="button" type="submit">Search</button>
        </form>
      </div>

      <div className="search-toolbar">
        <p className="result-note" role="status">{note}</p>
      </div>

      {ready && result.total > 0 && (
        <>
          {/* Pricing is explained once, above the grid (AW-224). */}
          <PricingNotice profile={cardProps.profile} isApprovedBuyer={cardProps.isApprovedBuyer} onLoginClick={cardProps.onLoginClick} onApplyClick={cardProps.onApplyClick} />
          {/* The cards' h3 titles sit under an h2, as on department pages. */}
          <h2 className="sr-only">Products</h2>
          <div className="card-grid" ref={grid}>
            {/* showSku: search results keep the SKU on the card. The first
                row (four cards, two on phones) loads at once, the first photo
                first (AW-323); the explicit props come after the spread. */}
            {shown.map((p, i) => <ProductCard key={p.id} p={p} {...cardProps} showSku eager={i < 4} priority={i === 0} />)}
          </div>
          {!showAll && result.total > SEARCH_PAGE_SIZE && (
            <div className="search-more">
              <button className="button ghost" type="button" onClick={() => setShowAll(true)}>{`Show all ${result.total}`}</button>
            </div>
          )}
        </>
      )}

      {ready && result.total === 0 && (
        <div className="empty-results search-empty">
          <h2>{`No products match “${query}”.`}</h2>
          <p>Try another spelling, a brand or a SKU, or browse a department.</p>
          <ul className="sub-pills">
            {departments.map(d => (
              <li key={d.key}><Link className="sub-pill" to={{ page: 'category', category: d.key }}>{`${d.label} (${d.count})`}</Link></li>
            ))}
          </ul>
          <div className="search-empty-links">
            <Link className="text-link" to="/catalog">Browse all products</Link>
            <Link className="text-link" to="/contact">Ask the trade desk about an item</Link>
          </div>
        </div>
      )}
    </section>
  );
}
