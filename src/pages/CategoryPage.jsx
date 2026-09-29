// Department page: sub-line pills, filters (sidebar on desktop, drawer on
// phones), sort, active-filter chips and the product grid.

import { useState, useEffect } from 'react';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { productText } from '../lib/search.js';
import { catLabel } from '../lib/format.js';
import { ModalLayer } from '../components/ModalLayer.jsx';
import { ProductCard } from '../components/ProductCard.jsx';

export function CategoryPage({ category, sub, products, departments, profile, isApprovedBuyer, cart, addLine, decLine, goProduct, goCategory, goHome, onLoginClick }) {
  const [tagFilter, setTagFilter] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [sort, setSort] = useState('featured');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // Resets the filters when the department changes. AW-228 replaces this by
  // keying CategoryPage on the department.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTagFilter([]);
    setHasVariants(false);
    setSearchQ('');
    setSort('featured');
    setFiltersOpen(false);
  }, [category]);

  const cat = departments.find(c => c.key === category);
  const inCategory = products.filter(p => p.cat === category);
  const activeSub = sub || null;
  const tagOptions = [
    ['Bestsellers', 'BESTSELLER'],
    ['New', 'NEW'],
    ['Deals', 'DEAL'],
    ['Premium', 'PREMIUM'],
  ];
  const query = searchQ.trim().toLowerCase();
  let items = inCategory.filter(p => {
    if (activeSub && p.sub !== activeSub) return false;
    if (tagFilter.length && !tagFilter.includes(p.tag)) return false;
    if (hasVariants && p.flavors === 0) return false;
    if (query && !productText(p).includes(query)) return false;
    return true;
  });
  if (sort === 'name-asc') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') items = [...items].sort((a, b) => b.name.localeCompare(a.name));
  if (sort === 'variants') items = [...items].sort((a, b) => b.flavors - a.flavors);
  if (sort === 'price-low' && isApprovedBuyer) items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'price-high' && isApprovedBuyer) items = [...items].sort((a, b) => b.price - a.price);

  const toggleTag = (tag) => setTagFilter(current => current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]);
  const clearFilters = () => {
    setTagFilter([]);
    setHasVariants(false);
    setSearchQ('');
    goCategory(category, null);
  };
  const activeFilterCount = (activeSub ? 1 : 0) + tagFilter.length + (hasVariants ? 1 : 0) + (query ? 1 : 0);

  if (!cat) {
    return (
      <section className="page-head">
        <h1>Department not found</h1>
        <p>That department doesn&apos;t exist. <button className="text-link" onClick={goHome}>Back to home</button></p>
      </section>
    );
  }

  const chips = [];
  if (activeSub) chips.push({ key: 'sub', label: activeSub, remove: () => goCategory(category, null) });
  tagFilter.forEach(tag => chips.push({ key: `tag-${tag}`, label: tagOptions.find(([, t]) => t === tag)?.[0] || tag, remove: () => toggleTag(tag) }));
  if (hasVariants) chips.push({ key: 'variants', label: 'Has variants', remove: () => setHasVariants(false) });
  if (query) chips.push({ key: 'query', label: `“${searchQ.trim()}”`, remove: () => setSearchQ('') });

  const resultNote = (
    <p className="result-note" role="status">
      Showing <strong>{items.length}</strong> of {inCategory.length} item{inCategory.length === 1 ? '' : 's'}{activeSub ? ` in ${activeSub}` : ''}
    </p>
  );
  const sortControl = (
    <label className="category-sort" htmlFor="category-sort">Sort by
      <select id="category-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
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
      <label className="filter-search" htmlFor="category-search">Search in {catLabel(category)}
        <input id="category-search" type="search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Item, brand, SKU, variant…" autoComplete="off" />
      </label>
      <fieldset>
        <legend>Featured</legend>
        {tagOptions.map(([label, tag]) => (
          <label key={tag}><input type="checkbox" checked={tagFilter.includes(tag)} onChange={() => toggleTag(tag)} /> <span>{label}</span></label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Variants</legend>
        <label><input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} /> <span>Has flavors or variants</span></label>
      </fieldset>
      {!profile && <button className="filter-signin" type="button" onClick={onLoginClick}><b>Wholesale pricing is locked</b><span>Sign in to see your account pricing.</span></button>}
      {profile && !isApprovedBuyer && <p className="filter-signin"><b>Pricing after approval</b><span>Your account is not approved for trade pricing yet.</span></p>}
    </div>
  );
  const closeFilters = () => setFiltersOpen(false);

  return (
    <section>
      <div className="page-head">
        <div className="crumbs">
          <button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span><span>{catLabel(category)}</span>
          {activeSub && <><span aria-hidden="true">/</span><span>{activeSub}</span></>}
        </div>
        <p className="eyebrow">DEPARTMENT · {String(cat.count).padStart(2, '0')} SKUs</p>
        <h1>{catLabel(category)}</h1>
        <p>Wholesale {catLabel(category).toLowerCase()} for licensed retail accounts. {isApprovedBuyer ? 'Your tier pricing is shown on each card.' : profile ? 'Pricing unlocks after your account is approved.' : 'Sign in to see your wholesale pricing.'}</p>
        <div className="sub-pills" role="group" aria-label={`${catLabel(category)} subcategories`}>
          <button className={`sub-pill ${!activeSub ? 'active' : ''}`} type="button" aria-pressed={!activeSub} onClick={() => goCategory(category, null)}>All ({cat.count})</button>
          {cat.subs.map(s => {
            const count = inCategory.filter(p => p.sub === s).length;
            return <button key={s} className={`sub-pill ${activeSub === s ? 'active' : ''}`} type="button" aria-pressed={activeSub === s} onClick={() => goCategory(category, s)}>{s} ({count})</button>;
          })}
        </div>
      </div>

      <div className="category-toolbar">
        <div className="toolbar-row">
          {isMobile && (
            <button className="filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls={filtersOpen ? 'aw-filter-drawer' : undefined} onClick={() => setFiltersOpen(true)}>
              <span className="filter-icon" aria-hidden="true"></span>
              Filter &amp; Sort
              {activeFilterCount > 0 && <span className="filter-count"><span className="sr-only">, </span>{activeFilterCount}<span className="sr-only"> active</span></span>}
            </button>
          )}
          {resultNote}
          {!isMobile && sortControl}
        </div>
        {chips.length > 0 && (
          <ul className="active-filters" aria-label="Active filters">
            {chips.map(c => (
              <li key={c.key}><button type="button" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>{c.label} <span aria-hidden="true">×</span></button></li>
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
              <button className="dialog-close" type="button" onClick={closeFilters} aria-label="Close filters">×</button>
            </div>
            <div className="drawer-body filter-drawer-body">
              {sortControl}
              {filterPanel}
            </div>
            <div className="drawer-foot">
              <div className="drawer-actions">
                {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>Clear all ({activeFilterCount})</button>}
                <button className="button" type="button" onClick={closeFilters}>Show {items.length} item{items.length === 1 ? '' : 's'} <span aria-hidden="true">↗</span></button>
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
              {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>Clear all ({activeFilterCount})</button>}
            </div>
            {filterPanel}
          </aside>
        )}

        <div>
          {items.length > 0 ? (
            <div className="card-grid category-card-grid">
              {items.map(p => (
                <ProductCard key={p.id} p={p} profile={profile} isApprovedBuyer={isApprovedBuyer} cart={cart}
                             addLine={addLine} decLine={decLine} goProduct={goProduct} onLoginClick={onLoginClick} />
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
