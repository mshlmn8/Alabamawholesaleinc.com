// Home, in the section order the plan fixed (AW-059, AW-060): the split hero
// (h1, pitch, calls to action and the photo carousel), the three services,
// the departments, one row each of new arrivals and bestsellers, the two
// collection cards and the account application steps. Only the application
// steps are numbered, the page's one real sequence (AW-216).

import { DEPARTMENT_PHOTOS, FREE_DELIVERY_THRESHOLD } from '../data/content.js';
import { topLines } from '../lib/departments.js';
import { formatMoneyShort } from '../lib/format.js';
import { tierPriceNote } from '../lib/pricing.js';
import { homeRails } from '../lib/merchandising.js';
import { heroImage, SIZES } from '../lib/images.js';
import { showsNicotineWarning } from '../lib/regulated.js';
import { Link } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { Picture } from '../components/Picture.jsx';
import { HomeHero } from '../components/HomeHero.jsx';
import { ProductCard } from '../components/ProductCard.jsx';

const EDITORIAL_BG = heroImage('hero_candy.jpg');

// A department tile's photo frame is a quarter of the container on wide
// screens and half the screen in the compact layout (.dept-grid in index.css).
const DEPT_SIZES = '(max-width: 53.125em) 46vw, (max-width: 84em) 23vw, 302px';

// New arrivals and Bestsellers show one row of cards: two by two on phones (AW-060).
export const RAIL_LENGTH = 4;

const dept = (category) => ({ page: 'category', category });
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// A tile's text in parts (inline blocks in index.css): on a narrow tile it
// wraps between "68 products ·" and "7 product lines", not inside them, and
// a part wraps at its own spaces only when it is wider than the tile.
const parts = (list) => list.map((part, i) => <span key={part}>{i < list.length - 1 ? `${part} · ` : part}</span>);

// Products without a photo stay off the home rails until a packshot exists
// (AW-029, Cursor PR #13); they are still in their department.
export const hasPhoto = (p) => Boolean(p?.picture?.src || p?.img);

// The product whose photo a department tile shows (AW-061): the chosen one in
// DEPARTMENT_PHOTOS or, when the live catalog lacks it or its photo, the first
// suitable product in the department's biggest line (the next line when that
// one has none). Never a nicotine product, since the tiles carry no FDA
// statement. null when there is none.
export function departmentPhoto(products, deptKey) {
  const suitable = (p) => p?.cat === deptKey && hasPhoto(p) && !showsNicotineWarning(p);
  const chosen = products.find(p => Number(p.id) === DEPARTMENT_PHOTOS[deptKey]);
  if (suitable(chosen)) return chosen;
  for (const line of topLines(products, deptKey, Infinity)) {
    const first = products.find(p => p.sub === line && suitable(p));
    if (first) return first;
  }
  return null;
}

