// All products (/catalog), the "Browse the catalog" destination (AW-068): a
// search box over the whole catalog, then every department with a row of its
// featured products as cards, its product lines, a link to the department
// and, as a secondary view, the expandable list of every SKU in it.
//
// The jump links are '#dept-…' anchors: the router scrolls to the section and
// focuses its h2 (useNavigationEffects), and Back returns to where the jump
// was made (AW-229). The line pills are a labelled group.
//
// The pricing prompt at the top is the department pages' PricingNotice
// (NEW-050): a guest gets Sign in and Apply (AW-274), an account waiting for
// approval or on hold its own sentence, an approved buyer nothing. It
// follows useAuth's account (App's cardProps), so a buyer whose profile is
// still loading is never offered Sign in.

import { useState } from 'react';
import { Link, navigate } from '../../lib/router.js';
import { variantAxis, variantCount } from '../../lib/lines.js';
import { brandLabel } from '../../lib/format.js';
import { featuredOrder, underLegalReview } from '../../lib/merchandising.js';
import { Icon } from '../../components/Icon.jsx';
import { BackToTop } from '../../components/BackToTop.jsx';
import { PricingNotice } from '../../components/PricingNotice.jsx';
import { ProductCard } from '../../components/ProductCard.jsx';
import { SkuCount } from '../../components/SkuCount.jsx';
import { PageHead } from './SupportShell.jsx';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Cards in each department's row: one row of the four-column grid.
export const CATALOG_PREVIEW = 4;

// The same rule as HomePage's hasPhoto.
const hasPhoto = (p) => Boolean(p?.picture?.src || p?.img);

// A department's row of cards: its products in the department pages'
// Featured order (AW-227), only those with a photo, and never a product in a
// line under legal review. That is the status quo: this page showed no
// products before, and the homepage rails keep these lines off the same way.
// TODO(owner): After the legal review, may the Kratom & Kava, Mushroom Products, Detox, Wellness Pills and Honey & Energy enhancement items be featured on the homepage rails, in the department rows of All products, and lead the department pages' Featured sort? (AW-119, AW-001)
export function catalogPreview(rows, limit = CATALOG_PREVIEW) {
  return featuredOrder(rows, { hasPhoto }).filter((p) => hasPhoto(p) && !underLegalReview(p)).slice(0, limit);
}

const seeAll = (d) => (d.count === 1 ? `See the ${d.label} product` : `See all ${d.count} ${d.label} products`);

// cardProps are App's: the cards' and the notice's account, prices and actions.
export function CatalogIndexPage({ products, departments, ...cardProps }) {
  const { profile, account, isApprovedBuyer, onLoginClick, onApplyClick } = cardProps;
  const lines = departments.reduce((n, d) => n + d.subs.length, 0);
  const [draft, setDraft] = useState('');

  // The whole catalog, as the search page shows it (AW-007).
  const search = (e) => {
    e.preventDefault();
    navigate({ page: 'search', q: draft.trim() });
  };

  return (
    <section className="support-page catalog-index">
      <PageHead crumb="All products" eyebrow="FULL ASSORTMENT" title="All products">
        <p>{`${departments.length} departments, ${lines} product lines and ${products.length} products.`}</p>
        <form className="search-form" role="search" aria-label="All products" onSubmit={search}>
          <label className="filter-search" htmlFor="catalog-search-input"><span>Search all products</span>
            <input id="catalog-search-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" />
          </label>
          <button className="button" type="submit">Search</button>
        </form>
      </PageHead>
      <PricingNotice profile={profile} account={account} isApprovedBuyer={isApprovedBuyer} onLoginClick={onLoginClick} onApplyClick={onApplyClick} />

      <nav className="dept-jump" aria-label="Jump to department">
        {departments.map((d, i) => (
          <Link key={d.key} to={`#dept-${slug(d.key)}`}><span>{String(i + 1).padStart(2, '0')}</span><span>{d.label}</span></Link>
        ))}
      </nav>

      <div className="dept-index">
        {departments.map((d, i) => {
          const rows = products.filter(p => p.cat === d.key).sort((a, b) => a.name.localeCompare(b.name));
          const cards = catalogPreview(rows);
          return (
            <section key={d.key} className="dept-section" id={`dept-${slug(d.key)}`} aria-labelledby={`dept-title-${slug(d.key)}`}>
              <div className="dept-head">
                <div>
                  <p className="eyebrow"><SkuCount lead={`DEPARTMENT ${String(i + 1).padStart(2, '0')} · `} count={d.count} /></p>
                  <h2 id={`dept-title-${slug(d.key)}`}>{d.label}</h2>
                </div>
                <Link className="text-link" to={{ page: 'category', category: d.key }}><span>{`Browse ${d.label}`}</span></Link>
              </div>
              <div className="sub-pills" role="group" aria-label={`${d.label} product lines`}>
                {d.subs.map(s => {
                  const count = rows.filter(p => p.sub === s).length;
                  return <Link key={s} className="sub-pill" to={{ page: 'category', category: d.key, sub: s }}>{`${s} (${count})`}</Link>;
                })}
              </div>
              {cards.length > 0 && (
                <div className="card-grid">
                  {/* The first department's cards load at once, and its
                      first photo, the likely largest paint, first (AW-323). */}
                  {cards.map((p, j) => <ProductCard key={p.id} p={p} {...cardProps} eager={i === 0} priority={i === 0 && j === 0} />)}
                </div>
              )}
              <div className="dept-more">
                <Link className="text-link" to={{ page: 'category', category: d.key }}>{seeAll(d)}</Link>
              </div>
              <details className="sku-details">
                <summary><Icon name="plus" className="sku-plus" /><Icon name="minus" className="sku-minus" /><span>{`All ${d.count} ${d.label} SKUs`}</span></summary>
                <ul className="sku-list">
                  {rows.map(p => (
                    <li key={p.id}>
                      <Link to={{ page: 'product', productId: p.id }}>
                        <b>{p.name}</b>
                        <small>{`${brandLabel(p.brand) ? `${brandLabel(p.brand)} · ` : ''}${p.sub} · ${p.sku}${variantCount(p) > 1 ? ` · ${variantCount(p)} ${variantAxis(p).plural}` : ''}`}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
      </div>
      <BackToTop />
    </section>
  );
}
