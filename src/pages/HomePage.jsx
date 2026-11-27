// Home, in the section order the plan fixed (AW-060): the split hero
// (h1, pitch, calls to action and the photo carousel), then the catalog.
// the departments, one row each of new arrivals, hot sellers, bestsellers and
// new deals, then, for a guest, the account application steps. Only the
// application steps are numbered, the page's one real sequence (AW-216).
// A signed-in account does not get that section; My account is in the header.
// The delivery, volume, and license services are not on this page.

import { DEPARTMENT_GROUPS } from '../data/content.js';
import { APPLY_LABEL } from '../data/terms.js';
import { topLines } from '../lib/departments.js';
import { brandLabel } from '../lib/format.js';
import { COLLECTIONS } from '../lib/collections.js';
import { RAIL_LIMIT, homeRails, homeSections } from '../lib/merchandising.js';
import { showsNicotineWarning } from '../lib/regulated.js';
import { Link } from '../lib/router.js';
import { Picture } from '../components/Picture.jsx';
import { HomeHero } from '../components/HomeHero.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { PART_SEPARATOR } from '../components/TextParts.jsx';

// A department tile's photo frame is a quarter of the container on wide
// screens and half the screen in the compact layout (.dept-grid in index.css).
const DEPT_SIZES = '(max-width: 53.125em) 22vw, (max-width: 84em) 12vw, 150px';

// New arrivals and Bestsellers show one row of cards: two by two on phones (AW-060).
export const RAIL_LENGTH = 4;

const productSlide = (p, kind, badge) => ({
  key: `${kind}-${p.id}`,
  img: p.img,
  picture: p.picture,
  alt: p.name,
  caption: p.name,
  kicker: [p.sub, brandLabel(p.brand)].filter(Boolean).join(' · '),
  badge,
  to: { page: 'product', productId: p.id },
  nicotineWarning: showsNicotineWarning(p),
});

// The hero carousel's slides: new products with a photo, the same order as
// the New arrivals rail, up to a full reel. Each slide opens that product.
export function newProductSlides(products, limit = RAIL_LIMIT) {
  const { newArrivals } = homeRails(products, { limit, hasPhoto });
  return newArrivals.map((p) => productSlide(p, 'new', 'New arrival'));
}

// The carousel advertises the current deals too: the products tagged DEAL,
// in the New deals rail's order, after the new arrivals.
export function heroSlides(products, limit = RAIL_LIMIT) {
  const { deals } = homeRails(products, { limit, hasPhoto });
  return [...newProductSlides(products, limit), ...deals.map((p) => productSlide(p, 'deal', 'Deal'))].slice(0, limit);
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

// The foot of the page for a guest: open an account, with the three steps.
// A signed-in account does not get this section.
function AccountSection({ signedIn, onApplyClick }) {
  // Signed in, the home page does not repeat the account. My account is in
  // the header. Guests still get the steps to open one.
  if (signedIn) return null;
  return (
    <section className="section" id="apply">
      <div className="apply-panel">
        <div className="apply-intro">
          <h2>Open an account</h2>
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

// account is useAuth's ('loading' | 'signed-out' | 'no-profile' | 'ready'),
// through App's cardProps: the cards tell a guest from a signed-in buyer
// whose profile is still loading (NEW-002, NEW-050). The guest apply steps
// are the only account block on this page.
export function HomePage({
  products, departments, profile, account = profile ? 'ready' : 'signed-out', isApprovedBuyer, priceOf, pricesStatus,
  cart, addLine, decLine, onLoginClick, onApplyClick, signedIn = false,
}) {
  const card = (p) => (
    <ProductCard key={p.id} p={p} profile={profile} account={account} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart}
                 addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />
  );
  // TODO(owner): Which products are really new and which are bestsellers, plus dedicated hero and department images? (AW-056)
  // Tags and homepage rank (AW-119), RAIL_LENGTH cards each (AW-061).
  // Show all opens that group's own page, not the whole catalog.
  const sections = homeSections(products, { limit: RAIL_LENGTH, hasPhoto });
  // Whose prices the rails show, for an approved buyer (AW-107).

  return (
    <>
      <HomeHero slides={heroSlides(products)} />

      <section className="section" id="catalog">
        <div className="section-head">
          <div><h2>Shop by department</h2></div>
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
            <div><h2>{c.title}</h2></div>
            <Link to={{ page: c.page }}>Show all<span className="sr-only">{` ${c.title.toLowerCase()}`}</span></Link>
          </div>
          <div className="card-grid card-rail">
            {sections[c.page].map(card)}
          </div>
        </section>
      ))}

      <AccountSection signedIn={signedIn} onApplyClick={onApplyClick} />
    </>
  );
}
