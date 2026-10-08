// Product detail: photo, description, variant picker, price or pricing lock,
// quantity and add, then more products from the same line. App keys this
// page by product id, so another product starts with a fresh picker.
//
// savedQty is this product's quantity on the list of lines from an older
// cart that still need a variant (AW-354): it fills in the quantity, and
// adding a variant uses it up.

import { useState } from 'react';
import { lineKey, variantList, variantSku, requiresVariantChoice } from '../lib/lines.js';
import { priceForProfile } from '../lib/pricing.js';
import { catLabel, formatMoney, initials } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { Picture } from '../components/Picture.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { NicotineWarning } from '../components/NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';

export function ProductPage({ productId, profile, isApprovedBuyer, cart, addLine, decLine, products, onLoginClick, onApplyClick, savedQty = 0 }) {
  const [desiredQty, setDesiredQty] = useState(() => savedQty || 1);
  // What is left of the saved quantity after each add becomes the next one.
  const [prefilledFrom, setPrefilledFrom] = useState(savedQty);
  if (prefilledFrom !== savedQty) {
    setPrefilledFrom(savedQty);
    if (savedQty > 0) setDesiredQty(savedQty);
  }
  const [chosenVariant, setChosenVariant] = useState(null);
  const [variantError, setVariantError] = useState(false);
  const p = products.find(x => Number(x.id) === Number(productId));
  // App renders NotFound for ids that are not in the catalog.
  if (!p) return null;
  const department = { page: 'category', category: p.cat };
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const selected = choiceRequired ? chosenVariant : (variants.length === 1 ? variants[0] : null);
  const key = lineKey(p.id, selected);
  const qty = cart[key] || 0;
  const related = products.filter(x => x.sub === p.sub && Number(x.id) !== Number(p.id)).slice(0, 4);
  const price = priceForProfile(p.price, profile);
  const handleAdd = () => {
    if (choiceRequired && !chosenVariant) {
      setVariantError(true);
      return;
    }
    addLine(p.id, selected, desiredQty);
    setDesiredQty(1);
  };

  return (
    <section>
      <div className="page-head" style={{ paddingBottom: 0 }}>
        <Breadcrumbs items={[HOME_CRUMB, { label: catLabel(p.cat), to: department }, { label: p.name }]} />
      </div>
      <div className="pd-grid">
        <div className="pd-media">
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.detail} priority /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <div className="pd-info">
          {showsNicotineWarning(p) && <NicotineWarning />}
          <p className="pd-brand">{`${p.brand} · ${p.sub}`}</p>
          <h1>{p.name}</h1>
          <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()} from ${p.brand}.`}</p>
          {p.sellUnit && <p className="pd-unit">{`Sold by the ${p.sellUnit} — quantity 1 is one ${p.sellUnit}.`}</p>}
          <p className="pd-desc pd-fine">{`SKU ${p.sku}. Supplied to licensed retail businesses for lawful resale. Next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
          {variants.length > 0 && (
            <div className="variant-chips" role="group" aria-label={choiceRequired ? 'Choose a variant' : 'Variant'}>
              {variants.map(v => (
                <button key={v} type="button" aria-pressed={selected === v} onClick={() => { setChosenVariant(v); setVariantError(false); }}>{v}</button>
              ))}
            </div>
          )}
          {variants.length > 1 && <p className="in-cart-note">Flavors and availability change often. The trade desk confirms what is in stock.</p>}
          {choiceRequired && <p className="in-cart-note">Choose one variant. Each variant is quoted on its own line.</p>}
          {savedQty > 0 && <p className="pd-saved">{`From your last visit: quantity ${savedQty}.${choiceRequired ? ' Choose a variant, then add it.' : ''}`}</p>}
          {variantError && <p className="form-error" role="alert">Select a variant before adding this product.</p>}
          <div className="pd-price">
            {isApprovedBuyer && price != null
              ? <><b>{formatMoney(price)}</b><span>{`Wholesale unit price · ${variantSku(p.sku, selected)}`}</span></>
              : profile
              ? <><b>Pending</b><span>Pricing unlocks after your account is approved</span></>
              : <><b>Sign in</b><span>Wholesale pricing is visible to approved trade accounts</span></>}
          </div>
          <div className="qty-row">
            <div className="qty-stepper" role="group" aria-label="Quantity to add">
              <button type="button" onClick={() => setDesiredQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <b aria-live="polite">{desiredQty}</b>
              <button type="button" onClick={() => setDesiredQty(q => q + 1)} aria-label="Increase quantity">+</button>
            </div>
            <button className="button" type="button" onClick={handleAdd} disabled={choiceRequired && !chosenVariant}><span>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</span> <span aria-hidden="true">↗</span></button>
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
            <div><p className="eyebrow">SAME LINE</p><h2>{`More ${p.sub.toLowerCase()}`}</h2></div>
            <Link to={department}>View department <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} cart={cart} addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
    </section>
  );
}
