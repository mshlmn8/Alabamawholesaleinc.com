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
// The chips are one required choice (AW-235): a radiogroup named by the
// visible "Choose a flavor" above it, one radio per chip with a roving
// tabindex, and the arrow keys, Home and End move to the next variant that
// can be chosen and choose it. The add button stays enabled (AW-074): adding
// before a choice shows "Select a flavor…" under the chips and puts focus on
// the first variant that can be chosen.
//
// The SKU follows the chosen variant for every visitor (AW-234), and the info
// column keeps one measure (AW-237, index.css).
//
// The trail names the product line (AW-230): Home / All products / department
// / line / product. The row underneath (AW-231, src/lib/related.js) is the
// same brand first, then the line, filled from the department when the line
// is small; it is headed by the line when every pick is in it, else by the
// department, and its "View all" link goes to the one it names.
//
// The quantity to add is typed or stepped (QuantityInput, AW-013), and
// a bare cart line of this product (AW-011) doesn't count as "Already in"
// any variant.
//
// An add is confirmed by the toast (AW-072, AW-042): the quantity, the
// product and its variant, and "View quote", also read out once
// (src/lib/toast.js). Focus stays on the add button.
//
// The photo opens larger (AW-236): the whole frame is a button that opens
// the photo in a dialog at the largest rendition the build makes (800 to
// 1024px wide, never enlarged past it), with its credit. Escape, Back and the
// backdrop close it, and focus goes back to the photo. Without a photo, or
// when it failed to load, there is no button (index.css hides it next to
// "Photo coming soon").
//
// From Cursor's PR #13: "Photo coming soon" without a photo (AW-029), the
// sell unit badged on a photo other rows share (AW-136), the Wikimedia credit
// under the photo (AW-033), and no placeholder brand "Assorted" (AW-286).

import { useRef, useState } from 'react';
import {
  informativeVariant, isVariantAvailable, lineKey, requiresVariantChoice, variantAxis, variantList, variantSku,
} from '../lib/lines.js';
import { priceLabel, variantPriceRange } from '../lib/pricing.js';
import { brandLabel, catLabel } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Breadcrumbs, catalogCrumbs } from '../components/Breadcrumbs.jsx';
import { ProductPhoto } from '../components/ProductPhoto.jsx';
import { Picture } from '../components/Picture.jsx';
import { ModalLayer } from '../components/ModalLayer.jsx';
import { photoCredit, photoCreditSource } from '../data/photoCredits.js';
import { ProductCard } from '../components/ProductCard.jsx';
import { NicotineWarning } from '../components/NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';
import { Icon } from '../components/Icon.jsx';
import { QuantityInput } from '../components/QuantityInput.jsx';
import { showToast } from '../lib/toast.js';
import { maxPerLineText } from '../lib/quantity.js';
import { relatedProducts } from '../lib/related.js';

const NO_PRICES = () => null;

