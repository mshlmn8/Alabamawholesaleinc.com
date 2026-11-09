// Home, in the section order the plan fixed (AW-059, AW-060): the split hero
// (h1, pitch, calls to action and the photo carousel), the trust band under
// it (AW-005), then the catalog. The three services sit last, just above
// the footer.
// the departments, one row each of new arrivals, hot sellers, bestsellers and
// new deals, then the account application steps. Only the application
// steps are numbered, the page's one real sequence (AW-216). A signed-in
// account sees its own account's panel in place of the steps (AW-066).

import { DEPARTMENT_GROUPS, FREE_DELIVERY_THRESHOLD, SOURCING, TRUST } from '../data/content.js';
import { APPLY_LABEL } from '../data/terms.js';
import { accountView, tradeAccountPanel } from '../lib/accountStatus.js';
import { topLines } from '../lib/departments.js';
import { brandLabel, formatMoneyShort } from '../lib/format.js';
import { COLLECTIONS } from '../lib/collections.js';
import { tierPriceNote } from '../lib/pricing.js';
import { RAIL_LIMIT, homeRails, homeSections } from '../lib/merchandising.js';
import { showsNicotineWarning } from '../lib/regulated.js';
import { Link } from '../lib/router.js';
import { Icon } from '../components/Icon.jsx';
import { VolumePricing } from '../components/ContactLinks.jsx';
import { Picture } from '../components/Picture.jsx';
import { HomeHero } from '../components/HomeHero.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { PART_SEPARATOR } from '../components/TextParts.jsx';

// A department tile's photo frame is a quarter of the container on wide
// screens and half the screen in the compact layout (.dept-grid in index.css).
const DEPT_SIZES = '(max-width: 53.125em) 22vw, (max-width: 84em) 12vw, 150px';

// New arrivals and Bestsellers show one row of cards: two by two on phones (AW-060).
export const RAIL_LENGTH = 4;

// The hero carousel's slides: new products with a photo, the same order as
// the New arrivals rail, up to a full reel. Each slide opens that product.
export function newProductSlides(products, limit = RAIL_LIMIT) {
  const { newArrivals } = homeRails(products, { limit, hasPhoto });
  return newArrivals.map((p) => ({
    key: `new-${p.id}`,
    img: p.img,
    picture: p.picture,
    alt: p.name,
    caption: p.name,
    kicker: [p.sub, brandLabel(p.brand)].filter(Boolean).join(' · '),
    badge: 'New arrival',
    to: { page: 'product', productId: p.id },
    nicotineWarning: showsNicotineWarning(p),
  }));
}

const dept = (category) => ({ page: 'category', category });
// A tile's line names in parts (inline blocks in index.css): on a narrow
// tile each name moves to the next line whole, and a name wraps at its own
// spaces only when it is wider than the tile. The dot is held to the name's
// last word by a no-break space, so it never starts a line on its own
// (NEW-082, as TextParts).
const parts = (list) => list.map((part, i) => <span key={part}>{i < list.length - 1 ? `${part}${PART_SEPARATOR}` : part}</span>);

// Products without a photo stay off the home rails until a packshot exists
// (AW-029, Cursor PR #13); they are still in their department.
export const hasPhoto = (p) => Boolean(p?.picture?.src || p?.img);

// Up to four packshots for a department tile (AW-061): the group named in
// DEPARTMENT_GROUPS, in that order, skipping any the live catalog lacks or
// that has no photo. The rest of the four, if the group comes up short, are
// other photos from the department, a new product line before another from
// a line already shown.
const DEPARTMENT_GROUP_SIZE = 4;
export function departmentPhotos(products, deptKey) {
  const rows = (products || []).filter((p) => p && p.cat === deptKey && hasPhoto(p));
  const byId = new Map(rows.map((p) => [Number(p.id), p]));
  const chosen = [];
  const seen = new Set();
  const take = (p) => {
    if (!p || seen.has(p.id) || chosen.length >= DEPARTMENT_GROUP_SIZE) return;
    chosen.push(p);
    seen.add(p.id);
  };
  for (const id of DEPARTMENT_GROUPS[deptKey] || []) take(byId.get(Number(id)));
  const rest = rows.filter((p) => !seen.has(p.id));
  const shown = new Set(chosen.map((p) => p.sub));
  for (const p of [...rest.filter((p) => !shown.has(p.sub)), ...rest.filter((p) => shown.has(p.sub))]) take(p);
  return chosen;
}

