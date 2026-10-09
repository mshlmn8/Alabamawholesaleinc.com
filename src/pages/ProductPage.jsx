// Product detail: photo, description, variant picker, price or pricing lock,
// quantity and add, then more products from the same line. App keys this
// page by product id, so another product starts with a fresh picker.
//
// savedQty is this product's quantity on the list of lines from an older
// cart that still need a variant (AW-354): it fills in the quantity, and
// adding a variant uses it up.
//
// The price is the signed-in buyer's, from priceOf(productId, variant) (App,
// src/lib/prices.jsx); products carry none (AW-003). It follows the chosen
// variant; before one is chosen, variants priced differently show "From $x"
// (AW-030).
//
// Around the price (AW-265), all from my_prices(): the buyer's tier ("Silver
// price"), the list price struck through and the tier's discount when there
// is one ("list $34.05 · you save 5%"; listOf and priceTier from App), and
// the SKU once it names what is added (a chosen or only variant), else
// "Choose a flavor". Under the quantity, quantity × price = the line total,
// worked in cents like the cart's.
//
// Variants (AW-233, AW-128): a product with several gets chips labelled with
// its axis ("Choose a flavor"), and a variant marked not available is a
// disabled chip that says so (AW-030). A product with one variant has no
// chips; its variant shows as text when the name doesn't already say it.
//
// The chips are one required choice (AW-235): a radiogroup named by the
// visible "Choose a flavor" above it, one radio per chip with a roving
// tabindex, and the arrow keys, Home and End move to the next variant that
// can be chosen and choose it. The add button stays enabled (AW-074): adding
// before a choice shows "Select a flavor…" under the chips and puts focus on
// the first variant that can be chosen.
//
// When no variant can be ordered (NEW-052: the only one, or every one, is
// marked not available) there is nothing to price or add: one sentence,
// "This product can’t be ordered right now.", and the trade desk's number
// take the place of the price slot and the quantity row, and the notes about
// adding (each variant separately, flavors, the saved quantity) and the line
// total are left out.
//
// The order of the purchase column (AW-163, AW-150). On a desktop: the
// variant chips and their note, the price slot, the sell unit, then the
// quantity and add row. In the compact layout (MOBILE_QUERY: tablets, phones,
// and phones held sideways) the quantity and add row comes straight after the
// chips, and the price slot after it, so the add button is on the first
// screen of a tablet. The order is the DOM's, not CSS order, so Tab follows
// what is seen. Then, in both, the SKU, the description, the flavor note and
// the fine print.
//
// The SKU follows the chosen variant for every visitor (AW-234), and the info
// column keeps one measure (AW-237, index.css).
//
// The trail names the product line (AW-230): Home / All products / department
// / line / product. The row underneath (AW-231, src/lib/related.js) is the
// same brand first, then the line, filled from the department when the line
// is small; it is headed by the line when every pick is in it, else by the
// department, and its "View all" link goes to the one it names.
//
// The quantity to add is typed or stepped (QuantityInput, AW-013), and
// a bare cart line of this product (AW-011) doesn't count as "Already in"
// any variant.
//
// An add is confirmed by the toast (AW-072, AW-042): the quantity, the
// product and its variant, and "View quote", also read out once
// (src/lib/toast.js). Focus stays on the add button.
//
// The photo opens larger (AW-236): the whole frame is a button that opens
// the photo in a dialog, with its credit. The dialog has its own rendition
// (LEFT-5): for a photo wider than the page's largest (1024px), a zoom WebP
// up to 1600px wide that only the dialog asks for, beside the 1024 one, so a
// sharp or large screen gets the detail and the page itself never loads it;
// otherwise the largest rendition, never enlarged past it. Escape, Back and
// the backdrop close it, and focus goes back to the photo. Without a photo,
// or when it failed to load, there is no button (index.css hides it next to
// "Photo coming soon"). Other views of a pack (its back) wait on photos from
// the owner.
//
// Until the live catalog has answered (AW-232), the page is drawn from the
// copy bundled with the site, which still lists a product staff have since
// deactivated. So while the first live load runs (catalogStatus 'loading',
// not settled) the add row is held: "Checking availability…" in its place, at
// its height, and nothing can be added. When the live catalog arrives the row
// comes back, or a product it doesn't have becomes "Product not found"
// (App). If that load fails (status 'error') the bundled copy is all there
// is, and adding works as before, so the page never waits for good.
//
// From Cursor's PR #13: "Photo coming soon" without a photo (AW-029), the
// sell unit badged on a photo other rows share (AW-136), the Wikimedia credit
// under the photo (AW-033), and no placeholder brand "Assorted" (AW-286).
// A shared photo without a sell unit is badged with the size word in the
// name, or else captioned "Photo shows a related pack or size.", and its alt
// calls it representative (AW-136).

