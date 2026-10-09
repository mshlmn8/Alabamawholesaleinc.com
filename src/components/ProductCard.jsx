// Catalog card: photo, name, brand/SKU, the price or pricing lock, and the
// add/stepper/choose control. The price is the signed-in buyer's, from
// priceOf(productId, variant) (App, src/lib/prices.jsx); products carry none
// (AW-003). A product whose variants are priced differently shows "From $x"
// (AW-030). The detail line counts variants by their axis ("8 flavors"),
// only when there is a choice (AW-233, AW-332), and says what quantity 1
// means when the product has a sell unit (AW-031).
//
// From Cursor's PR #13: a product without a photo shows "Photo coming soon"
// (AW-029); a photo other rows share is badged with this row's sell unit
// (AW-136); the placeholder brand "Assorted" isn't printed (AW-286); the
// buttons say "Select options", "Add to quote" or "Add to order", and an add
// shows "Added" for a moment and is announced (AW-057).
//
// The add and choose controls are .button.ghost.sm and are described by the
// card's title, so "Add to quote" says which product (AW-143). Cursor's
// "Select options" label (AW-057) is kept for products with a choice. Once
// the product is in the cart the control is the shared QuantityInput
// (AW-013): typed or stepped, with − removing the line from 1.
//
// Feedback (AW-042, AW-072): an add shows the toast ("Added … to your
// quote", with "View quote"), which is also what is read out, once
// (src/lib/toast.js). Focus moves to the stepper that replaces the button
// (its + after a tap, so a phone's keyboard doesn't open), and back to the
// add button when − at 1 removes the product, which is announced.
//
// Nothing is printed over the photo (AW-055): the tag (BESTSELLER, NEW, DEAL,
// PREMIUM) is a chip in the kicker line beside the product line, and the
// department isn't repeated on the card. Only the sell-unit badge (AW-136)
// stays on the photo. The photo is lazy unless the page says `eager`; the
// first card of a department page is also `priority` (AW-323).
//
// Without trade pricing (a guest, or an account not approved) the card says
// "Pricing after approval" as plain text; the page shows one PricingNotice
// with Sign in and Apply above the grid instead of a sign-in link on every
// card (AW-224). Callers may still pass profile and onLoginClick.

import { useEffect, useId, useRef, useState } from 'react';
import {
  isVariantAvailable, lineKey, parseLineKey, requiresVariantChoice, variantAxis, variantCount, variantList,
} from '../lib/lines.js';
import { priceLabel, variantPriceRange } from '../lib/pricing.js';
import { brandLabel } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { announce } from '../lib/announce.js';
import { showToast } from '../lib/toast.js';
import { ProductPhoto } from './ProductPhoto.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';
import { QuantityInput } from './QuantityInput.jsx';

const NO_PRICES = () => null;

// How long "Added" stays under the control after an add.
export const ADDED_NOTE_MS = 2000;

// The card's detail line: brand (not the placeholder), the variant count when
// there is a choice, the sell unit, the SKU (left off on the home page, AW-060).
export function cardDetail(p, { sku = true } = {}) {
  const count = variantCount(p);
  return [
    brandLabel(p.brand),
    count > 1 ? `${count} ${variantAxis(p).plural}` : '',
    p.sellUnit ? `Sold by the ${p.sellUnit}` : '',
    sku ? p.sku : '',
  ].filter(Boolean).join(' · ');
}

