// Department page: product-line pills, filters (sidebar on desktop, drawer on
// phones), sort, active-filter chips and the product grid.
//
// The URL is the only filter state (AW-008): the product line is in the path
// and the search text, sort and filters in the query string
// (/category/candies/gum?q=mint&sort=name-asc&tags=new&variants=1). Back,
// Forward, reload and shared links all restore the same view. Filter changes
// replace the history entry and keep the scroll position (AW-327); the
// product-line pills are links. App keys this page by department (AW-228).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { matchesQuery } from '../lib/search.js';
import { variantCount } from '../lib/lines.js';
import { catLabel } from '../lib/format.js';
import { tierPriceNote } from '../lib/pricing.js';
import { Link, navigate } from '../lib/router.js';
import { EMPTY_CATEGORY_QUERY } from '../lib/routes.js';
import { PRICE_LOCK, accountStatus } from '../lib/accountStatus.js';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { ModalLayer } from '../components/ModalLayer.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { Icon } from '../components/Icon.jsx';
import { SkuCount } from '../components/SkuCount.jsx';

// TODO(owner): What do the DEAL and PREMIUM tags mean for buyers (the actual deal terms and premium criteria), or should those tags be removed? (AW-139)
const TAG_OPTIONS = [
  ['Bestsellers', 'BESTSELLER'],
  ['New', 'NEW'],
  ['Deals', 'DEAL'],
  ['Premium', 'PREMIUM'],
];

// The Featured checkboxes worth showing (AW-139, Cursor PR #13): each tag the
// products in view (the department, or the picked line) carry, with its
// count. A tag already picked stays, so it can be unpicked. No options, no
// Featured box.
export function featuredOptions(products, picked = []) {
  return TAG_OPTIONS
    .map(([label, tag]) => ({ label, tag, count: products.filter(p => p.tag === tag).length }))
    .filter(o => o.count > 0 || picked.includes(o.tag));
}

// Typing in the department search updates the URL once the typing pauses.
const SEARCH_DELAY_MS = 250;

const NO_PRICES = () => null;

// Price sorts use the signed-in buyer's prices (priceOf, AW-003); products
// without one (price on request, or not loaded yet) go last, in catalog order.
function byPrice(priceOf, direction) {
  return (a, b) => {
    const pa = priceOf(a.id);
    const pb = priceOf(b.id);
    if (pa == null || pb == null) return (pa == null) - (pb == null);
    return direction * (pa - pb);
  };
}

