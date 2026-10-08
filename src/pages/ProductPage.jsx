// Product detail: photo, description, variant picker, price or pricing lock,
// quantity and add, then more products from the same line. App keys this
// page by product id, so another product starts with a fresh picker.
//
// savedQty is this product's quantity on the list of lines from an older
// cart that still need a variant (AW-354): it fills in the quantity, and
// adding a variant uses it up.
//
// The price is the signed-in buyer's, from priceOf(productId, variant) (App,
// src/lib/prices.jsx); products carry none (AW-003). It follows the chosen
// variant; before one is chosen, variants priced differently show "From $x"
// (AW-030).
//
// Variants (AW-233, AW-128): a product with several gets chips labelled with
// its axis ("Choose a flavor"), and a variant marked not available is a
// disabled chip that says so (AW-030). A product with one variant has no
// chips; its variant shows as text when the name doesn't already say it.
//
// From Cursor's PR #13: "Photo coming soon" without a photo (AW-029), the
// sell unit badged on a photo other rows share (AW-136), the Wikimedia credit
// under the photo (AW-033), and no placeholder brand "Assorted" (AW-286).

import { useState } from 'react';
import {
  informativeVariant, isVariantAvailable, lineKey, requiresVariantChoice, variantAxis, variantList, variantSku,
} from '../lib/lines.js';
import { priceLabel, variantPriceRange } from '../lib/pricing.js';
import { brandLabel, catLabel } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { Picture } from '../components/Picture.jsx';
import { MissingPhoto } from '../components/MissingPhoto.jsx';
import { photoCredit, photoCreditSource } from '../data/photoCredits.js';
import { ProductCard } from '../components/ProductCard.jsx';
import { NicotineWarning } from '../components/NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';

const NO_PRICES = () => null;

