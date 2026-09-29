// Catalog card: photo, name, brand/SKU, the price or pricing lock, and the
// add/stepper/choose control. The price is the signed-in buyer's, from
// priceOf(productId) (App, src/lib/prices.jsx); products carry none (AW-003).

import { lineKey, parseLineKey, variantList, requiresVariantChoice } from '../lib/lines.js';
import { priceLabel } from '../lib/pricing.js';
import { initials } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Picture } from './Picture.jsx';

const NO_PRICES = () => null;

export function ProductCard({ p, profile, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', cart, addLine, decLine, onLoginClick }) {
  const productRoute = { page: 'product', productId: p.id };
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const onlyVariant = variants.length === 1 ? variants[0] : null;
  const key = lineKey(p.id, onlyVariant);
  const qty = choiceRequired
    ? Object.entries(cart).reduce((sum, [k, q]) => (parseLineKey(k).productId === Number(p.id) ? sum + Number(q) : sum), 0)
    : (Number(cart[key]) || 0);
  const price = isApprovedBuyer ? priceOf(p.id, onlyVariant) : null;
  return (
    <article className="content-card">
      <Link className="card-link" to={productRoute} aria-label={`${p.name} details`}>
        <div className="card-block">
          <span className="block-label">{p.cat}</span>
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.card} /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <p className="card-kicker">{p.sub}</p>
        <h3>{p.name}</h3>
        <p className="card-detail">{`${p.brand}${p.flavors ? ` · ${p.flavors} variants` : ''} · ${p.sku}`}</p>
      </Link>
      <span className="card-meta card-actions">
        {isApprovedBuyer ? (
          <span>{priceLabel(price, pricesStatus)}</span>
        ) : profile ? (
          <span className="lock">Pricing after approval</span>
        ) : (
          <button className="lock price-login" type="button" onClick={onLoginClick}>LOCKED · Sign in for pricing</button>
        )}
        {choiceRequired ? (
          <Link className="card-add" to={productRoute}>{qty > 0 ? `Choose · ${qty}` : 'Choose'}</Link>
        ) : qty > 0 ? (
          <span className="card-stepper" role="group" aria-label={`${p.name} quantity`}>
            <button type="button" onClick={() => decLine(key)} aria-label="Decrease quantity">−</button>
            <b aria-live="polite">{qty}</b>
            <button type="button" onClick={() => addLine(p.id, onlyVariant)} aria-label="Increase quantity">+</button>
          </span>
        ) : (
          <button className="card-add" type="button" onClick={() => addLine(p.id, onlyVariant)}>{isApprovedBuyer ? 'ADD +' : 'QUOTE +'}</button>
        )}
      </span>
    </article>
  );
}
