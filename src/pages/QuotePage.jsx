// Quote / checkout. Saved only by submit_quote, which prices the lines on
// the server.
//
// Account changes while the page is open (AW-186, AW-190, AW-048): the page
// waits for the account before choosing between order and quote, the buyer
// details follow the signed-in account (src/lib/quoteForm.js), and a buyer
// who loses ordering mid-checkout (signed out, or the session ended) is told
// so and must sign in again or choose to send a quote request instead.
//
// Lines that can no longer be ordered (AW-083) are listed with a notice and
// block the submit until they are removed; products from an older cart that
// still need a variant (AW-354) are listed at the top.
//
// The catalog may have changed since the page was opened (AW-191, AW-204):
// Submit first loads it again (checkCart, from App) and stops, naming the
// lines, when one can no longer be ordered, needs a variant or has a new
// price. When the catalog can't be loaded, nothing is sent against the old
// copy.
//
// Tobacco and vape lines from a guest or an unapproved account need a
// tobacco licence number, a resale certificate number and a 21+ attestation
// (AW-014, PR #12). submit_quote checks them once the 2026-10-08 migration is
// applied; until then src/lib/orders.js keeps the answers in the notes.

import { useState } from 'react';
import { COMPANY, ORDER_MINIMUM } from '../data/content.js';
import { submitOrder } from '../lib/orders.js';
import { cartChanges, describeCartChanges } from '../lib/cart.js';
import { formatMoney } from '../lib/format.js';
import { Link } from '../lib/router.js';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { CartLine } from '../components/CartLine.jsx';
import { SavedLinesNotice, UnavailableNotice } from '../components/CartNotices.jsx';
import { AccountLoading } from '../components/AccountStatus.jsx';
import { initialQuoteForm, quoteFormForAccount } from '../lib/quoteForm.js';
import { cartNeedsTobaccoLicense } from '../lib/regulated.js';

const UNAVAILABLE_ERROR = 'Remove the items that are no longer available before you submit.';

// Identifies what the buyer is looking at: which lines, how many, whether
// each can be ordered and at what price.
const itemsSignature = (items) => items.map((it) => `${it.lineKey}|${it.qty}|${it.unavailable || ''}|${it.needsVariant ? 1 : 0}|${it.price ?? ''}`).join(',');

