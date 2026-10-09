// Catalog card: photo, name, brand/SKU, the price or pricing lock, and the
// add/stepper/choose control. The price is the signed-in buyer's, from
// priceOf(productId, variant) (App, src/lib/prices.jsx); products carry none
// (AW-003). A product whose variants are priced differently shows "From $x"
// (AW-030). The detail line counts variants by their axis ("8 flavors"),
// only when there is a choice (AW-233, AW-332), and says what quantity 1
// means when the product has a sell unit (AW-031).
//
// From Cursor's PR #13: a product without a photo shows "Photo coming soon"
// (AW-029); a photo other rows share is badged with this row's sell unit, or
// else the size word in its name, and its alt calls it representative
// (AW-136); the placeholder brand "Assorted" isn't printed (AW-286); the
// buttons say "Select options", "Add to quote" or "Add to order", and an add
// shows "Added" for a moment and is announced (AW-057).
//
// An approved buyer's price is the card's figure, larger than the name, with
// what it buys under it ("per 36-count box") when the product has a sell
// unit (AW-107). The price row sits at the foot of the card, so the rows line
// up across a grid row. Prices that didn't load are "Your price didn’t load."
// in body type, like the lock text, never a word in price type (NEW-054); the
// site notice offers Try again.
//
// The card is an <article> named by its title (AW-170). The title is a real
// link to the product page, stretched over the whole card (.card-link::after
// in index.css), so the photo opens the product too, and a cmd- or
// middle-click or "Open in new tab" works; the price and the controls sit
// above it. The link's name is the product name.
//
// The add and choose controls are .button.ghost.sm. Their names start with
// the visible label and add the product for screen readers, "Add to quote,
// Kite cigarette tobacco", so a list of buttons says which is which (AW-143,
// AW-170, WCAG 2.5.3). A comma rather than a colon: browsers put a space
// before visually hidden text, so a colon would read "Add to quote : Kite…". Cursor's "Select options" label (AW-057) is kept for
// products with a choice. Once the product is in the cart the control is the
// shared QuantityInput (AW-013): typed or stepped, with − removing the line
// from 1.
//
// The detail line wraps between its values, never inside a SKU (AW-304,
// TextParts); a SKU longer than the card ends in an ellipsis, whole in the
// text and in its title.
//
// Feedback (AW-042, AW-072): an add shows the toast ("Added … to your
// quote", with "View quote"), which is also what is read out, once
// (src/lib/toast.js). Focus moves to the stepper that replaces the button
// (its + after a tap, so a phone's keyboard doesn't open), and back to the
// add button when − at 1 removes the product, which is announced.
//
// Nothing is printed over the photo (AW-055): the tag (BESTSELLER, NEW, DEAL,
// PREMIUM) is a chip in the kicker line beside the product line, and the
// department isn't repeated on the card. Only the badge on a shared photo
// (its sell unit or size word, AW-136) stays on the photo. The photo is lazy
// unless the page says `eager`; the first card of a department page is also
// `priority` (AW-323).
//
// Without trade pricing (a guest, or an account not approved) the card says
// "Pricing after approval" as plain text (an account on hold: "Account on
// hold", AW-101, which is what `profile` is for); the page shows one
// PricingNotice with Sign in and Apply above the grid instead of a sign-in
// link on every card (AW-224). Callers may still pass onLoginClick.

import { useEffect, useId, useRef, useState } from 'react';
import {
  isVariantAvailable, lineKey, parseLineKey, requiresVariantChoice, variantAxis, variantCount, variantList,
} from '../lib/lines.js';
import { PRICE_FAILED_SENTENCE, priceDidNotLoad, priceLabel, variantPriceRange } from '../lib/pricing.js';
import { PRICE_LOCK, accountStatus } from '../lib/accountStatus.js';
import { brandLabel, sharedPhotoBadge } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { announce } from '../lib/announce.js';
import { showToast } from '../lib/toast.js';
import { ProductPhoto } from './ProductPhoto.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';
import { QuantityInput } from './QuantityInput.jsx';
import { TextParts, joinParts } from './TextParts.jsx';

