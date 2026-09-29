// Home: hero carousel, new arrivals, collections, bestsellers, services,
// departments and the account application steps.

import { HERO_SLIDES } from '../data/content.js';
import { NEW_ARRIVALS_IDS } from '../data/products.js';
import { heroImage, SIZES } from '../lib/images.js';
import { Picture } from '../components/Picture.jsx';
import { HeroCarousel } from '../components/HeroCarousel.jsx';
import { ProductCard } from '../components/ProductCard.jsx';

const EDITORIAL_BG = heroImage('hero_candy.jpg');

export function HomePage({ products, departments, profile, isApprovedBuyer, cart, addLine, decLine, goProduct, goCategory, goCatalog, onLoginClick, onApplyClick }) {
  const card = (p) => (
    <ProductCard key={p.id} p={p} profile={profile} isApprovedBuyer={isApprovedBuyer} cart={cart}
                 addLine={addLine} decLine={decLine} goProduct={goProduct} onLoginClick={onLoginClick} />
  );
  const newArrivals = NEW_ARRIVALS_IDS.map(id => products.find(p => Number(p.id) === id)).filter(Boolean).slice(0, 8);
  const bestsellers = products.filter(p => p.tag === 'BESTSELLER').slice(0, 8);

  return (
    <>
      <HeroCarousel slides={HERO_SLIDES} />

      <section className="section" id="new-arrivals">
        <div className="section-head">
          <div><p className="eyebrow">FRESH INVENTORY / 01</p><h2>New arrivals</h2></div>
          <button type="button" onClick={() => goCategory('NOVELTIES')}>Shop novelties <span aria-hidden="true">↗</span></button>
        </div>
        <div className="card-grid">
          {newArrivals.map(card)}
        </div>
      </section>

      <section className="editorials" aria-label="Collections">
        <button className="editorial-card cream" type="button" onClick={() => goCategory('NOVELTIES')}>
          <Picture className="bg" picture={EDITORIAL_BG.picture} alt="" aria-hidden="true" sizes={SIZES.editorial} />
          <span className="block-label">COLLECTION / 01</span>
          <div><p className="eyebrow">EXOTICS &amp; NOVELTIES</p><h2>Disposables, detox,<br />kratom &amp; more.</h2><span className="text-link">Browse novelties</span><span className="arrow" aria-hidden="true">↗</span></div>
        </button>
        <button className="editorial-card purple" type="button" onClick={() => goCategory('TOBACCO')}>
          <span className="block-label">COLLECTION / 02</span>
          <div><p className="eyebrow">THE CORE BUSINESS</p><h2>Tobacco, wraps<br />&amp; accessories.</h2><span className="text-link">Browse tobacco</span><span className="arrow" aria-hidden="true">↗</span></div>
        </button>
      </section>

      <section className="section" id="bestsellers">
        <div className="section-head">
          <div><p className="eyebrow">PROVEN MOVERS / 02</p><h2>Bestsellers</h2></div>
          <button type="button" onClick={() => goCategory('TOBACCO')}>Shop tobacco <span aria-hidden="true">↗</span></button>
        </div>
        <div className="card-grid">
          {bestsellers.map(card)}
        </div>
      </section>

      <section className="services" aria-label="Services">
        <div className="service"><span>01</span><h3>Next-day delivery, our own trucks</h3><p>We run our own delivery service on routes in Alabama, Mississippi and Georgia. Free delivery on orders over $1,500 when the stop is on a delivery route. Will-call is pickup at the Birmingham warehouse during business hours.</p></div>
        <div className="service"><span>02</span><h3>Net-30 trade terms</h3><p>Approved retail accounts order now and pay on Net-30 terms. Volume discounts up to 18% on pallet quantities across all eight departments.</p></div>
        <div className="service"><span>03</span><h3>Licensed businesses only</h3><p>We verify your state retail tobacco license and resale certificate before your first order. No consumer sales, no exceptions — 21+ trade accounts only.</p></div>
      </section>

      <section className="section" id="catalog">
        <div className="section-head">
          <div><p className="eyebrow">FULL ASSORTMENT / 03</p><h2>Shop by department</h2></div>
          <button type="button" onClick={goCatalog}>Browse the catalog <span aria-hidden="true">↗</span></button>
        </div>
        <div className="card-grid">
          {departments.map(c => {
            const preview = products.find(p => p.cat === c.key && p.img);
            return (
              <button className="content-card" key={c.key} type="button" onClick={() => goCategory(c.key)}>
                <div className="card-block">
                  <span className="block-label">DEPARTMENT</span>
                  {preview?.picture ? <Picture picture={preview.picture} alt="" sizes={SIZES.card} /> : <span className="card-initials">{String(c.count).padStart(2, '0')}</span>}
                </div>
                <p className="card-kicker">{`${c.subs.length} PRODUCT LINES · ${c.count} SKUs`}</p>
                <h3>{c.label}</h3>
                <p className="card-detail">{c.subs.slice(0, 3).join(' · ')}</p>
                <span className="card-meta"><span>Browse department</span><span aria-hidden="true">↗</span></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" id="apply">
        <div className="apply-panel">
          <div className="apply-intro">
            <p className="eyebrow">OPEN AN ACCOUNT / 04</p>
            <h2>Become a retail account</h2>
            <button className="button" type="button" onClick={onApplyClick}>Start application <span aria-hidden="true">↗</span></button>
          </div>
          <ol className="apply-steps">
            <li>
              <h3>Apply online</h3>
              <p>Tell us about your store — business name, EIN, state retail tobacco license number and resale certificate. Takes about five minutes.</p>
            </li>
            <li>
              <h3>We verify</h3>
              <p>Our team checks your license with the state and approves most accounts within one business day. You&apos;ll get price-list access by email.</p>
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