// The foot of the page. A guest is asked to open a trade account, with the
// three steps. A signed-in account is never offered a second application
// (AW-066): its panel says where the account stands, as /apply's page head
// does (accountStatus.js tradeAccountPanel), and links to My account or the
// application status. Keyed by view, so each view's words are a new block
// (Google Translate).
function AccountSection({ signedIn, view, onApplyClick }) {
  const panel = signedIn ? tradeAccountPanel(view) : null;
  if (panel) {
    return (
      <section className="section" id="apply">
        <div key={view} className="apply-panel trade-account-panel">
          <div className="apply-intro">
            <p className="eyebrow">{panel.eyebrow}</p>
            <h2>{panel.title}</h2>
          </div>
          <div className="trade-account-body">
            <p>{panel.text}</p>
            <Link className="button" to={panel.link.to}>{panel.link.label}</Link>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="section" id="apply">
      <div className="apply-panel">
        <div className="apply-intro">
          <p className="eyebrow">OPEN AN ACCOUNT</p>
          <h2>Open a trade account</h2>
          <button className="button" type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
        </div>
        <ol className="apply-steps">
          <li>
            <h3>Apply online</h3>
            <p>Tell us about your store — business name, EIN, state retail tobacco license number and resale certificate. Takes a few minutes.</p>
          </li>
          <li>
            <h3>We verify</h3>
            {/* No approval time is promised (AW-246, owner answer 2026-10).
                TODO(owner): Does the team check each license with the state? Kept as published. (AW-281) */}
            <p>Our team checks your license with the state before approving your account. Wholesale pricing and ordering unlock when you sign in.</p>
          </li>
          <li>
            <h3>Order &amp; receive</h3>
            <p>Order online or by phone for next-day delivery on our trucks when the stop is on a delivery route, or will-call pickup at the Birmingham warehouse during business hours.</p>
          </li>
        </ol>
      </div>
    </section>
  );
}

// The facts the owner confirmed (AW-005, 2026-10), in a band under the hero:
// 20 years in business, 100% authentic products, and where every product
// comes from. Nothing else: no count of accounts, no "three generations",
// and never "direct from the manufacturer" alone.
export function TrustBand() {
  return (
    <section className="trust-band" aria-labelledby="trust-band-title">
      <h2 id="trust-band-title" className="sr-only">About Alabama Wholesale</h2>
      <ul className="trust-facts">
        {TRUST.map((fact) => (
          <li key={fact.label} className="trust-fact"><span className="trust-figure">{fact.figure}</span> <span className="trust-label">{fact.label}</span></li>
        ))}
      </ul>
      <p className="trust-sourcing">{SOURCING}</p>
    </section>
  );
}

// account is useAuth's ('loading' | 'signed-out' | 'no-profile' | 'ready'),
// through App's cardProps: the cards and the account panel tell a guest from
// a signed-in buyer whose profile is still loading (NEW-002, NEW-050).
export function HomePage({
  products, departments, profile, account = profile ? 'ready' : 'signed-out', isApprovedBuyer, priceOf, pricesStatus, priceTier = null,
  cart, addLine, decLine, onLoginClick, onApplyClick, signedIn = false,
}) {
  // The home rails leave the SKU off the card; category, search and product
  // pages keep it (AW-060).
  const card = (p) => (
    <ProductCard key={p.id} p={p} profile={profile} account={account} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart}
                 addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} showSku={false} />
  );
  // TODO(owner): Which products are really new and which are bestsellers, plus dedicated hero and department images? (AW-056)
  // Tags and homepage rank (AW-119), RAIL_LENGTH cards each (AW-061).
  // Show all opens that group's own page, not the whole catalog.
  const sections = homeSections(products, { limit: RAIL_LENGTH, hasPhoto });
  // Whose prices the rails show, for an approved buyer (AW-107).

  return (
    <>
      <HomeHero slides={newProductSlides(products)} />
      <TrustBand />

      <section className="section" id="catalog">
        <div className="section-head">
          <div><p className="eyebrow">FULL ASSORTMENT</p><h2>Shop by department</h2></div>
          <Link to="/catalog">Browse all</Link>
        </div>
        {/* One tile per department (AW-060, AW-061): a group of packshots,
            then the name and biggest lines on a solid band, never on the
            photos. The name is the link, stretched over the tile (AW-170). */}
        <div className="dept-grid">
          {departments.map(c => {
            const photos = departmentPhotos(products, c.key);
            return (
              <div className="dept-tile" key={c.key}>
                <div className={`dept-tile-media${photos.length ? ` is-${photos.length}` : ''}`}>
                  {photos.map((photo) => (
                    <span className="dept-shot" key={photo.id}>
                      <Picture picture={photo.picture ?? { src: photo.img }} alt="" sizes={DEPT_SIZES} />
                    </span>
                  ))}
                </div>
                <div className="dept-tile-body">
                  <h3><Link className="dept-tile-link" to={dept(c.key)}>{c.label}</Link></h3>
                  <p className="dept-tile-lines">{parts(topLines(products, c.key))}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {COLLECTIONS.map((c) => (
        <section className="section" id={c.page} key={c.page}>
          <div className="section-head">
            <div><p className="eyebrow">{c.eyebrow}</p><h2>{c.title}</h2>{isApprovedBuyer ? <p className="result-note">{tierPriceNote(priceTier)}</p> : null}</div>
            <Link to={{ page: c.page }}>Show all<span className="sr-only">{` ${c.title.toLowerCase()}`}</span></Link>
          </div>
          <div className="card-grid card-rail">
            {sections[c.page].map(card)}
          </div>
        </section>
      ))}

      <AccountSection signedIn={signedIn} view={accountView(profile, account)} onApplyClick={onApplyClick} />

      {/* What the business offers (AW-059), last on the page, just above the
          footer: an icon, the claim and a link to the page that explains it,
          or, for volume pricing, the trade desk's email and phone. */}
      <section className="services">
        <h2 className="sr-only">Services</h2>
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="truck" /></span>
          <h3>Next-day delivery, our own trucks</h3>
          {/* The threshold comes from content.js (AW-283). */}
          <p>{`We run our own delivery service on routes in Alabama, Mississippi and Georgia. Free delivery on orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} when the stop is on a delivery route. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
          <Link className="text-link" to="/delivery">Delivery and service area</Link>
        </div>
        {/* No Net-30 terms and no published volume discounts: volume
            pricing goes through the trade desk (AW-025, owner answer 2026-10),
            so the line's own email and phone links are this service's links. */}
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="tag" /></span>
          <h3>Buying in volume?</h3><p><VolumePricing /></p>
        </div>
        {/* TODO(owner): Is a tobacco license required for every trade account, or only for tobacco, vapor, and nicotine? This sentence is unchanged until you decide. (AW-129) */}
        <div className="service">
          <span className="service-icon" aria-hidden="true"><Icon name="shield" /></span>
          <h3>Licensed businesses only</h3><p>We verify your state retail tobacco license and resale certificate before your first order. No consumer sales, no exceptions — 21+ trade accounts only.</p>
          <Link className="text-link" to="/apply">How to apply</Link>
        </div>
      </section>
    </>
  );
}