export function ProductCard({
  p, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', cart, addLine, decLine, showSku = true, eager = false, priority = false,
}) {
  // Counts the adds since "Added" last went away; each add restarts its timer.
  const [adds, setAdds] = useState(0);
  useEffect(() => {
    if (!adds) return undefined;
    const timer = window.setTimeout(() => setAdds(0), ADDED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [adds]);
  const productRoute = { page: 'product', productId: p.id };
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const onlyVariant = variants.length === 1 ? variants[0] : null;
  // The only variant is marked not available (AW-030): nothing to add.
  const soldOut = onlyVariant != null && !isVariantAvailable(p, onlyVariant);
  const key = lineKey(p.id, onlyVariant);
  const qty = choiceRequired
    ? Object.entries(cart).reduce((sum, [k, q]) => (parseLineKey(k).productId === Number(p.id) ? sum + Number(q) : sum), 0)
    : (Number(cart[key]) || 0);
  let shown = { unit: null, from: false };
  if (isApprovedBuyer) {
    shown = choiceRequired
      ? variantPriceRange(variants.filter(v => isVariantAvailable(p, v)).map(v => priceOf(p.id, v)))
      : { unit: priceOf(p.id, onlyVariant), from: false };
  }
  const target = isApprovedBuyer ? 'order' : 'quote';
  // Where focus goes once the control has changed: 'input' or 'plus' (the
  // stepper), 'add' (the add button), or nothing.
  const pendingFocus = useRef(null);
  const stepperRef = useRef(null);
  const addRef = useRef(null);
  // How the add button was last pressed (a pointer type, or '' for a key).
  const pressedWith = useRef('');
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending === 'add') addRef.current?.focus();
    else if (pending === 'plus') stepperRef.current?.parentElement?.querySelector('button:last-of-type')?.focus();
    else stepperRef.current?.focus();
  }, [qty]);
  const add = () => {
    const tapped = pressedWith.current === 'touch' || pressedWith.current === 'pen';
    pressedWith.current = '';
    pendingFocus.current = tapped ? 'plus' : 'input';
    const added = addLine(p.id, onlyVariant);
    if (!added) {
      pendingFocus.current = null;
      return;
    }
    setAdds(n => n + 1);
    // Seen and heard once; the stepper announces its own steps.
    showToast({ text: `Added ${p.name} to your ${target}.`, action: { id: 'open-cart', label: `View ${target}` } });
  };
  const remove = () => {
    pendingFocus.current = 'add';
    decLine(key, qty);
    announce(`Removed ${p.name} from your ${target}.`);
  };
  // A typed or stepped quantity, as a change from the one in the cart, with
  // the actions every page already passes (AW-013).
  const setQty = (n) => {
    if (n > qty) addLine(p.id, onlyVariant, n - qty);
    else if (n < qty) decLine(key, qty - n);
  };
  const titleId = useId();
  return (
    <article className="content-card">
      <Link className="card-link" to={productRoute} aria-label={`${p.name} details`}>
        <div className="card-block">
          <ProductPhoto product={p} sizes={SIZES.card} priority={priority} loading={eager ? 'eager' : 'lazy'} />
          {/* TODO(owner): A correct photo for each product that shares a file with a different size or pack. (AW-136) */}
          {p.picture && p.sharedPhoto && p.sellUnit && <span className="pack-badge">{p.sellUnit}</span>}
        </div>
        <p className="card-kicker"><span>{p.sub}</span>{p.tag && <span className={`card-tag${p.tag === 'NEW' ? ' new' : ''}`}>{p.tag}</span>}</p>
        <h3 id={titleId}>{p.name}</h3>
        <p className="card-detail">{cardDetail(p, { sku: showSku })}</p>
      </Link>
      {showsNicotineWarning(p) && <NicotineWarning compact />}
      <span className="card-meta card-actions">
        {isApprovedBuyer ? (
          <span>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</span>
        ) : (
          <span className="lock">Pricing after approval</span>
        )}
        {choiceRequired ? (
          <Link className="button ghost sm card-add" to={productRoute} aria-describedby={titleId}>{qty > 0 ? `Select options · ${qty}` : 'Select options'}</Link>
        ) : soldOut ? (
          <button className="button ghost sm card-add" type="button" disabled aria-describedby={titleId}>Not available</button>
        ) : qty > 0 ? (
          <QuantityInput ref={stepperRef} className="card-stepper" value={qty} onChange={setQty} onRemove={remove} removeLabel={`Remove ${p.name}`}
                         label={`Quantity of ${p.name}`} groupLabel={`${p.name} quantity`} />
        ) : (
          <button ref={addRef} className="button ghost sm card-add" type="button" onClick={add} onPointerDown={(event) => { pressedWith.current = event.pointerType; }}
                  aria-describedby={titleId}>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</button>
        )}
        <span className="added-note" aria-hidden="true">{adds ? 'Added' : ''}</span>
      </span>
    </article>
  );
}
