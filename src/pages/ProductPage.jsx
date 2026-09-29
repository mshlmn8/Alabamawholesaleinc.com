// Product detail: photo, description, variant picker, price or pricing lock,
// quantity and add, then more products from the same line.

import { useState, useEffect } from 'react';
import { lineKey, variantList, variantSku, requiresVariantChoice } from '../lib/lines.js';
import { priceForProfile } from '../lib/pricing.js';
import { catLabel, formatMoney, initials } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Picture } from '../components/Picture.jsx';
import { ProductCard } from '../components/ProductCard.jsx';

export function ProductPage({ productId, profile, isApprovedBuyer, cart, addLine, decLine, products, goProduct, goHome, goCategory, onLoginClick, onApplyClick, onAccountClick }) {
  const [desiredQty, setDesiredQty] = useState(1);
  const [chosenVariant, setChosenVariant] = useState(null);
  const [variantError, setVariantError] = useState(false);
  // Resets the picker when another product opens in the same page instance.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesiredQty(1);
    setChosenVariant(null);
    setVariantError(false);
  }, [productId]);
  const p = products.find(x => Number(x.id) === Number(productId));
  if (!p) {
    return (
      <section className="page-head">
        <h1>Product not found</h1>
        <p><button className="text-link" onClick={goHome}>Back to home</button></p>
      </section>
    );
  }
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
        <div className="crumbs">
          <button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span>
          <button type="button" onClick={() => goCategory(p.cat)}>{catLabel(p.cat)}</button><span aria-hidden="true">/</span>
          <span>{p.name}</span>
        </div>
      </div>
      <div className="pd-grid">
        <div className="pd-media">
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.detail} priority /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <div className="pd-info">
          <p className="pd-brand">{p.brand} · {p.sub}</p>
          <h1>{p.name}</h1>
          <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()} from ${p.brand}.`}</p>
          {p.sellUnit && <p className="pd-unit">Sold by the {p.sellUnit} — quantity 1 is one {p.sellUnit}.</p>}
          <p className="pd-desc pd-fine">SKU {p.sku}. Supplied to licensed retail businesses for lawful resale. Next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.</p>
          {variants.length > 0 && (
            <div className="variant-chips" role="group" aria-label={choiceRequired ? 'Choose a variant' : 'Variant'}>
              {variants.map(v => (
                <button key={v} type="button" aria-pressed={selected === v} onClick={() => { setChosenVariant(v); setVariantError(false); }}>{v}</button>
              ))}
            </div>
          )}
          {variants.length > 1 && <p className="in-cart-note">Flavors and availability change often. The trade desk confirms what is in stock.</p>}
          {choiceRequired && <p className="in-cart-note">Choose one variant. Each variant is quoted on its own line.</p>}
          {variantError && <p className="form-error" role="alert">Select a variant before adding this product.</p>}
          <div className="pd-price">
            {isApprovedBuyer && price != null
              ? <><b>{formatMoney(price)}</b><span>Wholesale unit price · {variantSku(p.sku, selected)}</span></>
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
            <button className="button" type="button" onClick={handleAdd} disabled={choiceRequired && !chosenVariant}>{isApprovedBuyer ? 'Add to order' : 'Add to quote'} <span aria-hidden="true">↗</span></button>
          </div>
          {qty > 0 && <p className="in-cart-note">Already in {isApprovedBuyer ? 'order' : 'quote'}: <strong>{qty}</strong>{selected ? ` · ${selected}` : ''}</p>}
          {!profile && (
            <div className="dialog-actions compact-actions">
              <button className="text-link" type="button" onClick={onLoginClick}>Sign in for pricing</button>
              <button className="text-link" type="button" onClick={onApplyClick}>Apply for account</button>
            </div>
          )}
          {profile && !isApprovedBuyer && (
            <div className="dialog-actions compact-actions">
              <button className="text-link" type="button" onClick={onAccountClick}>View approval status</button>
            </div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><p className="eyebrow">SAME LINE</p><h2>More {p.sub.toLowerCase()}</h2></div>
            <button type="button" onClick={() => goCategory(p.cat)}>View department <span aria-hidden="true">↗</span></button>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} cart={cart} addLine={addLine} decLine={decLine} goProduct={goProduct} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
    </section>
  );
}