export function ProductPage({
  productId, profile, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', cart, addLine, decLine, products, onLoginClick, onApplyClick, savedQty = 0,
}) {
  const [desiredQty, setDesiredQty] = useState(() => savedQty || 1);
  // What is left of the saved quantity after each add becomes the next one.
  const [prefilledFrom, setPrefilledFrom] = useState(savedQty);
  if (prefilledFrom !== savedQty) {
    setPrefilledFrom(savedQty);
    if (savedQty > 0) setDesiredQty(savedQty);
  }
  const [chosenVariant, setChosenVariant] = useState(null);
  const [variantError, setVariantError] = useState(false);
  const p = products.find(x => Number(x.id) === Number(productId));
  // App renders NotFound for ids that are not in the catalog.
  if (!p) return null;
  const department = { page: 'category', category: p.cat };
  const variants = variantList(p);
  const axis = variantAxis(p);
  const available = (v) => isVariantAvailable(p, v);
  const choiceRequired = requiresVariantChoice(p);
  // A choice the catalog has since marked not available no longer counts.
  const chosen = chosenVariant && available(chosenVariant) ? chosenVariant : null;
  const selected = choiceRequired ? chosen : (variants.length === 1 ? variants[0] : null);
  const soleUnavailable = variants.length === 1 && !available(variants[0]);
  const soleShown = soleUnavailable ? variants[0] : informativeVariant(p);
  const key = lineKey(p.id, selected);
  const qty = cart[key] || 0;
  const related = products.filter(x => x.sub === p.sub && Number(x.id) !== Number(p.id)).slice(0, 4);
  const brand = brandLabel(p.brand);
  const credit = p.picture ? photoCredit(p) : '';
  const creditSource = photoCreditSource(p);
  let shown = { unit: null, from: false };
  if (isApprovedBuyer) {
    shown = choiceRequired && !selected
      ? variantPriceRange(variants.filter(available).map(v => priceOf(p.id, v)))
      : { unit: priceOf(p.id, selected), from: false };
  }
  const handleAdd = () => {
    if (choiceRequired && !chosen) {
      setVariantError(true);
      return;
    }
    if (soleUnavailable) return;
    addLine(p.id, selected, desiredQty);
    setDesiredQty(1);
  };

  return (
    <section>
      <div className="page-head" style={{ paddingBottom: 0 }}>
        <Breadcrumbs items={[HOME_CRUMB, { label: catLabel(p.cat), to: department }, { label: p.name }]} />
      </div>
      <div className="pd-grid">
        <figure className="pd-figure">
          <div className="pd-media">
            {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
            {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.detail} priority /> : <MissingPhoto name={p.name} />}
            {p.picture && p.sharedPhoto && p.sellUnit && <span className="pack-badge">{p.sellUnit}</span>}
          </div>
          {credit && (
            <figcaption className="photo-credit">
              <span>{credit}</span>
              {creditSource && <> <a href={creditSource} target="_blank" rel="noopener noreferrer">Wikimedia Commons<span className="sr-only"> (opens in a new tab)</span></a></>}
            </figcaption>
          )}
        </figure>
        <div className="pd-info">
          {showsNicotineWarning(p) && <NicotineWarning />}
          <p className="pd-brand">{brand ? `${brand} · ${p.sub}` : p.sub}</p>
          <h1>{p.name}</h1>
          <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()}${brand ? ` from ${brand}` : ''}.`}</p>
          {p.sellUnit && <p className="pd-unit">{`Sold by the ${p.sellUnit} — quantity 1 is one ${p.sellUnit}.`}</p>}
          <p className="pd-desc pd-fine">{`SKU ${p.sku}. Supplied to licensed retail businesses for lawful resale. Next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
          {choiceRequired && (
            <div className="variant-chips" role="group" aria-label={`Choose a ${axis.noun}`}>
              {variants.map(v => (
                <button key={v} type="button" aria-pressed={selected === v} disabled={!available(v)} onClick={() => { setChosenVariant(v); setVariantError(false); }}>{available(v) ? v : `${v} (not available)`}</button>
              ))}
            </div>
          )}
          {soleShown && <p className="pd-desc">{`${axis.label}: ${soleShown}${soleUnavailable ? ' (not available)' : ''}`}</p>}
          {choiceRequired && axis.label === 'Flavor' && <p className="in-cart-note">Flavors and availability change often. The trade desk confirms what is in stock.</p>}
          {choiceRequired && <p className="in-cart-note">{`Pick a ${axis.noun} to add it. Add each ${axis.noun} you want separately.`}</p>}
          {savedQty > 0 && <p className="pd-saved">{`From your last visit: quantity ${savedQty}.${choiceRequired ? ` Choose a ${axis.noun}, then add it.` : ''}`}</p>}
          {variantError && <p className="form-error" role="alert">{`Select a ${axis.noun} before adding this product.`}</p>}
          <div className="pd-price">
            {isApprovedBuyer
              ? <><b>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</b><span>{`Wholesale unit price · ${variantSku(p.sku, selected)}`}</span></>
              : profile
              ? <><b>Pending</b><span>Pricing unlocks after your account is approved</span></>
              : <><b>Sign in</b><span>Wholesale pricing is visible to approved trade accounts</span></>}
          </div>
          <div className="qty-row">
            <div className="qty-stepper" role="group" aria-label="Quantity to add">
              <button type="button" onClick={() => setDesiredQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <b aria-live="polite">{desiredQty}</b>
              <button type="button" onClick={() => setDesiredQty(q => q + 1)} aria-label="Increase quantity">+</button>
            </div>
            <button className="button" type="button" onClick={handleAdd} disabled={(choiceRequired && !chosen) || soleUnavailable}><span>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</span> <span aria-hidden="true">↗</span></button>
          </div>
          {qty > 0 && <p className="in-cart-note"><span>{`Already in ${isApprovedBuyer ? 'order' : 'quote'}: `}</span><strong>{qty}</strong><span>{selected ? ` · ${selected}` : ''}</span></p>}
          {!profile && (
            <div className="dialog-actions compact-actions">
              <button className="text-link" type="button" onClick={onLoginClick}>Sign in for pricing</button>
              <button className="text-link" type="button" onClick={onApplyClick}>Apply for account</button>
            </div>
          )}
          {profile && !isApprovedBuyer && (
            <div className="dialog-actions compact-actions">
              <Link className="text-link" to="/account">View approval status</Link>
            </div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><p className="eyebrow">SAME LINE</p><h2>{`More ${p.sub.toLowerCase()}`}</h2></div>
            <Link to={department}>View department <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart} addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
    </section>
  );
}
