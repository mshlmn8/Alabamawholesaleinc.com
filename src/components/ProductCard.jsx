// Catalog card: photo, name, brand/SKU, the price or pricing lock, and the
// add/stepper/choose control. The add and choose controls are described by
// the card's title, so "Add to quote" says which product (AW-143).

import { useId } from 'react';
import { lineKey, parseLineKey, variantList, requiresVariantChoice } from '../lib/lines.js';
import { priceForProfile } from '../lib/pricing.js';
import { formatMoney, initials } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Picture } from './Picture.jsx';
import { Icon } from './Icon.jsx';

export function ProductCard({ p, profile, isApprovedBuyer, cart, addLine, decLine, onLoginClick }) {
  const productRoute = { page: 'product', productId: p.id };
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const onlyVariant = variants.length === 1 ? variants[0] : null;
  const key = lineKey(p.id, onlyVariant);
  const qty = choiceRequired
    ? Object.entries(cart).reduce((sum, [k, q]) => (parseLineKey(k).productId === Number(p.id) ? sum + Number(q) : sum), 0)
    : (Number(cart[key]) || 0);
  const price = priceForProfile(p.price, profile);
  const titleId = useId();
  return (
    <article className="content-card">
      <Link className="card-link" to={productRoute} aria-label={`${p.name} details`}>
        <div className="card-block">
          <span className="block-label">{p.cat}</span>
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.card} /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <p className="card-kicker">{p.sub}</p>
        <h3 id={titleId}>{p.name}</h3>
        <p className="card-detail">{`${p.brand}${p.flavors ? ` · ${p.flavors} variants` : ''} · ${p.sku}`}</p>
      </Link>
      <span className="card-meta card-actions">
        {isApprovedBuyer && price != null ? (
          <span>{formatMoney(price)}</span>
        ) : profile ? (
          <span className="lock">Pricing after approval</span>
        ) : (
          <button className="lock price-login" type="button" onClick={onLoginClick}>LOCKED · Sign in for pricing</button>
        )}
        {choiceRequired ? (
          <Link className="button ghost sm card-add" to={productRoute} aria-describedby={titleId}>{qty > 0 ? `Choose variant · ${qty}` : 'Choose variant'}</Link>
        ) : qty > 0 ? (
          <span className="stepper card-stepper" role="group" aria-label={`${p.name} quantity`}>
            <button type="button" onClick={() => decLine(key)} aria-label="Decrease quantity"><Icon name="minus" /></button>
            <b aria-live="polite">{qty}</b>
            <button type="button" onClick={() => addLine(p.id, onlyVariant)} aria-label="Increase quantity"><Icon name="plus" /></button>
          </span>
        ) : (
          <button className="button ghost sm card-add" type="button" onClick={() => addLine(p.id, onlyVariant)} aria-describedby={titleId}>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</button>
        )}
      </span>
    </article>
  );
}