import { useRef, useState } from 'react';
import {
  informativeVariant, isVariantAvailable, lineKey, requiresVariantChoice, variantAxis, variantList, variantSku,
} from '../lib/lines.js';
import { PRICE_FAILED_SENTENCE, lineTotal, pctText, priceDidNotLoad, priceLabel, tierName, variantPriceRange } from '../lib/pricing.js';
import { CHECKING_ACCOUNT_TEXT, PRICES_NEED_PROFILE, PRICE_LOCK, accountStatus } from '../lib/accountStatus.js';
import { SHARED_PHOTO_NOTE, brandLabel, catLabel, formatMoney, photoAlt, sharedPhotoBadge } from '../lib/format.js';
import { SIZES, zoomPicture, zoomSizes } from '../lib/images.js';
import { Link } from '../lib/router.js';
import { APPLY_LABEL } from '../data/terms.js';
import { Breadcrumbs, catalogCrumbs } from '../components/Breadcrumbs.jsx';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { ProductPhoto } from '../components/ProductPhoto.jsx';
import { Picture } from '../components/Picture.jsx';
import { ModalLayer } from '../components/ModalLayer.jsx';
import { photoCredit } from '../data/photoCredits.js';
import { ProductCard } from '../components/ProductCard.jsx';
import { NicotineWarning } from '../components/NicotineWarning.jsx';
import { showsNicotineWarning } from '../lib/regulated.js';
import { Icon } from '../components/Icon.jsx';
import { QuantityInput } from '../components/QuantityInput.jsx';
import { showToast } from '../lib/toast.js';
import { maxPerLineText } from '../lib/quantity.js';
import { relatedProducts } from '../lib/related.js';
import { MOBILE_QUERY, useMediaQuery } from '../lib/useMediaQuery.js';

const NO_PRICES = () => null;
// What the add row says while the live catalog is checked (AW-232).
export const CHECKING_AVAILABILITY_TEXT = 'Checking availability…';
// What takes the place of the price and the add row when no variant can be
// ordered (NEW-052), before the trade desk's number.
export const CANT_ORDER_TEXT = 'This product can’t be ordered right now.';