// The photo credit, under the photo and in the enlarged view.
function PhotoCreditText({ credit, creditSource }) {
  return (
    <>
      <span>{credit}</span>
      {creditSource && <> <a href={creditSource} target="_blank" rel="noopener noreferrer">Wikimedia Commons<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a></>}
    </>
  );
}

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
  const chipsRef = useRef(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const p = products.find(x => Number(x.id) === Number(productId));
  // App renders NotFound for ids that are not in the catalog.
  if (!p) return null;
  const variants = variantList(p);
  const axis = variantAxis(p);
  const available = (v) => isVariantAvailable(p, v);
  const choiceRequired = requiresVariantChoice(p);
  // A choice the catalog has since marked not available no longer counts.
  const chosen = chosenVariant && available(chosenVariant) ? chosenVariant : null;
  const selected = choiceRequired ? chosen : (variants.length === 1 ? variants[0] : null);
  const soleUnavailable = variants.length === 1 && !available(variants[0]);
  const choosable = variants.filter(available);
  // The chip Tab lands on: the chosen one, else the first that can be chosen.
  const tabStop = selected || choosable[0] || null;
  const soleShown = soleUnavailable ? variants[0] : informativeVariant(p);
  const key = lineKey(p.id, selected);
  // Before a variant is chosen, the key is the bare product id: a bare cart
  // line (a reorder that needs its variant, AW-011) is not "already in" it.
  const qty = choiceRequired && !selected ? 0 : (cart[key] || 0);
  const related = relatedProducts(products, p);
  const sameLine = related.every(x => x.sub === p.sub);
  const brand = brandLabel(p.brand);
  const credit = p.picture ? photoCredit(p) : '';
  const creditSource = photoCreditSource(p);
  let shown = { unit: null, from: false };
  if (isApprovedBuyer) {
    shown = choiceRequired && !selected
      ? variantPriceRange(variants.filter(available).map(v => priceOf(p.id, v)))
      : { unit: priceOf(p.id, selected), from: false };
  }
  const chipFor = (v) => chipsRef.current?.querySelectorAll('[role="radio"]')[variants.indexOf(v)] || null;
  const choose = (v) => {
    setChosenVariant(v);
    setVariantError(false);
  };
  // Arrows move to the next (or previous) variant that can be chosen, round
  // the ends; Home and End to the first and last. Each move chooses it, as in
  // a group of radio buttons. Space and Enter are the chip's own click.
  const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const onChipKeyDown = (e) => {
    if (!(e.key in STEPS) && e.key !== 'Home' && e.key !== 'End') return;
    if (choosable.length === 0) return;
    e.preventDefault();
    const radios = [...e.currentTarget.querySelectorAll('[role="radio"]')];
    const from = Math.max(0, choosable.indexOf(variants[radios.indexOf(e.target)]));
    let to = from + (STEPS[e.key] || 0);
    if (e.key === 'Home') to = 0;
    if (e.key === 'End') to = choosable.length - 1;
    const next = choosable[(to + choosable.length) % choosable.length];
    choose(next);
    chipFor(next)?.focus();
  };
  const closeZoom = () => setZoomOpen(false);
  const handleAdd = () => {
    if (choiceRequired && !chosen) {
      setVariantError(true);
      chipFor(choosable[0])?.focus();
      return;
    }
    if (soleUnavailable) return;
    const added = addLine(p.id, selected, desiredQty);
    if (!added) return;
    const target = isApprovedBuyer ? 'order' : 'quote';
    const what = `${p.name}${selected ? ` — ${selected}` : ''}`;
    // A line already near the limit takes only what fits (AW-013).
    const count = added.capped ? Math.max(0, added.qty - qty) : desiredQty;
    const text = count > 0
      ? `Added ${count.toLocaleString('en-US')} × ${what} to your ${target}.`
      : `Your ${target} already has ${added.qty.toLocaleString('en-US')} × ${what}.`;
    showToast({ text: added.capped ? `${text} ${maxPerLineText()}` : text, action: { id: 'open-cart', label: `View ${target}` } });
    setDesiredQty(1);
  };

  return (
    <section>
      <div className="page-head is-flush">
        <Breadcrumbs items={catalogCrumbs({ category: p.cat, sub: p.sub, product: p })} />
      </div>
      <div className="pd-grid">
        <figure className="pd-figure">
          <div className="pd-media">
            <ProductPhoto product={p} sizes={SIZES.detail} priority />
            {/* Focused on click too (Safari doesn't), so closing the dialog brings focus back here. */}
            {p.picture?.src && <button type="button" className="pd-zoom" aria-label={`Enlarge photo of ${p.name}`} onClick={(e) => { e.currentTarget.focus(); setZoomOpen(true); }} />}
            {p.picture && p.sharedPhoto && p.sellUnit && <span className="pack-badge">{p.sellUnit}</span>}
          </div>
          {credit && (
            <figcaption className="photo-credit">
              <PhotoCreditText credit={credit} creditSource={creditSource} />
            </figcaption>
          )}
        </figure>
        <div className="pd-info">
          {showsNicotineWarning(p) && <NicotineWarning />}
          {/* The tag is a chip beside the brand line, not over the photo (AW-055). */}
          <p className="pd-brand"><span>{brand ? `${brand} · ${p.sub}` : p.sub}</span>{p.tag && <span className={`card-tag${p.tag === 'NEW' ? ' new' : ''}`}>{p.tag}</span>}</p>
          <h1>{p.name}</h1>
          <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()}${brand ? ` from ${brand}` : ''}.`}</p>
          {p.sellUnit && <p className="pd-unit">{`Sold by the ${p.sellUnit} — quantity 1 is one ${p.sellUnit}.`}</p>}
          {/* The SKU for everyone, and the chosen variant's once there is one (AW-234). */}
          <p className="pd-sku">SKU <span>{variantSku(p.sku, selected)}</span></p>
          <p className="pd-desc pd-fine">{`Supplied to licensed retail businesses for lawful resale. Next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
          {choiceRequired && <p id="pd-variant-label" className="pd-variant-label">{`Choose a ${axis.noun}`}</p>}
          {choiceRequired && (
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the radios inside take focus (roving tabindex); the group only hears their keys
            <div className="variant-chips" role="radiogroup" ref={chipsRef} aria-labelledby="pd-variant-label" aria-required="true"
                 aria-invalid={variantError || undefined} aria-describedby={variantError ? 'pd-variant-error' : undefined} onKeyDown={onChipKeyDown}>
              {variants.map(v => (
                <button key={v} type="button" role="radio" aria-checked={selected === v} tabIndex={v === tabStop ? 0 : -1} disabled={!available(v)} onClick={() => choose(v)}>{available(v) ? v : `${v} (not available)`}</button>
              ))}
            </div>
          )}
          {variantError && <p id="pd-variant-error" className="form-error" role="alert">{`Select a ${axis.noun} before adding this product.`}</p>}
          {soleShown && <p className="pd-desc">{`${axis.label}: ${soleShown}${soleUnavailable ? ' (not available)' : ''}`}</p>}
          {choiceRequired && axis.label === 'Flavor' && <p className="in-cart-note">Flavors and availability change often. The trade desk confirms what is in stock.</p>}
          {choiceRequired && <p className="in-cart-note">{`Add each ${axis.noun} you want separately.`}</p>}
          {savedQty > 0 && <p className="pd-saved">{`From your last visit: quantity ${savedQty}.${choiceRequired ? ` Choose a ${axis.noun}, then add it.` : ''}`}</p>}
          <div className="pd-price">
            {isApprovedBuyer
              ? <><b>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</b><span>{`Wholesale unit price · ${variantSku(p.sku, selected)}`}</span></>
              : profile
              ? <><b>Pending</b><span>Pricing unlocks after your account is approved</span></>
              : <><b>Sign in</b><span>Wholesale pricing is visible to approved trade accounts</span></>}
          </div>
          <div className="qty-row">
            {/* Typed or stepped, 1 to 100,000 (AW-013). */}
            <QuantityInput value={desiredQty} onChange={setDesiredQty} min={1} label={`Quantity of ${p.name} to add`} groupLabel="Quantity to add" />
            <button className="button" type="button" onClick={handleAdd} disabled={soleUnavailable || (choiceRequired && choosable.length === 0)}><span>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</span></button>
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
            <div><p className="eyebrow">{sameLine ? 'SAME LINE' : 'RELATED'}</p><h2>{sameLine ? `More ${p.sub}` : `More from ${catLabel(p.cat)}`}</h2></div>
            <Link to={{ page: 'category', category: p.cat, sub: sameLine ? p.sub : null }}>View all <span className="sr-only">{sameLine ? p.sub : catLabel(p.cat)}</span></Link>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart} addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
      {zoomOpen && p.picture?.src && (
        <ModalLayer onClose={closeZoom}>
          {/* Backdrop click is a mouse shortcut; Escape, Back (ModalLayer) and the Close button are the other ways out. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="overlay" onClick={closeZoom}>
            {/* Keeps clicks inside the dialog from reaching the backdrop. */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
            <div className="dialog pd-zoom-dialog scale-in" role="dialog" aria-modal="true" aria-label={`Photo of ${p.name}`} onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" type="button" onClick={closeZoom} aria-label="Close"><Icon name="close" /></button>
              {/* Sized to the largest rendition, so the browser loads it (AW-236). */}
              <Picture picture={p.picture} alt={p.name} sizes={p.picture.width ? `${p.picture.width}px` : undefined} loading="eager" />
              {credit && <p className="photo-credit"><PhotoCreditText credit={credit} creditSource={creditSource} /></p>}
            </div>
          </div>
        </ModalLayer>
      )}
    </section>
  );
}