export function CategoryPage({
  category, sub, query = EMPTY_CATEGORY_QUERY, products, departments, profile, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off',
  priceTier = null, cart, addLine, decLine, onLoginClick,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // The search box shows what is typed right away; the URL (and the results)
  // follow after a short pause. A change from elsewhere (Back, Clear all)
  // replaces what is in the box.
  const [draft, setDraft] = useState(query.q);
  const [draftFor, setDraftFor] = useState(query.q);
  if (draftFor !== query.q) {
    setDraftFor(query.q);
    // The URL drops outer spaces; keep a space the user is still typing.
    if (draft.trim() !== query.q.trim()) setDraft(query.q);
  }
  const searchTimer = useRef(0);
  useEffect(() => {
    const timer = searchTimer;
    return () => window.clearTimeout(timer.current);
  }, []);
  // The line and filters at the moment a delayed search write happens.
  const latest = useRef({ sub, query });
  useLayoutEffect(() => { latest.current = { sub, query }; });

  const cat = departments.find(c => c.key === category);
  const inCategory = products.filter(p => p.cat === category);
  const activeSub = sub || null;
  const inScope = activeSub ? inCategory.filter(p => p.sub === activeSub) : inCategory;
  const { tags, variants: hasVariants } = query;
  const featured = featuredOptions(inScope, tags);
  const sort = query.sort.startsWith('price-') && !isApprovedBuyer ? 'featured' : query.sort;
  // Why there are no prices: not signed in, waiting for approval, or on hold
  // (AW-101). An account on hold is told to call, not to wait.
  const status = accountStatus(profile);
  const lock = PRICE_LOCK[status] || PRICE_LOCK.pending;
  const needle = query.q.trim().toLowerCase();
  let items = inScope.filter(p => {
    if (tags.length && !tags.includes(p.tag)) return false;
    // A single variant is not a choice (AW-233).
    if (hasVariants && variantCount(p) <= 1) return false;
    if (needle && !matchesQuery(p, query.q)) return false;
    return true;
  });
  if (sort === 'name-asc') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') items = [...items].sort((a, b) => b.name.localeCompare(a.name));
  if (sort === 'variants') items = [...items].sort((a, b) => variantCount(b) - variantCount(a));
  if (sort === 'price-low') items = [...items].sort(byPrice(priceOf, 1));
  if (sort === 'price-high') items = [...items].sort(byPrice(priceOf, -1));

  const here = (changes = {}) => ({ page: 'category', category, sub: activeSub, query, ...changes });
  // Filter changes rewrite the current history entry and keep the scroll position.
  const setFilters = (changes) => navigate(here({ query: { ...query, ...changes } }), { replace: true, scroll: false });
  const cancelSearch = () => window.clearTimeout(searchTimer.current);
  const onSearchInput = (value) => {
    setDraft(value);
    cancelSearch();
    searchTimer.current = window.setTimeout(() => {
      const now = latest.current;
      navigate({ page: 'category', category, sub: now.sub || null, query: { ...now.query, q: value } }, { replace: true, scroll: false });
    }, SEARCH_DELAY_MS);
  };
  const clearSearch = () => {
    cancelSearch();
    setDraft('');
    setFilters({ q: '' });
  };
  const toggleTag = (tag) => setFilters({ tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] });
  // Clears the product line and every filter; the sort order stays.
  const clearFilters = () => {
    cancelSearch();
    setDraft('');
    navigate({ page: 'category', category, sub: null, query: { ...EMPTY_CATEGORY_QUERY, sort: query.sort } }, { replace: true, scroll: false });
  };
  const activeFilterCount = (activeSub ? 1 : 0) + tags.length + (hasVariants ? 1 : 0) + (needle ? 1 : 0);

  // Removing a chip is a filter change like any other: it replaces the entry.
  const chips = [];
  if (activeSub) chips.push({ key: 'sub', label: activeSub });
  tags.forEach(tag => chips.push({ key: `tag-${tag}`, tag, label: TAG_OPTIONS.find(([, t]) => t === tag)?.[0] || tag }));
  if (hasVariants) chips.push({ key: 'variants', label: 'Has variants' });
  if (needle) chips.push({ key: 'query', label: `“${query.q.trim()}”` });
  const removeChip = (chip) => {
    if (chip.key === 'sub') navigate(here({ sub: null }), { replace: true, scroll: false });
    else if (chip.tag) toggleTag(chip.tag);
    else if (chip.key === 'variants') setFilters({ variants: false });
    else if (chip.key === 'query') clearSearch();
  };

  // With a product line picked, the count compares against that line (AW-232).
  const resultNote = (
    <p className="result-note" role="status">
      Showing <strong>{items.length}</strong> <span>{`of ${inScope.length} item${inScope.length === 1 ? '' : 's'}${activeSub ? ` in ${activeSub}` : ''}`}</span>
    </p>
  );
  const sortControl = (
    <label className="category-sort" htmlFor="category-sort">Sort by
      <select id="category-sort" value={sort} onChange={(e) => setFilters({ sort: e.target.value })}>
        <option value="featured">Featured</option>
        <option value="name-asc">Name: A to Z</option>
        <option value="name-desc">Name: Z to A</option>
        <option value="variants">Most variants</option>
        {isApprovedBuyer && <option value="price-low">Price: Low to High</option>}
        {isApprovedBuyer && <option value="price-high">Price: High to Low</option>}
      </select>
    </label>
  );
  const filterPanel = (
    <div className="filter-panel">
      <label className="filter-search" htmlFor="category-search"><span>{`Search in ${catLabel(category)}`}</span>
        <input id="category-search" type="search" value={draft} onChange={(e) => onSearchInput(e.target.value)} placeholder="Item, brand, SKU, variant…" autoComplete="off" />
      </label>
      {featured.length > 0 && (
        <fieldset>
          <legend>Featured</legend>
          {featured.map(({ label, tag, count }) => (
            <label key={tag}><input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} /> <span>{`${label} (${count})`}</span></label>
          ))}
        </fieldset>
      )}
      <fieldset>
        <legend>Variants</legend>
        <label><input type="checkbox" checked={hasVariants} onChange={(e) => setFilters({ variants: e.target.checked })} /> <span>Has flavors or variants</span></label>
      </fieldset>
      {!profile && <button className="filter-signin" type="button" onClick={onLoginClick}><b>Wholesale pricing is locked</b><span>Sign in to see your account pricing.</span></button>}
      {profile && !isApprovedBuyer && <p className="filter-signin"><b>{lock.short}</b><span>{lock.detail}</span></p>}
    </div>
  );
  const closeFilters = () => setFiltersOpen(false);

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: catLabel(category), to: here({ sub: null }) }, ...(activeSub ? [{ label: activeSub }] : [])]} />
        <p className="eyebrow"><SkuCount lead="DEPARTMENT · " count={String(cat?.count ?? inCategory.length).padStart(2, '0')} /></p>
        <h1>{catLabel(category)}</h1>
        {/* An approved buyer is told whose prices the cards show, from my_prices() (AW-107). */}
        <p>{`Wholesale ${catLabel(category).toLowerCase()} for licensed retail accounts. ${isApprovedBuyer ? tierPriceNote(priceTier) : (status === 'suspended' ? lock.detail : lock.line)}`}</p>
        <nav className="sub-pills" aria-label={`${catLabel(category)} product lines`}>
          <Link className={`sub-pill ${!activeSub ? 'active' : ''}`} to={here({ sub: null })} scroll={false} aria-current={!activeSub ? 'page' : undefined}>{`All (${inCategory.length})`}</Link>
          {(cat?.subs || []).map(s => {
            const count = inCategory.filter(p => p.sub === s).length;
            return <Link key={s} className={`sub-pill ${activeSub === s ? 'active' : ''}`} to={here({ sub: s })} scroll={false} aria-current={activeSub === s ? 'page' : undefined}>{`${s} (${count})`}</Link>;
          })}
        </nav>
      </div>

      <div className="category-toolbar">
        <div className="toolbar-row">
          {isMobile && (
            <button className="filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls={filtersOpen ? 'aw-filter-drawer' : undefined} onClick={() => setFiltersOpen(true)}>
              <Icon name="filter" />
              Filter &amp; Sort
              {activeFilterCount > 0 && <span className="filter-count"><span className="sr-only">, </span><span>{activeFilterCount}</span><span className="sr-only"> active</span></span>}
            </button>
          )}
          {resultNote}
          {!isMobile && sortControl}
        </div>
        {chips.length > 0 && (
          <ul className="active-filters" aria-label="Active filters">
            {chips.map(c => (
              <li key={c.key}><button type="button" onClick={() => removeChip(c)} aria-label={`Remove filter ${c.label}`}><span>{c.label}</span><Icon name="close" /></button></li>
            ))}
            <li><button className="text-link" type="button" onClick={clearFilters}>Clear all</button></li>
          </ul>
        )}
      </div>

      {isMobile && filtersOpen && (
        <ModalLayer onClose={closeFilters} className="aw-filter-layer">
          <div className="overlay" aria-hidden="true" onClick={closeFilters} />
          <aside className="drawer filter-drawer" role="dialog" aria-modal="true" aria-labelledby="aw-filter-title" id="aw-filter-drawer">
            <div className="drawer-head">
              <h2 id="aw-filter-title">Filter &amp; Sort</h2>
              <button className="icon-btn" type="button" onClick={closeFilters} aria-label="Close filters"><Icon name="close" /></button>
            </div>
            <div className="drawer-body filter-drawer-body">
              {sortControl}
              {filterPanel}
            </div>
            <div className="drawer-foot">
              <div className="drawer-actions">
                {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>{`Clear all (${activeFilterCount})`}</button>}
                <button className="button" type="button" onClick={closeFilters}><span>{`Show ${items.length} item${items.length === 1 ? '' : 's'}`}</span></button>
              </div>
            </div>
          </aside>
        </ModalLayer>
      )}

      <div className={`catalog-layout${isMobile ? ' is-stacked' : ''}`}>
        {!isMobile && (
          <aside className="category-filters" aria-label="Product filters">
            <div className="filter-heading">
              <h2>Filters</h2>
              {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>{`Clear all (${activeFilterCount})`}</button>}
            </div>
            {filterPanel}
          </aside>
        )}

        <div>
          {items.length > 0 ? (
            <div className="card-grid category-card-grid">
              {items.map(p => (
                <ProductCard key={p.id} p={p} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart}
                             addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <h2>No products match</h2>
              <p>Try another search or clear the current filters.</p>
              <button className="button ghost" type="button" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