export function HomePage({ products, departments, profile, isApprovedBuyer, priceOf, pricesStatus, priceTier = null, cart, addLine, decLine, onLoginClick, onApplyClick, signedIn = false }) {
  // The home rails leave the SKU off the card; category, search and product
  // pages keep it (AW-060).
  const card = (p) => (
    <ProductCard key={p.id} p={p} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart}
                 addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} showSku={false} />
  );
  // TODO(owner): Which products are really new and which are bestsellers, plus dedicated hero and department images? (AW-056)
  // Tags and homepage rank (AW-119), RAIL_LENGTH cards each (AW-061).
  const { newArrivals, bestsellers } = homeRails(products, { limit: RAIL_LENGTH, hasPhoto });
  // Whose prices the rails show, for an approved buyer (AW-107).
  const priceNote = isApprovedBuyer ? <p className="result-note">{tierPriceNote(priceTier)}</p> : null;

  return (
    <>
      <HomeHero signedIn={signedIn} onApplyClick={onApplyClick} />

      {/* What the business offers, straight after the hero (AW-059): an icon,
          the claim as published and a link to the page that explains it. */}
      <section className="services">
        <h2 className="sr-only">Services</h2>
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="truck" /></span>
          <h3>Next-day delivery, our own trucks</h3>
          {/* The threshold comes from content.js (AW-283). */}
          <p>{`We run our own delivery service on routes in Alabama, Mississippi and Georgia. Free delivery on orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} when the stop is on a delivery route. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
          <Link className="text-link" to="/delivery">Delivery and service area</Link>
        </div>
        {/* TODO(owner): Who gets Net-30, and what is the real volume discount? Kept as published (decision 2). (AW-025) */}
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="calendar" /></span>
          <h3>Net-30 trade terms</h3><p>Approved retail accounts order now and pay on Net-30 terms. Volume discounts up to 18% on pallet quantities across all eight departments.</p>
          <Link className="text-link" to="/terms">Trade terms</Link>
        </div>
        {/* TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This sentence is unchanged until you decide. (AW-129) */}
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="shield" /></span>
          <h3>Licensed businesses only</h3><p>We verify your state retail tobacco license and resale certificate before your first order. No consumer sales, no exceptions — 21+ trade accounts only.</p>
          <Link className="text-link" to="/apply">How to apply</Link>
        </div>
      </section>

      {/* The brand strip and trust band go here once the owner supplies them (AW-005). */}

      <section className="section" id="catalog">
        <div className="section-head">
          <div><p className="eyebrow">FULL ASSORTMENT</p><h2>Shop by department</h2></div>
          <Link to="/catalog">Browse the catalog</Link>
        </div>
        {/* One tile per department (AW-060, AW-061): a chosen photo, then the
            name, counts and biggest lines on a solid band, never on the photo. */}
        <div className="dept-grid">
          {departments.map(c => {
            const photo = departmentPhoto(products, c.key);
            return (
              <Link className="dept-tile" key={c.key} to={dept(c.key)}>
                <div className="dept-tile-media">
                  {photo && <Picture picture={photo.picture ?? { src: photo.img }} alt="" sizes={DEPT_SIZES} />}
                </div>
                <div className="dept-tile-body">
                  <h3>{c.label}</h3>
                  <p className="dept-tile-count">{parts([count(c.count, 'product', 'products'), count(c.subs.length, 'product line', 'product lines')])}</p>
                  <p className="dept-tile-lines">{parts(topLines(products, c.key))}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section" id="new-arrivals">
        <div className="section-head">
          <div><p className="eyebrow">FRESH INVENTORY</p><h2>New arrivals</h2>{priceNote}</div>
          <Link to={dept('NOVELTIES')}>Shop novelties</Link>
        </div>
        <div className="card-grid">
          {newArrivals.map(card)}
        </div>
      </section>

      <section className="section" id="bestsellers">
        <div className="section-head">
          <div><p className="eyebrow">PROVEN MOVERS</p><h2>Bestsellers</h2>{priceNote}</div>
          <Link to={dept('TOBACCO')}>Shop tobacco</Link>
        </div>
        <div className="card-grid">
          {bestsellers.map(card)}
        </div>
      </section>

      <section className="editorials" aria-label="Collections">
        {/* TODO(owner): Licensed photos for the novelties collection card and the tobacco collection card. (AW-058) */}
        <Link className="editorial-card cream" to={dept('NOVELTIES')}>
          <Picture className="bg" picture={EDITORIAL_BG.picture} alt="" aria-hidden="true" sizes={SIZES.editorial} />
          {/* TODO(owner): After legal review, which of Kratom & Kava, Mushroom Products, Detox, Wellness Pills, and Honey & Energy enhancement items should be delisted, de-featured, or kept, and may this card advertise detox and kratom? Headline kept as published. (AW-001) */}
          <div><p className="eyebrow">EXOTICS &amp; NOVELTIES</p><h2>Disposables, detox,<br />kratom &amp; more.</h2><span className="text-link">Browse novelties</span></div>
        </Link>
        <Link className="editorial-card purple" to={dept('TOBACCO')}>
          <div><p className="eyebrow">THE CORE BUSINESS</p><h2>Tobacco, wraps<br />&amp; accessories.</h2><span className="text-link">Browse tobacco</span></div>
        </Link>
      </section>

      <section className="section" id="apply">
        <div className="apply-panel">
          <div className="apply-intro">
            <p className="eyebrow">OPEN AN ACCOUNT</p>
            <h2>Become a retail account</h2>
            <button className="button" type="button" onClick={onApplyClick}>Start application</button>
          </div>
          <ol className="apply-steps">
            <li>
              <h3>Apply online</h3>
              <p>Tell us about your store — business name, EIN, state retail tobacco license number and resale certificate. Takes about five minutes.</p>
            </li>
            <li>
              <h3>We verify</h3>
              <p>Our team checks your license with the state and approves most accounts within one business day. Wholesale pricing and ordering unlock when you sign in.</p>
            </li>
            <li>
              <h3>Order &amp; receive</h3>
              <p>Order online or by phone for next-day delivery on our trucks when the stop is on a delivery route, or will-call pickup at the Birmingham warehouse during business hours.</p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
