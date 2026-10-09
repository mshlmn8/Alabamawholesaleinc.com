// Department page: product-line pills, filters (sidebar on desktop, drawer on
// phones), sort, active-filter chips and the product grid.
//
// The URL is the only filter state (AW-008): the product line is in the path
// and the search text, sort and filters in the query string
// (/category/candies/gum?q=mint&sort=name-asc&tags=new&brand=haribo&variants=1).
// Back, Forward, reload and shared links all restore the same view. Filter
// changes replace the history entry and keep the scroll position (AW-327); the
// product-line pills are links. App keys this page by department (AW-228).
//
// Counts follow the filters (AW-225): each line pill (and the phone drawer's
// line choice, AW-223) counts what it would show with the other filters, and
// each brand counts what it would add with everything but the brands.
// A line page is headed by the line (AW-226).
//
// Pricing is explained once, by the PricingNotice above the grid (AW-224):
// the intro describes the department and the filters hold only filters. It
// follows `account` (useAuth's), so a signed-in buyer whose profile is still
// loading is never offered Sign in (NEW-002).

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { matchesQuery } from '../lib/search.js';
import { variantCount } from '../lib/lines.js';
import { featuredOrder } from '../lib/merchandising.js';
import { brandLabel, catLabel } from '../lib/format.js';
import { tierPriceNote } from '../lib/pricing.js';
import { Link, navigate } from '../lib/router.js';
import { EMPTY_CATEGORY_QUERY, slugify } from '../lib/routes.js';
import { Breadcrumbs, catalogCrumbs } from '../components/Breadcrumbs.jsx';
import { BackToTop } from '../components/BackToTop.jsx';
import { ModalLayer } from '../components/ModalLayer.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { PricingNotice } from '../components/PricingNotice.jsx';
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

// A product's brand as a URL slug; '' for the placeholder brand "Assorted"
// (AW-286), which names no brand and is never offered as one.
const brandSlug = (p) => slugify(brandLabel(p.brand));