export function QuotePage({
  items, total, addLine, decLine, removeLine, removeLines, clearCart, legacy = [], onDismissLegacy,
  profile, account = profile ? 'ready' : 'signed-out', signedIn = !!profile, onSignIn, onApplyClick, isApprovedBuyer, isBackendConfigured,
  checkCart = null,
}) {
  const [step, setStep] = useState('review');
  const [data, setData] = useState(() => initialQuoteForm(profile));
  const set = k => e => setData({ ...data, [k]: e.target.value });

  // The details follow the signed-in account (AW-190), also when its profile
  // arrives after the page opened (AW-186).
  const profileId = profile?.id ?? null;
  const [formFor, setFormFor] = useState(profileId);
  if (formFor !== profileId) {
    setFormFor(profileId);
    setData((current) => quoteFormForAccount(current, profile, formFor));
  }

  // Ordering lost mid-checkout (AW-048): a buyer who was placing an order and
  // is now signed out, or signed in to an account that can't order, must not
  // send it as an unpriced quote request without being told.
  const [orderingSeen, setOrderingSeen] = useState(isApprovedBuyer);
  if (isApprovedBuyer && !orderingSeen) setOrderingSeen(true);
  const [sendAsQuote, setSendAsQuote] = useState(false);
  if (isApprovedBuyer && sendAsQuote) setSendAsQuote(false);
  const lostOrdering = orderingSeen && !isApprovedBuyer && !sendAsQuote && account !== 'loading';

  const [refNum] = useState(() => `ALW-Q-${Math.floor(Math.random() * 90000) + 10000}`);
  const [receipt, setReceipt] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  // null | 'checking' (loading the catalog again) | 'sending'
  const [phase, setPhase] = useState(null);
  const sending = phase !== null;
  // What changed in the catalog, shown until the lines on the page change.
  const [changeNote, setChangeNote] = useState(null); // { text, forItems }
  const currentSignature = itemsSignature(items);
  const changeText = changeNote && changeNote.forItems === currentSignature ? changeNote.text : null;
  const unavailable = items.filter(it => it.unavailable);
  const orderable = items.filter(it => !it.unavailable);
  const totalUnits = orderable.reduce((s, i) => s + i.qty, 0);
  const needsVariant = items.some(it => it.needsVariant);
  const needsLicense = !isApprovedBuyer && cartNeedsTobaccoLicense(orderable);
  const pricedBelowMinimum = isApprovedBuyer && Number(total) < ORDER_MINIMUM;
  let submitLabel = isApprovedBuyer ? 'Submit order' : 'Submit quote request';
  if (phase === 'checking') submitLabel = 'Checking the catalog…';
  else if (phase === 'sending') submitLabel = 'Sending…';

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!isBackendConfigured) {
      setSubmitError({ before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' });
      return;
    }
    if (needsVariant) {
      setSubmitError('Choose a variant for every product that has more than one.');
      return;
    }
    if (unavailable.length) {
      setSubmitError(UNAVAILABLE_ERROR);
      return;
    }
    setPhase('checking');
    setSubmitError(null);
    setChangeNote(null);
    try {
      let lines = orderable;
      if (checkCart) {
        const check = await checkCart();
        if (!check?.ok) {
          setSubmitError({
            before: 'We couldn’t check the latest prices and availability, so nothing was sent. Check your connection and try again, or call',
            after: ` and reference ${refNum}.`,
          });
          return;
        }
        const changes = cartChanges(items, check.items);
        if (changes.length) {
          setChangeNote({ text: describeCartChanges(changes), forItems: itemsSignature(check.items) });
          return;
        }
        lines = check.items.filter(it => !it.unavailable);
      }
      setPhase('sending');
      // Licence answers go only with lines that need them, from a buyer who
      // isn't approved (approved accounts were checked when they applied).
      const formData = !isApprovedBuyer && cartNeedsTobaccoLicense(lines)
        ? data
        : { ...data, licenseNo: '', resaleCert: '', purchasers21: false };
      const r = await submitOrder({ refNum, formData, items: lines });
      if (!r?.ok || !r.order?.id) throw new Error('The quote was not saved.');
      setReceipt({ ...r.order, asOrder: isApprovedBuyer });
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      setSubmitError(err?.code === 'unavailable'
        ? { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' }
        : { before: 'We couldn’t save this quote. Please call', after: ` and reference ${refNum}.` });
    } finally { setPhase(null); }
  };

  if (items.length === 0 && step === 'review') {
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <h1>Your cart is empty</h1>
        <p style={{ margin: '0 auto 20px' }}>Add products, then come back to checkout.</p>
        <Link className="button" to="/catalog">Browse catalog <span aria-hidden="true">↗</span></Link>
        {legacy.length > 0 && (
          <div className="quote-saved-lines">
            <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} />
          </div>
        )}
      </section>
    );
  }

  if (step === 'submitted') {
    const asOrder = !!receipt?.asOrder;
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="eyebrow">{asOrder ? 'ORDER RECEIVED' : 'QUOTE RECEIVED'}</p>
        <h1>{`Thank you, ${data.contact || 'partner'}.`}</h1>
        <p style={{ margin: '0 auto 14px' }}>
          <span>{asOrder ? 'Your order has been saved.' : 'Your quote request has been saved.'}</span> A trade desk rep will reach out within one business day at <strong style={{ color: 'var(--purple)' }}>{data.phone || data.email}</strong> to confirm details.
        </p>
        <p className="result-note" style={{ fontSize: 13 }}>Reference number: <strong>{receipt?.ref_num || refNum}</strong></p>
        <div className="dialog-actions" style={{ justifyContent: 'center' }}>
          <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call to discuss</a>
          <Link className="button" to="/" onClick={clearCart}>Back to home <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    );
  }

  // Order or quote depends on the account: wait for it (AW-186). Laid out like
  // the form below, so the heading stays put when the account arrives.
  if (account === 'loading') {
    return (
      <section>
        <div className="page-head">
          <Breadcrumbs items={[HOME_CRUMB, { label: 'Checkout' }]} />
          <p className="eyebrow">CHECKOUT</p>
          <h1>Checkout</h1>
          <AccountLoading />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: isApprovedBuyer ? 'Checkout' : 'Request Quote' }]} />
        <p className="eyebrow">{isApprovedBuyer ? 'CHECKOUT' : 'QUOTE REQUEST'}</p>
        <h1>{isApprovedBuyer ? 'Place your order' : 'Request your quote'}</h1>
        <p>Review your items and submit. The minimum order is $500.00. A trade desk rep will confirm pricing, availability and delivery within one business day.</p>
      </div>
      <div className="checkout-grid">
        <div>
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} />
          <ul className="checkout-lines" aria-label="Items in this request">
            {items.map(it => (
              <CartLine key={it.lineKey} item={it} layout="checkout" showPrice={isApprovedBuyer}
                        onInc={() => addLine(it.productId, it.variant)} onDec={() => decLine(it.lineKey)}
                        onRemove={() => removeLine(it.lineKey)} />
            ))}
          </ul>
          <button className="text-link checkout-clear" type="button" onClick={clearCart}>Clear all items</button>
        </div>
        <form onSubmit={handleQuoteSubmit} aria-labelledby="quote-form-title">
          <h2 id="quote-form-title" className="checkout-form-title">Your details</h2>
          {!signedIn && (
            <p className="fine quote-account-links">
              {onSignIn && <button className="text-link" type="button" onClick={onSignIn}>Have an account? Sign in</button>}
              <span aria-hidden="true"> · </span>
              {onApplyClick && <button className="text-link" type="button" onClick={onApplyClick}>New? Apply for a trade account</button>}
            </p>
          )}
          <div className="form-grid checkout-form-grid">
            <div><label htmlFor="quote-business">Business</label><input id="quote-business" name="business" value={data.business} onChange={set('business')} required autoComplete="organization" /></div>
            <div><label htmlFor="quote-contact">Contact</label><input id="quote-contact" name="contact" value={data.contact} onChange={set('contact')} required autoComplete="name" /></div>
            <div><label htmlFor="quote-email">Email</label><input id="quote-email" name="email" type="email" value={data.email} onChange={set('email')} required autoComplete="email" inputMode="email" /></div>
            <div><label htmlFor="quote-phone">Phone</label><input id="quote-phone" name="phone" type="tel" value={data.phone} onChange={set('phone')} required autoComplete="tel" inputMode="tel" /></div>
            <div className="full"><label htmlFor="ship-street">Street</label><input id="ship-street" name="shipStreet" value={data.shipStreet} onChange={set('shipStreet')} required autoComplete="street-address" /></div>
            <div><label htmlFor="ship-city">City</label><input id="ship-city" name="shipCity" value={data.shipCity} onChange={set('shipCity')} required autoComplete="address-level2" /></div>
            <div><label htmlFor="ship-state">State</label><input id="ship-state" name="shipState" value={data.shipState} onChange={set('shipState')} required autoComplete="address-level1" /></div>
            <div><label htmlFor="ship-zip">ZIP</label><input id="ship-zip" name="shipZip" value={data.shipZip} onChange={set('shipZip')} required autoComplete="postal-code" inputMode="numeric" /></div>
            <div><label htmlFor="quote-delivery">Delivery method</label>
              <select id="quote-delivery" name="delivery" value={data.delivery} onChange={set('delivery')}>
                <option value="delivery">Next-day delivery (on route)</option>
                <option value="willcall">Will-call pickup</option>
              </select>
            </div>
            <div><label htmlFor="quote-date">Preferred date</label><input id="quote-date" name="preferredDate" type="date" value={data.preferredDate} onChange={set('preferredDate')} autoComplete="off" /></div>
            <div className="full"><label htmlFor="quote-notes">Notes</label><input id="quote-notes" name="notes" value={data.notes} onChange={set('notes')} placeholder="Dock hours, pallet needs, substitutions…" autoComplete="off" /></div>
            {/* TODO(owner): Confirm guest tobacco and vape quotes may collect a license number, resale certificate, and 21+ attestation instead of requiring an approved sign-in. (AW-014) */}
            {needsLicense && (
              <div className="full"><label htmlFor="quote-license">State tobacco/retail license #</label><input id="quote-license" name="licenseNo" value={data.licenseNo} onChange={set('licenseNo')} required autoComplete="off" /></div>
            )}
            {needsLicense && (
              <div className="full"><label htmlFor="quote-resale">Sales-tax / resale certificate #</label><input id="quote-resale" name="resaleCert" value={data.resaleCert} onChange={set('resaleCert')} required autoComplete="off" /></div>
            )}
            {needsLicense && (
              <div className="full consent">
                <input id="quote-age" name="purchasers21" type="checkbox" checked={data.purchasers21} onChange={e => setData({ ...data, purchasers21: e.target.checked })} required />
                <label htmlFor="quote-age">I confirm this business holds a valid tobacco retail license and all purchasers are 21+</label>
              </div>
            )}
          </div>
          <div className="drawer-total checkout-total">
            <span>{`${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}</span>
            <span>{isApprovedBuyer ? formatMoney(total) : (signedIn ? 'Pricing after approval' : 'Pricing after sign-in')}</span>
          </div>
          {pricedBelowMinimum && <p className="notice" role="status">The order minimum is $500.00. You can still submit this order.</p>}
          {!isBackendConfigured && <p className="form-error" role="status"><CallOrEmail before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {needsVariant && <p className="form-error" role="alert">Choose a variant for every product that has more than one.</p>}
          {unavailable.length > 0 && <p className="form-error" role="alert">{UNAVAILABLE_ERROR}</p>}
          {changeText && <p className="form-error" role="alert">{changeText}</p>}
          {submitError && <p className="form-error" role="alert">{typeof submitError === 'string' ? submitError : <CallOrEmail before={submitError.before} after={submitError.after} />}</p>}
          {lostOrdering && (
            <div className="checkout-lost">
              <p className="form-error" role="alert">{signedIn
                ? 'The account you’re signed in with can’t place orders yet, so this would go in as a quote request without prices.'
                : 'You were signed out, so this can’t be placed as an order. Sign in again to place it.'}</p>
              <div className="dialog-actions">
                {!signedIn && onSignIn && <button className="button" type="button" onClick={onSignIn}>Sign in <span aria-hidden="true">↗</span></button>}
                <button className="text-link" type="button" onClick={() => setSendAsQuote(true)}>Send it as a quote request instead</button>
              </div>
            </div>
          )}
          <button className="button wide" type="submit" disabled={sending || !isBackendConfigured || needsVariant || unavailable.length > 0 || lostOrdering}>
            <span>{submitLabel}</span> <span aria-hidden="true">↗</span></button>
          <p className="fine">The minimum order is $500.00. Orders over $1,500 qualify for free delivery on a delivery route in AL, MS &amp; GA. Will-call is pickup at the Birmingham warehouse during business hours. Tobacco products supplied to licensed retailers only — 21+.</p>
        </form>
      </div>
    </section>
  );
}
