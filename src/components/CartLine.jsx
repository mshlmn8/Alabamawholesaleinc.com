// One cart line, shared by the cart drawer and the checkout page (AW-331):
// thumbnail, name and SKU, the quantity (or a variant to choose, for a
// product still missing its variant) and remove. For an approved buyer both
// layouts give the unit price with "each" and the line total (AW-103); a
// line still waiting for its variant has no line total, as it isn't in the
// estimated total either.
//
// The quantity is the shared QuantityInput (AW-013): typed or stepped, 1 to
// 100,000; onSetQty(n) gets the new quantity. − stops at 1; Remove removes.
// Its buttons carry the line's name, variant included ("Decrease quantity of
// Cigarillos — Red", NEW-086), like the box and Remove beside them.
// Remove is a worded text button at the end of the quantity row, so it
// doesn't look like the drawer's close × just above it (AW-306); its name
// says which line ("Remove Kite").
//
// A bare line (a reorder that lost its variant) keeps its quantity and is
// given its variant right here (AW-011): a select of the product's variants
// (those not available are disabled) and a "Set flavor" button.
// onChooseVariant(lineKey, label) moves the line and returns { key, qty } of
// the line it joined, or null; focus then goes to that line's quantity. The
// button, rather than the select's change event, makes the choice, because
// arrow keys in a closed select fire change in Firefox and on Windows
// (WCAG 3.2.2). Without variants to offer, "Choose variant" is a link to the
// product page.
//
// The name and the thumbnail link to the product page too (AW-239), so a
// buyer can check a flavor, a pack size or the description from the cart.
// The thumbnail is the same link, out of the tab order and hidden from
// screen readers, so each line is one tab stop. onChoose runs when any link
// to the product page is followed (the drawer passes onClose and closes
// itself). A line whose product has left the catalog keeps its name as
// plain text: there is no page to go to.
//
// A line that can no longer be ordered (item.unavailable, AW-083) keeps its
// quantity on show but has no stepper: it says so, offers another variant
// when only its variant went away, and can be removed.
//
// A product with a sell unit says what quantity 1 means ("Sold by the
// 5-pack", AW-031) after the SKU, in both layouts. The line wraps between
// its values, never inside the SKU (TextParts, AW-304).
//
// With showPrice (an approved buyer), a line without a price says why:
// "Loading price…" while the buyer's prices load, "Price on request" for a
// product without one (pricesStatus is usePrices().status). The line total
// is worked in cents, so it is exactly "each" x quantity (AW-077). A line
// still waiting for its variant gives its variants' price instead of the
// product's (NEW-063): "From $x" when they differ, "$x each" when they are
// all the same, and nothing when none has a price (item.variantPrice,
// priceCartItems in src/lib/cart.js).

import { useId, useState } from 'react';
import { announce } from '../lib/announce.js';
import { focusLineSoon } from '../lib/focus.js';
import { formatMoney } from '../lib/format.js';
import { lineTotal, priceLabel } from '../lib/pricing.js';
import { Link } from '../lib/router.js';
import { Thumb } from './Thumb.jsx';
import { QuantityInput } from './QuantityInput.jsx';
import { TextParts } from './TextParts.jsx';

// "Set flavor": the product's variants, the ones not available disabled.
function VariantChoice({ item: it, onChooseVariant }) {
  const [picked, setPicked] = useState('');
  const id = useId();
  const noun = it.axis?.noun || 'variant';
  const name = it.productName || it.name;
  const set = (event) => {
    const list = event.currentTarget.closest('ul');
    const result = onChooseVariant?.(it.lineKey, picked);
    if (!result) {
      announce(`${picked} can’t be ordered right now. Choose another ${noun}.`);
      return;
    }
    announce(`${name} — ${picked}: quantity ${result.qty.toLocaleString('en-US')}.`);
    focusLineSoon(list, result.key);
  };
  return (
    <span className="choose variant-choose">
      <label className="sr-only" htmlFor={id}>{`Choose a ${noun} for ${name}`}</label>
      <select id={id} value={picked} onChange={(event) => setPicked(event.target.value)}>
        <option value="" disabled>{`Choose a ${noun}…`}</option>
        {it.variants.map((v) => (
          <option key={v.label} value={v.label} disabled={!v.available}>{v.available ? v.label : `${v.label} (not available)`}</option>
        ))}
      </select>
      <button className="button xs" type="button" disabled={!picked} onClick={set}>{`Set ${noun}`}</button>
    </span>
  );
}

