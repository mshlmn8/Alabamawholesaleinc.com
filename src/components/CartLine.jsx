// One cart line, shared by the cart drawer and the checkout page (AW-331):
// thumbnail, name and SKU, the quantity stepper (or "Choose variant" for a
// product still missing its variant) and remove. The checkout layout adds
// "each" to the unit price, a separate variant note and the line total.

import { formatMoney, initials } from '../lib/format.js';

export function CartLine({ item: it, layout = 'drawer', showPrice, onInc, onDec, onRemove, onChoose }) {
  const checkout = layout === 'checkout';
  const priced = showPrice && it.price != null;
  return (
    <li className={checkout ? 'drawer-line checkout-line' : 'drawer-line'}>
      <span className="thumb">{it.img ? <img src={it.img} alt="" /> : initials(it.name)}</span>
      <span className="info">
        <b>{it.name}</b>
        {checkout ? (
          <>
            <small>{`${it.sku}${priced ? ` · ${formatMoney(it.price)} each` : ''}`}</small>
            {it.needsVariant && <small>Choose a variant before submitting.</small>}
          </>
        ) : (
          <small>{`${it.sku}${priced ? ` · ${formatMoney(it.price)}` : ''}${it.needsVariant ? ' · Choose a variant' : ''}`}</small>
        )}
      </span>
      {it.needsVariant ? (
        <button className="text-link choose" type="button" onClick={onChoose}>Choose variant</button>
      ) : (
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
