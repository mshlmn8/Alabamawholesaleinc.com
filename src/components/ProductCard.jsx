// Catalog card: photo, name, brand/SKU, the price or pricing lock, and the
// add/stepper/choose control. The price is the signed-in buyer's, from
// priceOf(productId, variant) (App, src/lib/prices.jsx); products carry none
// (AW-003). A product whose variants are priced differently shows "From $x"
// (AW-030). The detail line counts variants by their axis ("8 flavors"),
// only when there is a choice (AW-233, AW-332), and says what quantity 1
// means when the product has a sell unit (AW-031).

import {
  isVariantAvailable, lineKey, parseLineKey, requiresVariantChoice, variantAxis, variantCount, variantList,
} from '../lib/lines.js';
import { priceLabel, variantPriceRange } from '../lib/pricing.js';
import { initials } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Picture } from './Picture.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';

const NO_PRICES = () => null;

export function ProductCard({ p, profile, isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', cart, addLine, decLine, onLoginClick }) {
  const productRoute = { page: 'product', productId: p.id };
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const onlyVariant = variants.length === 1 ? variants[0] : null;
  // The only variant is marked not available (AW-030): nothing to add.
  const soldOut = onlyVariant != null && !isVariantAvailable(p, onlyVariant);
  const count = variantCount(p);
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
        <p className="card-detail">{`${p.brand}${count > 1 ? ` · ${count} ${variantAxis(p).plural}` : ''}${p.sellUnit ? ` · Sold by the ${p.sellUnit}` : ''} · ${p.sku}`}</p>
      </Link>
      {showsNicotineWarning(p) && <NicotineWarning compact />}
      <span className="card-meta card-actions">
        {isApprovedBuyer ? (
          <span>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</span>
        ) : profile ? (
          <span className="lock">Pricing after approval</span>
        ) : (
          <button className="lock price-login" type="button" onClick={onLoginClick}>LOCKED · Sign in for pricing</button>
        )}
        {choiceRequired ? (
          <Link className="card-add" to={productRoute}>{qty > 0 ? `Choose · ${qty}` : 'Choose'}</Link>
        ) : soldOut ? (
          <button className="card-add" type="button" disabled>Not available</button>
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