// The Brand checkboxes (AW-067): each brand of `products` (the department or
// line with every other filter applied) with its count, most products first,
// then by name. A brand already picked stays, at (0), so it can be unpicked;
// `named` (the department) supplies its name.
export function brandOptions(products, picked = [], named = products) {
  const options = new Map();
  for (const p of products) {
    const slug = brandSlug(p);
    if (!slug) continue;
    const option = options.get(slug);
    if (option) option.count += 1;
    else options.set(slug, { slug, label: brandLabel(p.brand), count: 1 });
  }
  for (const slug of picked) {
    if (options.has(slug)) continue;
    const p = named.find((x) => brandSlug(x) === slug);
    if (p) options.set(slug, { slug, label: brandLabel(p.brand), count: 0 });
  }
  return [...options.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// The Brand box lists this many, plus any picked, until "Show all" is pressed.
const BRANDS_SHOWN = 8;

// Brand: A to Z, then the product name; products with no brand named last.
function byBrand(a, b) {
  const ba = brandLabel(a.brand);
  const bb = brandLabel(b.brand);
  if (!ba !== !bb) return ba ? -1 : 1;
  return ba.localeCompare(bb) || a.name.localeCompare(b.name);
}

// The row scroll that centres a product-line pill in the phone pill row
// (AW-157). The row is positioned in the compact layout, so the pill's
// offsetLeft is measured from it; scrollLeft keeps itself in range.
export function centredScrollLeft(pill, row) {
  const left = pill.offsetParent === row ? pill.offsetLeft : pill.offsetLeft - row.offsetLeft;
  return Math.max(0, Math.round(left + pill.offsetWidth / 2 - row.clientWidth / 2));
}

// Typing in the department search updates the URL once the typing pauses.
const SEARCH_DELAY_MS = 250;

const NO_PRICES = () => null;

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;

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
  category, sub, query = EMPTY_CATEGORY_QUERY, products, departments, profile, account, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off',
  priceTier = null, cart, addLine, decLine, onLoginClick, onApplyClick,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [allBrands, setAllBrands] = useState(false);
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
  // Brands in the URL that no product of the department carries are ignored.
  const brands = (query.brands || []).filter(slug => inCategory.some(p => brandSlug(p) === slug));
  const featured = featuredOptions(inScope, tags);
  const sort = query.sort.startsWith('price-') && !isApprovedBuyer ? 'featured' : query.sort;
  const needle = query.q.trim().toLowerCase();
  // Every filter but the product line: tags, variants, search and, unless
  // left out, brands.
  const passes = (p, { withBrands = true } = {}) => {
    if (tags.length && !tags.includes(p.tag)) return false;
    // A single variant is not a choice (AW-233).
    if (hasVariants && variantCount(p) <= 1) return false;
    if (needle && !matchesQuery(p, query.q)) return false;
    if (withBrands && brands.length && !brands.includes(brandSlug(p))) return false;
    return true;
  };
  const filtered = inCategory.filter(p => passes(p));
  const lines = (cat?.subs || []).map(s => ({ sub: s, count: filtered.filter(p => p.sub === s).length }));
  const brandChoices = brandOptions(inScope.filter(p => passes(p, { withBrands: false })), brands, inCategory);
  const brandsShown = allBrands ? brandChoices : brandChoices.filter((o, i) => i < BRANDS_SHOWN || brands.includes(o.slug));
  let items = activeSub ? filtered.filter(p => p.sub === activeSub) : filtered;
  // Featured (AW-227): homepage rank, then the tag, photos before the
  // placeholder, then id (src/lib/merchandising.js).
  if (sort === 'featured') items = featuredOrder(items);
  if (sort === 'name-asc') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') items = [...items].sort((a, b) => b.name.localeCompare(a.name));
  if (sort === 'brand') items = [...items].sort(byBrand);
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
  const toggleBrand = (slug) => setFilters({ brands: brands.includes(slug) ? brands.filter(b => b !== slug) : [...brands, slug] });
  // The phone drawer's line choice (AW-223) replaces the entry: a push while
  // the drawer holds its own history entry would race it.
  const pickLine = (line) => navigate(here({ sub: line || null }), { replace: true, scroll: false });
  // Clears the product line and every filter; the sort order stays.
  const clearFilters = () => {
    cancelSearch();
    setDraft('');
    navigate({ page: 'category', category, sub: null, query: { ...EMPTY_CATEGORY_QUERY, sort: query.sort } }, { replace: true, scroll: false });
  };
  const activeFilterCount = (activeSub ? 1 : 0) + tags.length + brands.length + (hasVariants ? 1 : 0) + (needle ? 1 : 0);

  // Removing a chip is a filter change like any other: it replaces the entry.
  const chips = [];
  if (activeSub) chips.push({ key: 'sub', label: activeSub });
  tags.forEach(tag => chips.push({ key: `tag-${tag}`, tag, label: TAG_OPTIONS.find(([, t]) => t === tag)?.[0] || tag }));
  brands.forEach(slug => chips.push({ key: `brand-${slug}`, brand: slug, label: `Brand: ${brandChoices.find(o => o.slug === slug)?.label || slug}` }));
  if (hasVariants) chips.push({ key: 'variants', label: 'Has variants' });
  if (needle) chips.push({ key: 'query', label: `“${query.q.trim()}”` });
  const removeChip = (chip) => {
    if (chip.key === 'sub') navigate(here({ sub: null }), { replace: true, scroll: false });
    else if (chip.tag) toggleTag(chip.tag);
    else if (chip.brand) toggleBrand(chip.brand);
    else if (chip.key === 'variants') setFilters({ variants: false });
    else if (chip.key === 'query') clearSearch();
  };

  // No matches (AW-299): clear the filters, search every department for the
  // same words, or go to another department.
  const otherDepartments = departments.filter(d => d.key !== category && d.count > 0);
  const noResultActions = (
    <>
      {needle && <Link className="button" to={{ page: 'search', q: query.q }}>{`Search all departments for “${query.q.trim()}”`}</Link>}
      <button className="button ghost" type="button" onClick={clearFilters}>Clear filters</button>
      {otherDepartments.length > 0 && (
        <ul className="sub-pills" aria-label="Other departments">
          {otherDepartments.map(d => (
            <li key={d.key}><Link className="sub-pill" to={{ page: 'category', category: d.key }}>{`${d.label} (${d.count})`}</Link></li>
          ))}
        </ul>
      )}
    </>
  );

  // With a product line picked, the count compares against that line (AW-232).
  // Phones show the note without the line's name (AW-158, .result-scope).
  const resultNote = (
    <p className="result-note" role="status">
      Showing <strong>{items.length}</strong> <span>{`of ${inScope.length} item${inScope.length === 1 ? '' : 's'}${activeSub ? ' ' : ''}`}</span><span className="result-scope">{activeSub ? `in ${activeSub}` : ''}</span>
    </p>
  );
  const sortControl = (
    <label className="category-sort" htmlFor="category-sort">Sort by
      <select id="category-sort" value={sort} onChange={(e) => setFilters({ sort: e.target.value })}>
        <option value="featured">Featured</option>
        <option value="name-asc">Name: A to Z</option>
        <option value="name-desc">Name: Z to A</option>
        <option value="brand">Brand: A to Z</option>
        <option value="variants">Most variants</option>
        {isApprovedBuyer && <option value="price-low">Price: Low to High</option>}
        {isApprovedBuyer && <option value="price-high">Price: High to Low</option>}
      </select>
    </label>
  );
  const filterPanel = (
    <div className="filter-panel">
      <label className="filter-search" htmlFor="category-search"><span>{`Search in ${catLabel(category)}`}</span>
        <input id="category-search" type="search" value={draft} onChange={(e) => onSearchInput(e.target.value)} placeholder="Name, brand or SKU" autoComplete="off" />
      </label>
      {featured.length > 0 && (
        <fieldset>
          <legend>Featured</legend>
          {featured.map(({ label, tag, count }) => (
            <label key={tag}><input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} /> <span>{`${label} (${count})`}</span></label>
          ))}
        </fieldset>
      )}
      {brandChoices.length > 0 && (
        <fieldset>
          <legend>Brand</legend>
          <div id="category-brands">
            {brandsShown.map(({ slug, label, count }) => (
              <label key={slug}><input type="checkbox" checked={brands.includes(slug)} onChange={() => toggleBrand(slug)} /> <span>{`${label} (${count})`}</span></label>
            ))}
          </div>
          {brandChoices.length > BRANDS_SHOWN && (
            <button className="text-link" type="button" aria-expanded={allBrands} aria-controls="category-brands" onClick={() => setAllBrands(!allBrands)}>
              {allBrands ? 'Show fewer brands' : `Show all ${brandChoices.length} brands`}
            </button>
          )}
        </fieldset>
      )}
      <fieldset>
        <legend>Variants</legend>
        <label><input type="checkbox" checked={hasVariants} onChange={(e) => setFilters({ variants: e.target.checked })} /> <span>Has flavors or variants</span></label>
      </fieldset>
    </div>
  );
  // Phones change the product line in the drawer too (AW-223): the pills are
  // at the top of a page up to 15,000px tall.
  const linePicker = lines.length > 0 && (
    <div className="filter-panel filter-lines">
      <fieldset>
        <legend>Product line</legend>
        <label><input type="radio" name="category-line" value="" checked={!activeSub} onChange={() => pickLine(null)} /> <span>{`All (${filtered.length})`}</span></label>
        {lines.map(({ sub: s, count }) => (
          <label key={s}><input type="radio" name="category-line" value={s} checked={activeSub === s} onChange={() => pickLine(s)} /> <span>{`${s} (${count})`}</span></label>
        ))}
      </fieldset>
    </div>
  );
  const closeFilters = () => setFiltersOpen(false);
  const deptLabel = catLabel(category);

  // On phones the product lines are one scrolling row, and the current one is
  // centred in it on arrival and after each pick (AW-157): the row's own
  // scrollLeft, not scrollIntoView, which can also scroll the page and undo
  // the position Back restores.
  const pillsRef = useRef(null);
  useLayoutEffect(() => {
    const row = pillsRef.current;
    const pill = row?.querySelector('[aria-current="page"]');
    if (!isMobile || !pill) return;
    row.scrollLeft = centredScrollLeft(pill, row);
  }, [activeSub, isMobile]);

  return (
    <section>
      <div className="page-head category-head">
        <Breadcrumbs items={catalogCrumbs({ category, sub: activeSub, query })} />
        {/* A line page names the line, its department and its own count (AW-226). */}
        <p className="eyebrow">{activeSub
          ? `${deptLabel} · ${plural(inScope.length, 'product')}`
          : <SkuCount lead="DEPARTMENT · " count={String(cat?.count ?? inCategory.length).padStart(2, '0')} />}</p>
        <h1>{activeSub || deptLabel}</h1>
        {/* An approved buyer is also told whose prices the cards show, from my_prices() (AW-107). */}
        <p>{`${activeSub
          ? `Wholesale ${deptLabel.toLowerCase()} for licensed retail accounts: ${plural(inScope.length, 'product')} in ${activeSub}.`
          : `Wholesale ${deptLabel.toLowerCase()} for licensed retail accounts: ${plural(inCategory.length, 'product')}${lines.length ? ` in ${plural(lines.length, 'product line')}` : ''}.`}${isApprovedBuyer ? ` ${tierPriceNote(priceTier)}` : ''}`}</p>
        <nav className="sub-pills" ref={pillsRef} aria-label={`${deptLabel} product lines`}>
          <Link className={`sub-pill${!activeSub ? ' active' : ''}${filtered.length ? '' : ' is-empty'}`} to={here({ sub: null })} scroll={false} aria-current={!activeSub ? 'page' : undefined}>{`All (${filtered.length})`}</Link>
          {lines.map(({ sub: s, count }) => (
            <Link key={s} className={`sub-pill${activeSub === s ? ' active' : ''}${count ? '' : ' is-empty'}`} to={here({ sub: s })} scroll={false} aria-current={activeSub === s ? 'page' : undefined}>{`${s} (${count})`}</Link>
          ))}
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
      </div>
      {chips.length > 0 && (
        <ul className="active-filters" aria-label="Active filters">
          {chips.map(c => (
            <li key={c.key}><button type="button" onClick={() => removeChip(c)} aria-label={`Remove filter ${c.label}`}><span>{c.label}</span><Icon name="close" /></button></li>
          ))}
          <li><button className="text-link" type="button" onClick={clearFilters}>Clear all</button></li>
        </ul>
      )}

      {isMobile && filtersOpen && (
        <ModalLayer onClose={closeFilters} className="aw-filter-layer">
          <div className="overlay" aria-hidden="true" onClick={closeFilters} />
          <div className="drawer filter-drawer" role="dialog" aria-modal="true" aria-labelledby="aw-filter-title" id="aw-filter-drawer">
            <div className="drawer-head">
              <h2 id="aw-filter-title">Filter &amp; Sort</h2>
              <button className="icon-btn" type="button" onClick={closeFilters} aria-label="Close filters"><Icon name="close" /></button>
            </div>
            <div className="drawer-body filter-drawer-body">
              {linePicker}
              {sortControl}
              {filterPanel}
            </div>
            <div className="drawer-foot">
              <div className="drawer-actions">
                {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>{`Clear all (${activeFilterCount})`}</button>}
                <button className="button" type="button" onClick={closeFilters}><span>{`Show ${items.length} item${items.length === 1 ? '' : 's'}`}</span></button>
              </div>
            </div>
          </div>
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
          {/* The cards' h3 names sit under an h2 in both layouts (AW-313):
              the compact layout has no Filters heading. */}
          <h2 className="sr-only">Products</h2>
          <PricingNotice profile={profile} account={account} isApprovedBuyer={isApprovedBuyer} onLoginClick={onLoginClick} onApplyClick={onApplyClick} />
          {items.length > 0 ? (
            <div className="card-grid category-card-grid">
              {/* The first row (three cards, two on phones) loads at once, and
                  the first photo, the likely largest paint, first (AW-323). */}
              {items.map((p, i) => (
                <ProductCard key={p.id} p={p} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart}
                             addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} eager={i < 3} priority={i === 0} />
              ))}
            </div>
          ) : (
            <EmptyState title="No products match" className="is-boxed" actions={noResultActions}>
              Try another search, clear the filters or browse another department.
            </EmptyState>
          )}
        </div>
      </div>
      <BackToTop />
    </section>
  );
}