// A bare line's price (NEW-063): its variants' unit price, "From" the lowest
// when they differ; '' when none has one.
function variantPriceText(range) {
  if (range?.unit == null) return '';
  return range.from ? `From ${formatMoney(range.unit)}` : `${formatMoney(range.unit)} each`;
}

export function CartLine({ item: it, layout = 'drawer', showPrice, pricesStatus = 'ready', onSetQty, onRemove, onChoose, onChooseVariant }) {
  const checkout = layout === 'checkout';
  const gone = !!it.unavailable;
  const priced = showPrice && it.price != null && !gone;
  // Why an approved buyer's line has no price.
  const noPrice = showPrice && !gone && !priced ? priceLabel(null, pricesStatus) : '';
  const choose = it.needsVariant || it.unavailable === 'variant';
  // The variants can be offered right here when at least one can be ordered.
  const pickHere = choose && !!it.variants?.some((v) => v.available);
  const noun = it.axis?.noun || 'variant';
  const className = ['drawer-line', checkout && 'checkout-line', gone && 'is-unavailable'].filter(Boolean).join(' ');
  const unit = it.sellUnit ? `Sold by the ${it.sellUnit}` : '';
  const linked = it.unavailable !== 'product';
  const productPage = { page: 'product', productId: it.productId };
  let detail;
  if (gone) detail = [it.sku, `Quantity ${it.qty}`, checkout ? '' : 'No longer available'];
  else if (it.needsVariant) detail = [it.sku, unit, showPrice ? variantPriceText(it.variantPrice) : ''];
  else detail = [it.sku, unit, priced ? `${formatMoney(it.price)} each` : noPrice];
  return (
    <li className={className} data-line-key={it.lineKey}>
      {/* No photo yet: the picture mark (AW-029). A product no catalog knows gets an empty tile. */}
      {linked
        ? <Link className="thumb" to={productPage} onClick={onChoose} tabIndex={-1} aria-hidden="true"><Thumb src={it.img} /></Link>
        : <span className="thumb">{gone && !it.sku && !it.img ? null : <Thumb src={it.img} />}</span>}
      <span className="info">
        {linked ? <Link className="line-name" to={productPage} onClick={onChoose}>{it.name}</Link> : <b>{it.name}</b>}
        <small><TextParts parts={detail.filter(Boolean)} /></small>
        {it.needsVariant && <small>{`${it.qty} ${it.qty === 1 ? 'unit' : 'units'} · choose a ${noun}`}</small>}
        {checkout && gone && <small className="line-flag">No longer available. Remove it to continue.</small>}
      </span>
      {pickHere ? (
        <VariantChoice item={it} onChooseVariant={onChooseVariant} />
      ) : choose ? (
        <Link className="text-link choose" to={productPage} onClick={onChoose}>Choose variant</Link>
      ) : gone ? null : (
        <QuantityInput className="qty" value={it.qty} onChange={(n) => onSetQty?.(n)} label={`Quantity of ${it.name}`} groupLabel={`${it.name} quantity`}
                       itemName={it.name} />
      )}
      {priced && !it.needsVariant && <b className="line-total">{formatMoney(lineTotal(it.price, it.qty))}</b>}
      <button className="text-link drawer-remove" type="button" onClick={onRemove} aria-label={`Remove ${it.name}`}>Remove</button>
    </li>
  );
}