// The photo credit, under the photo and in the enlarged view (AW-033): the
// author, the licence linked to its deed, the change the build made
// ("resized"), and the file page. Both links leave the site in a new tab.
function PhotoCreditText({ credit }) {
  return (
    <>
      <span>{`Photo: ${credit.author}, `}</span>
      <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer"><span>{credit.licence}</span><Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>
      <span>, resized.</span>
      {credit.source && <> <a href={credit.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a></>}
    </>
  );
}

// The line under the photo, and under the enlarged one: a shared photo's note
// (AW-136), then the credit (AW-033).
function PhotoCaption({ note, credit }) {
  return (
    <>
      {note && <span className="photo-note">{credit ? `${note} ` : note}</span>}
      {credit && <PhotoCreditText credit={credit} />}
    </>
  );
}

export function ProductPage({
  productId, profile, account = profile ? 'ready' : 'signed-out', isApprovedBuyer, priceOf = NO_PRICES, pricesStatus = 'off', listOf = NO_PRICES, priceTier = null,
  cart, addLine, decLine, products, onLoginClick, onApplyClick, savedQty = 0, catalogStatus = 'ready', catalogSettled = true,
}) {
  const [desiredQty, setDesiredQty] = useState(() => savedQty || 1);
  // What is left of the saved quantity after each add becomes the next one.
  const [prefilledFrom, setPrefilledFrom] = useState(savedQty);
  if (prefilledFrom !== savedQty) {
    setPrefilledFrom(savedQty);
    if (savedQty > 0) setDesiredQty(savedQty);
  }
  const [chosenVariant, setChosenVariant] = useState(null);
  const [variantError, setVariantError] = useState(false);
  const chipsRef = useRef(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  // The compact layout puts the add row before the price (AW-150).
  const compact = useMediaQuery(MOBILE_QUERY);
  const p = products.find(x => Number(x.id) === Number(productId));
  // App renders NotFound for ids that are not in the catalog.
  if (!p) return null;
  // Shown from the bundled copy while the first live load runs (AW-232).
  const provisional = catalogStatus === 'loading' && !catalogSettled;
  const variants = variantList(p);
  const axis = variantAxis(p);
  const available = (v) => isVariantAvailable(p, v);
  const choiceRequired = requiresVariantChoice(p);
  // A choice the catalog has since marked not available no longer counts.
  const chosen = chosenVariant && available(chosenVariant) ? chosenVariant : null;
  const selected = choiceRequired ? chosen : (variants.length === 1 ? variants[0] : null);
  const soleUnavailable = variants.length === 1 && !available(variants[0]);
  const choosable = variants.filter(available);
  // Nothing about this product can be ordered now (NEW-052).
  const noneAvailable = soleUnavailable || (choiceRequired && choosable.length === 0);
  // The chip Tab lands on: the chosen one, else the first that can be chosen.
  const tabStop = selected || choosable[0] || null;
  const soleShown = soleUnavailable ? variants[0] : informativeVariant(p);
  const key = lineKey(p.id, selected);
  // Before a variant is chosen, the key is the bare product id: a bare cart
  // line (a reorder that needs its variant, AW-011) is not "already in" it.
  const qty = choiceRequired && !selected ? 0 : (cart[key] || 0);
  const related = relatedProducts(products, p);
  const sameLine = related.every(x => x.sub === p.sub);
  const brand = brandLabel(p.brand);
  const credit = p.picture ? photoCredit(p) : null;
  // A photo other rows share shows a sibling (AW-136): its badge says which
  // row this is, from the sell unit or the name; with neither, the caption
  // says the photo shows a related pack or size.
  const badge = p.picture && p.sharedPhoto ? sharedPhotoBadge(p) : '';
  // The enlarged photo's candidates: the largest rendition and the zoom one (AW-236).
  const zoomed = zoomPicture(p.picture, p.zoom);
  const photoNote = p.picture && p.sharedPhoto && !badge ? SHARED_PHOTO_NOTE : '';
  // An account on hold is told ordering is paused and who to call, not that
  // pricing waits for approval (AW-101).
  const onHold = !isApprovedBuyer && accountStatus(profile) === 'suspended';
  let shown = { unit: null, from: false };
  // The list price beside a single unit price: the chosen (or only)
  // variant's, or the one every available variant shares (AW-265).
  let list = null;
  if (isApprovedBuyer) {
    const pending = choiceRequired && !selected;
    shown = pending
      ? variantPriceRange(variants.filter(available).map(v => priceOf(p.id, v)))
      : { unit: priceOf(p.id, selected), from: false };
    if (shown.unit != null && !shown.from) {
      const lists = pending ? variantPriceRange(variants.filter(available).map(v => listOf(p.id, v))) : { unit: listOf(p.id, selected), from: false };
      list = lists.from ? null : lists.unit;
    }
  }
  const tier = tierName(priceTier?.tier);
  const discountPct = Number(priceTier?.discountPct) || 0;
  const showSaving = shown.unit != null && !shown.from && list != null && discountPct > 0;
  // quantity × price = line total, for a single known price of something
  // that can be added.
  const qtyTotal = isApprovedBuyer && !noneAvailable && shown.unit != null && !shown.from
    ? `${desiredQty.toLocaleString('en-US')} × ${formatMoney(shown.unit)} = ${formatMoney(lineTotal(shown.unit, desiredQty))}`
    : '';
  // What the price slot says without a price. The account decides first
  // (NEW-002): Sign in and Apply only when nobody is signed in; while the
  // account is checked, a status in the shape of the pending line (the
  // height an approved price takes too, so the add row stays put); and when
  // the profile didn't load, one line, which the site notice's Try again
  // explains.
  let lockedPrice = null;
  if (!isApprovedBuyer) {
    if (onHold) {
      lockedPrice = <p>{PRICE_LOCK.suspended.line} <CallOrEmail after=" and a trade rep will help you sort it out." /></p>;
    } else if (account === 'loading') {
      lockedPrice = <><p role="status">{CHECKING_ACCOUNT_TEXT}</p><div className="text-link pd-price-hold" aria-hidden="true">View approval status</div></>;
    } else if (account === 'no-profile') {
      lockedPrice = <p>{PRICES_NEED_PROFILE}</p>;
    } else if (profile) {
      lockedPrice = <><p>{PRICE_LOCK.pending.line}</p><Link className="text-link" to="/account">View approval status</Link></>;
    } else {
      lockedPrice = <><p>Wholesale prices show here for approved trade accounts.</p><button className="button ghost" type="button" onClick={onLoginClick}>Sign in to see wholesale prices</button><button className="text-link" type="button" onClick={onApplyClick}>{APPLY_LABEL}</button></>;
    }
  } else if (priceDidNotLoad(shown.unit, pricesStatus)) {
    // An approved buyer's prices didn't load (NEW-054): a sentence, not a
    // word in price type; the site notice says why, with Try again.
    lockedPrice = <p>{PRICE_FAILED_SENTENCE}</p>;
  }
  const chipFor = (v) => chipsRef.current?.querySelectorAll('[role="radio"]')[variants.indexOf(v)] || null;
  const choose = (v) => {
    setChosenVariant(v);
    setVariantError(false);
  };
  // Arrows move to the next (or previous) variant that can be chosen, round
  // the ends; Home and End to the first and last. Each move chooses it, as in
  // a group of radio buttons. Space and Enter are the chip's own click.
  const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const onChipKeyDown = (e) => {
    if (!(e.key in STEPS) && e.key !== 'Home' && e.key !== 'End') return;
    if (choosable.length === 0) return;
    e.preventDefault();
    const radios = [...e.currentTarget.querySelectorAll('[role="radio"]')];
    const from = Math.max(0, choosable.indexOf(variants[radios.indexOf(e.target)]));
    let to = from + (STEPS[e.key] || 0);
    if (e.key === 'Home') to = 0;
    if (e.key === 'End') to = choosable.length - 1;
    const next = choosable[(to + choosable.length) % choosable.length];
    choose(next);
    chipFor(next)?.focus();
  };
  const closeZoom = () => setZoomOpen(false);
  const handleAdd = () => {
    if (provisional) return;
    if (choiceRequired && !chosen) {
      setVariantError(true);
      chipFor(choosable[0])?.focus();
      return;
    }
    if (soleUnavailable) return;
    const added = addLine(p.id, selected, desiredQty);
    if (!added) return;
    const target = isApprovedBuyer ? 'order' : 'quote';
    const what = `${p.name}${selected ? ` — ${selected}` : ''}`;
    // A line already near the limit takes only what fits (AW-013).
    const count = added.capped ? Math.max(0, added.qty - qty) : desiredQty;
    const text = count > 0
      ? `Added ${count.toLocaleString('en-US')} × ${what} to your ${target}.`
      : `Your ${target} already has ${added.qty.toLocaleString('en-US')} × ${what}.`;
    showToast({ text: added.capped ? `${text} ${maxPerLineText()}` : text, action: { id: 'open-cart', label: `View ${target}` } });
    setDesiredQty(1);
  };
  const addRow = (
    <div key="add" className="qty-row" aria-hidden={provisional || undefined}>
      {/* Typed or stepped, 1 to 100,000 (AW-013). */}
      <QuantityInput value={desiredQty} onChange={setDesiredQty} min={1} label={`Quantity of ${p.name} to add`} groupLabel="Quantity to add" />
      <button className="button" type="button" onClick={handleAdd} disabled={provisional}><span>{isApprovedBuyer ? 'Add to order' : 'Add to quote'}</span></button>
    </div>
  );
  // The purchase block's parts, keyed, so a change of layout moves them
  // rather than starting them over (the typed quantity stays).
  const priceSlot = (
    // No price yet (AW-133): a sentence and the one way forward, never a word in price type.
    <div key="price" className={lockedPrice ? 'pd-price is-locked' : 'pd-price'}>
      {lockedPrice || (
        <>
          <b>{priceLabel(shown.unit, pricesStatus, { from: shown.from })}</b>
          <span>{shown.unit != null && tier ? `${tier} price` : 'Wholesale unit price'}</span>
          {showSaving && <span className="pd-save">list <s>{formatMoney(list)}</s> · you save <strong>{pctText(discountPct)}</strong></span>}
          {/* The SKU is the .pd-sku line below, for everyone (AW-234). */}
        </>
      )}
    </div>
  );
  const unitNote = p.sellUnit && !noneAvailable ? <p key="unit" className="pd-unit">{`Sold by the ${p.sellUnit} — quantity 1 is one ${p.sellUnit}.`}</p> : null;
  const addBlock = noneAvailable ? null : provisional ? (
    // While the live catalog is checked (AW-232) the row is there but
    // unseen, so the line over it has its height, and the page doesn't
    // move when it comes back.
    <div key="add" className="pd-add-hold">
      <p className="pd-checking" role="status">{CHECKING_AVAILABILITY_TEXT}</p>
      {addRow}
    </div>
  ) : addRow;
  const totalNote = qtyTotal ? <p key="total" className="in-cart-note pd-line-total">{qtyTotal}</p> : null;
  const inCartNote = qty > 0
    ? <p key="in-cart" className="in-cart-note"><span>{`Already in ${isApprovedBuyer ? 'order' : 'quote'}: `}</span><strong>{qty}</strong><span>{selected ? ` · ${selected}` : ''}</span></p>
    : null;
  // Nothing to price or add (NEW-052): in the price slot's frame, a sentence
  // in body type and the trade desk, first in either layout.
  const priceOrNone = noneAvailable
    ? <div key="price" className="pd-price is-locked pd-cant-order"><p>{CANT_ORDER_TEXT} <CallOrEmail after=" to ask about it." /></p></div>
    : priceSlot;
  // The price leads on a desktop and follows the add row in the compact
  // layout (AW-150).
  const priceFirst = !compact || noneAvailable;

  return (
    <section>
      <div className="page-head is-flush">
        <Breadcrumbs items={catalogCrumbs({ category: p.cat, sub: p.sub, product: p })} />
      </div>
      <div className="pd-grid">
        <figure className="pd-figure">
          <div className="pd-media">
            <ProductPhoto product={p} sizes={SIZES.detail} priority />
            {/* Focused on click too (Safari doesn't), so closing the dialog brings focus back here. */}
            {p.picture?.src && <button type="button" className="pd-zoom" aria-label={`Enlarge photo of ${p.name}`} onClick={(e) => { e.currentTarget.focus(); setZoomOpen(true); }} />}
            {badge && <span className="pack-badge">{badge}</span>}
          </div>
          {(photoNote || credit) && (
            <figcaption className="photo-credit">
              <PhotoCaption note={photoNote} credit={credit} />
            </figcaption>
          )}
        </figure>
        <div className="pd-info">
          {showsNicotineWarning(p) && <NicotineWarning />}
          {/* The tag is a chip beside the brand line, not over the photo (AW-055). */}
          <p className="pd-brand"><span>{brand ? `${brand} · ${p.sub}` : p.sub}</span>{p.tag && <span className={`card-tag${p.tag === 'NEW' ? ' new' : ''}`}>{p.tag}</span>}</p>
          <h1>{p.name}</h1>
          {choiceRequired && <p id="pd-variant-label" className="pd-variant-label">{`Choose a ${axis.noun}`}</p>}
          {choiceRequired && (
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- the radios inside take focus (roving tabindex); the group only hears their keys
            <div className="variant-chips" role="radiogroup" ref={chipsRef} aria-labelledby="pd-variant-label" aria-required="true"
                 aria-invalid={variantError || undefined} aria-describedby={variantError ? 'pd-variant-error' : undefined} onKeyDown={onChipKeyDown}>
              {variants.map(v => (
                <button key={v} type="button" role="radio" aria-checked={selected === v} tabIndex={v === tabStop ? 0 : -1} disabled={!available(v)} onClick={() => choose(v)}>{available(v) ? v : `${v} (not available)`}</button>
              ))}
            </div>
          )}
          {variantError && <p id="pd-variant-error" className="form-error" role="alert">{`Select a ${axis.noun} before adding this product.`}</p>}
          {soleShown && <p className="pd-desc">{`${axis.label}: ${soleShown}${soleUnavailable ? ' (not available)' : ''}`}</p>}
          {choiceRequired && !noneAvailable && <p className="in-cart-note">{`Add each ${axis.noun} you want separately.`}</p>}
          {savedQty > 0 && !noneAvailable && <p className="pd-saved">{`From your last visit: quantity ${savedQty}.${choiceRequired ? ` Choose a ${axis.noun}, then add it.` : ''}`}</p>}
          {/* Price, sell unit, quantity and add, line total, "Already in":
              price first on a desktop, the add row first in the compact
              layout (AW-150); or the one sentence when nothing can be
              ordered (NEW-052). */}
          {priceFirst && priceOrNone}
          {unitNote}
          {addBlock}
          {totalNote}
          {inCartNote}
          {!priceFirst && priceOrNone}
          {/* The SKU for everyone, and the chosen variant's once there is one
              (AW-234), after the add row so that row stays in the first
              screen of a laptop (AW-163). */}
          <p className="pd-sku">SKU <span>{variantSku(p.sku, selected)}</span></p>
          {/* The description, the flavor note and the fine print after the
              price and the add row, so those are in the first screen (AW-163).
              Staff can show none at all (AW-023, "Show no description"): then
              neither the stored or bundled text nor the generic sentence. */}
          {!p.descriptionHidden && <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()}${brand ? ` from ${brand}` : ''}.`}</p>}
          {choiceRequired && !noneAvailable && axis.label === 'Flavor' && <p className="in-cart-note pd-flavor-note">Flavors and availability change often. The trade desk confirms what is in stock.</p>}
          <p className="pd-desc pd-fine">{`Supplied to licensed retail businesses for lawful resale. Next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><p className="eyebrow">{sameLine ? 'SAME LINE' : 'RELATED'}</p><h2>{sameLine ? `More ${p.sub}` : `More from ${catLabel(p.cat)}`}</h2></div>
            <Link to={{ page: 'category', category: p.cat, sub: sameLine ? p.sub : null }}>View all <span className="sr-only">{sameLine ? p.sub : catLabel(p.cat)}</span></Link>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} priceOf={priceOf} pricesStatus={pricesStatus} cart={cart} addLine={addLine} decLine={decLine} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
      {zoomOpen && p.picture?.src && (
        <ModalLayer onClose={closeZoom}>
          {/* Backdrop click is a mouse shortcut; Escape, Back (ModalLayer) and the Close button are the other ways out. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="overlay pd-zoom-overlay" onClick={closeZoom}>
            {/* Keeps clicks inside the dialog from reaching the backdrop. */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
            <div className="dialog pd-zoom-dialog scale-in" role="dialog" aria-modal="true" aria-label={`Photo of ${p.name}`} onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" type="button" onClick={closeZoom} aria-label="Close"><Icon name="close" /></button>
              {/* Sized to the most the dialog shows, at most the zoom file's width, so the
                  browser takes the 1024 or the zoom rendition for the screen (AW-236). */}
              <Picture picture={zoomed} alt={photoAlt(p)} sizes={zoomSizes(zoomed?.width)} loading="eager" />
              {(photoNote || credit) && <p className="photo-credit"><PhotoCaption note={photoNote} credit={credit} /></p>}
            </div>
          </div>
        </ModalLayer>
      )}
    </section>
  );
}