const NO_PRICES = () => null;

// How long "Added" stays under the control after an add.
export const ADDED_NOTE_MS = 2000;

// The card's detail line: brand (not the placeholder), the variant count when
// there is a choice, the sell unit, the SKU (left off on the home page, AW-060).
// cardDetailParts gives the values, which the card shows as TextParts
// (AW-304); cardDetail the same line as one string.
export function cardDetailParts(p, { sku = true } = {}) {
  const count = variantCount(p);
  return [
    brandLabel(p.brand),
    count > 1 ? `${count} ${variantAxis(p).plural}` : '',
    p.sellUnit ? `Sold by the ${p.sellUnit}` : '',
    sku ? p.sku : '',
  ].filter(Boolean);
}

export function cardDetail(p, options) {
  return joinParts(cardDetailParts(p, options));
}

export function ProductCard({
  p, profile = null, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', cart, addLine, decLine, showSku = true, eager = false, priority = false,
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
  // A photo other rows share says which of them this is (AW-136).
  const badge = p.sharedPhoto ? sharedPhotoBadge(p) : '';
  return (
    <article className="content-card" aria-labelledby={titleId}>
      <div className="card-block">
        <ProductPhoto product={p} sizes={SIZES.card} priority={priority} loading={eager ? 'eager' : 'lazy'} />
        {/* TODO(owner): A correct photo for each product that shares a file with a different size or pack. (AW-136) */}
        {p.picture && p.sharedPhoto && badge && <span className="pack-badge">{badge}</span>}
      </div>
      <p className="card-kicker"><span>{p.sub}</span>{p.tag && <span className={`card-tag${p.tag === 'NEW' ? ' new' : ''}`}>{p.tag}</span>}</p>
      <h3 id={titleId}><Link className="card-link" to={productRoute}>{p.name}</Link></h3>
      <p className="card-detail"><TextParts parts={cardDetailParts(p, { sku: showSku })} code={showSku ? p.sku : null} /></p>
      {showsNicotineWarning(p) && <NicotineWarning compact />}
      <span className="card-meta card-actions">
        {isApprovedBuyer && priceDidNotLoad(shown.unit, pricesStatus) ? (
          // A sentence in body type, never a word in price type (NEW-054).
          <span className="card-price-failed">{PRICE_FAILED_SENTENCE}</span>
        ) : isApprovedBuyer ? (
          <span className="card-price">
            <b>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</b>
            {shown.unit != null && p.sellUnit && <small>{`per ${p.sellUnit}`}</small>}
          </span>
        ) : accountStatus(profile) === 'suspended' ? (
          // A suspended account is on hold, not waiting for approval (AW-101).
          <span className="lock">{PRICE_LOCK.suspended.short}</span>
        ) : (
          <span className="lock">{PRICE_LOCK.pending.short}</span>
        )}
        {choiceRequired ? (
          <Link className="button ghost sm card-add" to={productRoute}><span>{qty > 0 ? `Select options · ${qty}` : 'Select options'}</span><span className="sr-only">{`, ${p.name}`}</span></Link>
        ) : soldOut ? (
          <button className="button ghost sm card-add" type="button" disabled>Not available<span className="sr-only">{`, ${p.name}`}</span></button>
        ) : qty > 0 ? (
          <QuantityInput ref={stepperRef} className="card-stepper" value={qty} onChange={setQty} onRemove={remove} removeLabel={`Remove ${p.name}`}
                         label={`Quantity of ${p.name}`} groupLabel={`${p.name} quantity`} itemName={p.name} />
        ) : (
          <button ref={addRef} className="button ghost sm card-add" type="button" onClick={add} onPointerDown={(event) => { pressedWith.current = event.pointerType; }}>
            <span>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</span><span className="sr-only">{`, ${p.name}`}</span>
          </button>
        )}
        <span className="added-note" aria-hidden="true">{adds ? 'Added' : ''}</span>
      </span>
    </article>
  );
}
