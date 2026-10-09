// One cart line, shared by the cart drawer and the checkout page (AW-331):
// thumbnail, name and SKU, the quantity stepper (or "Choose variant" for a
// product still missing its variant) and remove. The checkout layout adds
// "each" to the unit price, a separate variant note and the line total.
// "Choose variant" is a link to the product page; onChoose runs when it is
// followed (the drawer closes itself).
//
// A line that can no longer be ordered (item.unavailable, AW-083) keeps its
// quantity on show but has no stepper: it says so, offers "Choose variant"
// when only its variant went away, and can be removed.
//
// A product with a sell unit says what quantity 1 means ("Sold by the
// 5-pack", AW-031) after the SKU, in both layouts.
//
// With showPrice (an approved buyer), a line without a price says why:
// "Loading price…" while the buyer's prices load, "Price on request" for a
// product without one (pricesStatus is usePrices().status). The line total
// is worked in cents, so it is exactly "each" x quantity (AW-077).

import { formatMoney } from '../lib/format.js';
import { lineTotal, priceLabel } from '../lib/pricing.js';
import { Link } from '../lib/router.js';
import { Icon } from './Icon.jsx';
import { Thumb } from './Thumb.jsx';

export function CartLine({ item: it, layout = 'drawer', showPrice, pricesStatus = 'ready', onInc, onDec, onRemove, onChoose }) {
  const checkout = layout === 'checkout';
  const gone = !!it.unavailable;
  const priced = showPrice && it.price != null && !gone;
  // Why an approved buyer's line has no price.
  const noPrice = showPrice && !gone && !priced ? priceLabel(null, pricesStatus) : '';
  const choose = it.needsVariant || it.unavailable === 'variant';
  const className = ['drawer-line', checkout && 'checkout-line', gone && 'is-unavailable'].filter(Boolean).join(' ');
  const unit = it.sellUnit ? `Sold by the ${it.sellUnit}` : '';
  let detail;
  if (gone) detail = [it.sku, `Quantity ${it.qty}`, checkout ? '' : 'No longer available'];
  else if (checkout) detail = [it.sku, unit, priced ? `${formatMoney(it.price)} each` : noPrice];
  else detail = [it.sku, unit, priced ? formatMoney(it.price) : noPrice, it.needsVariant ? 'Choose a variant' : ''];
  return (
    <li className={className}>
      {/* No photo yet: the picture mark (AW-029). A product no catalog knows gets an empty tile. */}
      <span className="thumb">{gone && !it.sku && !it.img ? null : <Thumb src={it.img} />}</span>
      <span className="info">
        <b>{it.name}</b>
        <small>{detail.filter(Boolean).join(' · ')}</small>
        {checkout && it.needsVariant && <small>Choose a variant before submitting.</small>}
        {checkout && gone && <small className="line-flag">No longer available. Remove it to continue.</small>}
      </span>
      {choose ? (
        <Link className="text-link choose" to={{ page: 'product', productId: it.productId }} onClick={onChoose}>Choose variant</Link>
      ) : gone ? null : (
        <span className="stepper qty" role="group" aria-label={`${it.name} quantity`}>
          <button type="button" onClick={onDec} aria-label="Decrease quantity"><Icon name="minus" /></button>
          <b aria-live="polite">{it.qty}</b>
          <button type="button" onClick={onInc} aria-label="Increase quantity"><Icon name="plus" /></button>
        </span>
      )}
      {checkout && priced && <b className="line-total">{formatMoney(lineTotal(it.price, it.qty))}</b>}
      <button className="icon-btn drawer-remove" type="button" onClick={onRemove} aria-label={`Remove ${it.name}`}><Icon name="close" /></button>
    </li>
  );
}
