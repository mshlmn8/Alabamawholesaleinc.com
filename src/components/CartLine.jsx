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

import { formatMoney, initials } from '../lib/format.js';
import { Link } from '../lib/router.js';

export function CartLine({ item: it, layout = 'drawer', showPrice, onInc, onDec, onRemove, onChoose }) {
  const checkout = layout === 'checkout';
  const gone = !!it.unavailable;
  const priced = showPrice && it.price != null && !gone;
  const choose = it.needsVariant || it.unavailable === 'variant';
  const className = ['drawer-line', checkout && 'checkout-line', gone && 'is-unavailable'].filter(Boolean).join(' ');
  let detail;
  if (gone) detail = [it.sku, `Quantity ${it.qty}`, checkout ? '' : 'No longer available'];
  else if (checkout) detail = [it.sku, priced ? `${formatMoney(it.price)} each` : ''];
  else detail = [it.sku, priced ? formatMoney(it.price) : '', it.needsVariant ? 'Choose a variant' : ''];
  return (
    <li className={className}>
      {/* A product no catalog knows has no name to take initials from. */}
      <span className="thumb">{it.img ? <img src={it.img} alt="" /> : (gone && !it.sku ? null : initials(it.name))}</span>
      <span className="info">
        <b>{it.name}</b>
        <small>{detail.filter(Boolean).join(' · ')}</small>
        {checkout && it.needsVariant && <small>Choose a variant before submitting.</small>}
        {checkout && gone && <small className="line-flag">No longer available. Remove it to continue.</small>}
      </span>
      {choose ? (
        <Link className="text-link choose" to={{ page: 'product', productId: it.productId }} onClick={onChoose}>Choose variant</Link>
      ) : gone ? null : (
        <span className="qty" role="group" aria-label={`${it.name} quantity`}>
          <button type="button" onClick={onDec} aria-label="Decrease quantity">−</button>
          <b aria-live="polite">{it.qty}</b>
          <button type="button" onClick={onInc} aria-label="Increase quantity">+</button>
        </span>
      )}
      {checkout && priced && <b className="line-total">{formatMoney(it.qty * it.price)}</b>}
      <button className="drawer-remove" type="button" onClick={onRemove} aria-label={`Remove ${it.name}`}><span aria-hidden="true">×</span></button>
    </li>
  );
}
