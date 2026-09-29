// Not found (AW-188, AW-232): unknown or malformed addresses, and products,
// departments or product lines that are not in the catalog. Instead of a
// dead end it offers a catalog search, the departments and the full catalog.
// The page is marked noindex (src/lib/meta.js). Nothing from the unknown URL
// is echoed into the heading, breadcrumb or title.
//
// A product, department or line that isn't in the copy of the catalog
// bundled with the site may still be in the live one (AW-204): while that
// loads, the page says it is loading instead of "not found", and when it
// could not be loaded it says so and offers to try again (`catalog` is
// 'loading' or 'error'; App decides).

import { useMemo, useState } from 'react';
import { Link, navigate } from '../lib/router.js';
import { getSearchMatches } from '../lib/search.js';
import { catLabel } from '../lib/format.js';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';

// While the live catalog loads, and when it could not be loaded.
const PENDING = {
  product: { title: 'Loading product…', eyebrow: 'PRODUCT', failed: 'We couldn’t load this product' },
  department: { title: 'Loading department…', eyebrow: 'DEPARTMENT', failed: 'We couldn’t load this department' },
  line: { title: 'Loading product line…', eyebrow: 'PRODUCT LINE', failed: 'We couldn’t load this product line' },
};

const COPY = {
  page: { title: 'Page not found', text: 'We couldn’t find a page at this address. The link may be incomplete or out of date.' },
  product: { title: 'Product not found', text: 'This product isn’t in the catalog. It may no longer be listed, or the link may be incomplete.' },
  department: { title: 'Department not found', text: 'There’s no department at this address. Choose one of the departments below or search the catalog.' },
  line: { title: 'Product line not found', text: 'This product line isn’t in the department. The link may be incomplete or out of date.' },
};

export function NotFoundPage({ kind = 'page', category = null, products, departments, catalog = null, onRetry, retrying = false }) {
  const pending = catalog && PENDING[kind] ? PENDING[kind] : null;
  const loading = !!pending && catalog === 'loading';
  const failed = pending && catalog === 'error' ? pending.failed : null;
  let copy = COPY[kind] || COPY.page;
  if (loading) copy = { title: pending.title, text: 'Getting the latest catalog.' };
  else if (failed) copy = { title: failed, text: 'The latest catalog didn’t load, so we can’t show this page right now. Check your connection and try again.' };
  let eyebrow = 'NOT FOUND';
  let crumb = copy.title;
  if (loading) {
    eyebrow = pending.eyebrow;
    crumb = 'Loading';
  } else if (failed) {
    eyebrow = 'CATALOG UNAVAILABLE';
    crumb = 'Catalog unavailable';
  }
  const [query, setQuery] = useState('');
  const hits = useMemo(() => getSearchMatches(products, query, 8), [products, query]);
  const searching = query.trim().length >= 2;
  const dept = category ? departments.find(d => d.key === category) : null;
  const status = !searching ? '' : hits.length ? `${hits.length} matching product${hits.length === 1 ? '' : 's'}` : 'No matches. Try a brand, a product line or a SKU.';

  const openFirst = (e) => {
    e.preventDefault();
    if (hits.length) navigate({ page: 'product', productId: hits[0].id });
  };

  return (
    <section className="support-page not-found">
      <div className="page-head">
        {/* One head for every state, so the heading keeps focus when the
            loading view turns into "not found" or the error. */}
        <Breadcrumbs items={[HOME_CRUMB, { label: crumb }]} />
        <p className="eyebrow">{eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        {failed && onRetry && (
          <div className="dialog-actions compact-actions not-found-retry">
            <button className="button" type="button" onClick={onRetry} disabled={retrying}>
              <span>{retrying ? 'Trying again…' : 'Try again'}</span> <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}
        {dept && !loading && (
          <p>
            <Link className="text-link" to={{ page: 'category', category: dept.key }}><span>{`Browse all ${dept.label}`}</span> <span aria-hidden="true">↗</span></Link>
          </p>
        )}
      </div>

      {!loading && (
        <div className="not-found-layout">
          <section className="not-found-search" aria-labelledby="not-found-search-title">
            <h2 id="not-found-search-title">Search the catalog</h2>
            <form role="search" aria-labelledby="not-found-search-title" onSubmit={openFirst}>
              <label className="filter-search" htmlFor="not-found-search"><span>Product, brand or SKU</span>
                <input id="not-found-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                       placeholder="Backwoods, energy drinks, AW-KITE…" autoComplete="off" />
              </label>
            </form>
            <p className="result-note" role="status">{status}</p>
            {searching && hits.length > 0 && (
              <ul className="sku-list not-found-hits">
                {hits.map(p => (
                  <li key={p.id}>
                    <Link to={{ page: 'product', productId: p.id }}>
                      <b>{p.name}</b>
                      <small>{`${catLabel(p.cat)} · ${p.sub} · ${p.sku}`}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <nav className="not-found-browse" aria-labelledby="not-found-browse-title">
            <h2 id="not-found-browse-title">Browse by department</h2>
            <ul className="sub-pills">
              {departments.map(d => (
                <li key={d.key}><Link className="sub-pill" to={{ page: 'category', category: d.key }}>{`${d.label} (${d.count})`}</Link></li>
              ))}
            </ul>
            <p className="not-found-links">
              <Link className="text-link" to="/catalog">All products</Link>
              <Link className="text-link" to="/">Home</Link>
            </p>
          </nav>
        </div>
      )}
    </section>
  );
}
