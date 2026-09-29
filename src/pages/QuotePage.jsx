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
// submit_quote v2 (src/lib/orders.js): the reference number comes back from
// the server and only a saved quote shows one (AW-049); will-call hides the
// ship-to address (AW-079); the fields carry the server's limits, and a
// hidden honeypot field stops simple bots (AW-198); a suspended account sees
// that ordering is paused instead of a submit button (AW-201); guests get
// sign-in and apply links, and a cart with tobacco or novelty lines asks for
// the store's license details when the visitor isn't an approved buyer
// (AW-014, src/data/quoteRules.js).

import { useState } from 'react';
import { COMPANY, ORDER_MINIMUM } from '../data/content.js';
import { QUOTE_ERROR_GENERIC, quoteErrorField, quoteErrorMessage, submitOrder, todayInBirmingham } from '../lib/orders.js';
import { AGE_RESTRICTED_DEPARTMENTS, LICENSE_ATTESTATION, LICENSE_FIELDS_FOR_GUESTS } from '../data/quoteRules.js';
import { cartChanges, describeCartChanges } from '../lib/cart.js';
import { formatMoney } from '../lib/format.js';
import { totalLabel } from '../lib/pricing.js';
import { Link } from '../lib/router.js';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { CartLine } from '../components/CartLine.jsx';
import { SavedLinesNotice, UnavailableNotice } from '../components/CartNotices.jsx';
import { AccountLoading } from '../components/AccountStatus.jsx';
import { initialQuoteForm, quoteFormForAccount } from '../lib/quoteForm.js';

const UNAVAILABLE_ERROR = 'Remove the items that are no longer available before you submit.';

// Identifies what the buyer is looking at: which lines, how many, whether
// each can be ordered and at what price.
const itemsSignature = (items) => items.map((it) => `${it.lineKey}|${it.qty}|${it.unavailable || ''}|${it.needsVariant ? 1 : 0}|${it.price ?? ''}`).join(',');

export function QuotePage({
  items, total, addLine, decLine, removeLine, removeLines, clearCart, legacy = [], onDismissLegacy,
  profile, account = profile ? 'ready' : 'signed-out', signedIn = !!profile, onSignIn, isApprovedBuyer, isBackendConfigured,
  checkCart = null, pricesStatus = 'ready', isSuspended = false,
}) {
  const [step, setStep] = useState('review');
  const [data, setData] = useState(() => initialQuoteForm(profile));
  // The field the last refused submit was about (its hint), marked invalid
  // until it is edited.
  const [errorField, setErrorField] = useState(null);
  const set = k => e => {
    setData({ ...data, [k]: e.target.value });
    if (k === errorField) setErrorField(null);
  };
  const setChecked = k => e => setData({ ...data, [k]: e.target.checked });
  // aria-describedby: the field's own hint, and the submit error when it is
  // about this field.
  const fieldProps = (k, hintId = null) => {
    const ids = [hintId, errorField === k ? 'quote-submit-error' : null].filter(Boolean).join(' ');
    return { 'aria-invalid': errorField === k ? true : undefined, 'aria-describedby': ids || undefined };
  };

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
  // A suspended account is told ordering is paused instead (AW-201).
  const lostOrdering = orderingSeen && !isApprovedBuyer && !sendAsQuote && account !== 'loading' && !isSuspended;

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
  const willCall = data.delivery === 'willcall';
  // The store's license details (AW-014): asked of visitors who aren't
  // approved buyers when a line is in an age-restricted department (not of
  // a suspended account, which can't submit).
  const showLicense = LICENSE_FIELDS_FOR_GUESTS !== 'off' && !isApprovedBuyer && !isSuspended
    && items.some(it => AGE_RESTRICTED_DEPARTMENTS.includes(it.cat));
  const licenseRequired = LICENSE_FIELDS_FOR_GUESTS === 'required';
  const optional = licenseRequired ? '' : ' (optional)';
  const minDate = todayInBirmingham();
  // Not while the buyer's prices are still loading (the total is not known yet).
  const pricedBelowMinimum = isApprovedBuyer && pricesStatus !== 'loading' && Number(total) < ORDER_MINIMUM;
  let submitLabel = isApprovedBuyer ? 'Submit order' : 'Submit quote request';
  if (phase === 'checking') submitLabel = 'Checking the catalog…';
  else if (phase === 'sending') submitLabel = 'Sending…';

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (isSuspended) return;
    // A person never fills the hidden honeypot field; a bot filling every
    // field does, and is told what a failed save says (AW-198).
    if (e.currentTarget.elements.namedItem('company_website')?.value) {
      setSubmitError(QUOTE_ERROR_GENERIC);
      return;
    }
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
    setErrorField(null);
    setChangeNote(null);
    try {
      let lines = orderable;
      if (checkCart) {
        const check = await checkCart();
        if (!check?.ok) {
          setSubmitError({
            before: 'We couldn’t check the latest prices and availability, so nothing was sent. Check your connection and try again, or call the trade desk at',
            after: '.',
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
      const license = showLicense
        ? { licenseNo: data.licenseNo, resaleCertNo: data.resaleCertNo, attested: data.licenseAttested }
        : null;
      const r = await submitOrder({ formData: data, items: lines, license });
      if (!r?.ok || !r.order?.id) throw new Error('The quote was not saved.');
      // The server says whether it saved an order or a quote (v2); an older
      // database doesn't, and the account decides.
      setReceipt({ ...r.order, asOrder: r.order.kind ? r.order.kind === 'order' : isApprovedBuyer });
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      // What the server refused and why, never a reference: a failed quote
      // has none (AW-049).
      setSubmitError(quoteErrorMessage(err));
      setErrorField(quoteErrorField(err));
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
        <p className="result-note" style={{ fontSize: 13 }}>Reference number: <strong>{receipt?.ref_num}</strong></p>
        {/* The total the server saved (AW-351), priced by submit_quote. */}
        {receipt?.subtotal != null && <p className="result-note">{`Saved total: ${formatMoney(receipt.subtotal)} · ${receipt.total_units} ${Number(receipt.total_units) === 1 ? 'unit' : 'units'}`}</p>}
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
              <CartLine key={it.lineKey} item={it} layout="checkout" showPrice={isApprovedBuyer} pricesStatus={pricesStatus}
                        onInc={() => addLine(it.productId, it.variant)} onDec={() => decLine(it.lineKey)}
                        onRemove={() => removeLine(it.lineKey)} />
            ))}
          </ul>
          <button className="text-link checkout-clear" type="button" onClick={clearCart}>Clear all items</button>
        </div>
        <form onSubmit={handleQuoteSubmit} aria-labelledby="quote-form-title">
          <h2 id="quote-form-title" className="checkout-form-title">Your details</h2>
          {/* Guests can sign in, or apply, before filling this in (AW-014). */}
          {!signedIn && (
            <div className="quote-account-links">
              {onSignIn && <p><span>Have an account?</span> <button className="text-link" type="button" onClick={onSignIn}>Sign in</button></p>}
              <p><span>New?</span> <Link className="text-link" to="/apply">Apply for a trade account</Link></p>
            </div>
          )}
          {/* Honeypot (AW-198): out of sight and out of the tab order; people
              leave it empty. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="quote-company-website">Company website</label>
            <input id="quote-company-website" name="company_website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <div className="form-grid checkout-form-grid">
            <div><label htmlFor="quote-business">Business</label><input id="quote-business" name="business" value={data.business} onChange={set('business')} required maxLength={200} autoComplete="organization" {...fieldProps('business')} /></div>
            <div><label htmlFor="quote-contact">Contact</label><input id="quote-contact" name="contact" value={data.contact} onChange={set('contact')} required maxLength={120} autoComplete="name" {...fieldProps('contact')} /></div>
            <div><label htmlFor="quote-email">Email</label><input id="quote-email" name="email" type="email" value={data.email} onChange={set('email')} required maxLength={254} autoComplete="email" inputMode="email" {...fieldProps('email')} /></div>
            <div><label htmlFor="quote-phone">Phone</label><input id="quote-phone" name="phone" type="tel" value={data.phone} onChange={set('phone')} required maxLength={40} autoComplete="tel" inputMode="tel" {...fieldProps('phone')} /></div>
            {showLicense && (
              <>
                <p className="full result-note" id="quote-license-note">Your cart has tobacco or novelty items. Tobacco products are supplied to licensed retailers only — 21+.</p>
                <div><label htmlFor="quote-license">{`State tobacco/retail license #${optional}`}</label><input id="quote-license" name="licenseNo" value={data.licenseNo} onChange={set('licenseNo')} required={licenseRequired} maxLength={64} autoComplete="off" {...fieldProps('licenseNo', 'quote-license-note')} /></div>
                <div><label htmlFor="quote-resale">{`Sales-tax / resale certificate #${optional}`}</label><input id="quote-resale" name="resaleCertNo" value={data.resaleCertNo} onChange={set('resaleCertNo')} required={licenseRequired} maxLength={64} autoComplete="off" {...fieldProps('resaleCertNo', 'quote-license-note')} /></div>
                <div className="full quote-attest">
                  <label htmlFor="quote-attest"><input id="quote-attest" name="licenseAttested" type="checkbox" checked={data.licenseAttested} onChange={setChecked('licenseAttested')} required={licenseRequired} /> <span>{LICENSE_ATTESTATION}</span></label>
                </div>
              </>
            )}
            {/* Delivery method first: will-call needs no address (AW-079). */}
            <div className="full"><label htmlFor="quote-delivery">Delivery method</label>
              <select id="quote-delivery" name="delivery" value={data.delivery} onChange={set('delivery')} aria-describedby={willCall ? 'quote-pickup' : undefined}>
                <option value="delivery">Next-day delivery (on route)</option>
                <option value="willcall">Will-call pickup</option>
              </select>
            </div>
            {willCall ? (
              <p className="full result-note" id="quote-pickup">{`Pickup at ${COMPANY.addressShort} during business hours.`}</p>
            ) : (
              <>
                <div className="full"><label htmlFor="ship-street">Street</label><input id="ship-street" name="shipStreet" value={data.shipStreet} onChange={set('shipStreet')} required maxLength={200} autoComplete="street-address" {...fieldProps('shipStreet')} /></div>
                <div><label htmlFor="ship-city">City</label><input id="ship-city" name="shipCity" value={data.shipCity} onChange={set('shipCity')} required maxLength={100} autoComplete="address-level2" {...fieldProps('shipCity')} /></div>
                <div><label htmlFor="ship-state">State</label><input id="ship-state" name="shipState" value={data.shipState} onChange={set('shipState')} required maxLength={2} pattern="[A-Za-z]{2}" title="The 2-letter state code, for example AL" autoCapitalize="characters" autoComplete="address-level1" {...fieldProps('shipState')} /></div>
                <div><label htmlFor="ship-zip">ZIP</label><input id="ship-zip" name="shipZip" value={data.shipZip} onChange={set('shipZip')} required maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" title="A 5-digit ZIP code, or ZIP+4" autoComplete="postal-code" inputMode="numeric" {...fieldProps('shipZip')} /></div>
              </>
            )}
            <div><label htmlFor="quote-date">Preferred date</label><input id="quote-date" name="preferredDate" type="date" value={data.preferredDate} onChange={set('preferredDate')} min={minDate} autoComplete="off" {...fieldProps('preferredDate')} /></div>
            <div className="full"><label htmlFor="quote-notes">Notes</label><input id="quote-notes" name="notes" value={data.notes} onChange={set('notes')} maxLength={2000} placeholder="Dock hours, pallet needs, substitutions…" autoComplete="off" /></div>
          </div>
          <div className="drawer-total checkout-total">
            <span>{`${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}</span>
            <span>{isApprovedBuyer ? totalLabel(items, total, pricesStatus) : (isSuspended ? 'Ordering paused' : (signedIn ? 'Pricing after approval' : 'Pricing after sign-in'))}</span>
          </div>
          {pricedBelowMinimum && <p className="notice" role="status">The order minimum is $500.00. You can still submit this order.</p>}
          {!isBackendConfigured && <p className="form-error" role="status"><CallOrEmail before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {needsVariant && <p className="form-error" role="alert">Choose a variant for every product that has more than one.</p>}
          {unavailable.length > 0 && <p className="form-error" role="alert">{UNAVAILABLE_ERROR}</p>}
          {changeText && <p className="form-error" role="alert">{changeText}</p>}
          {submitError && <p className="form-error" id="quote-submit-error" role="alert">{typeof submitError === 'string' ? submitError : <CallOrEmail before={submitError.before} after={submitError.after} />}</p>}
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
          {/* A suspended account can't order (AW-201): no submit, a way to reach the trade desk. */}
          {isSuspended && <p className="notice quote-paused">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>}
          {!isSuspended && (
          <button className="button wide" type="submit" disabled={sending || !isBackendConfigured || needsVariant || unavailable.length > 0 || lostOrdering}>
            <span>{submitLabel}</span> <span aria-hidden="true">↗</span></button>
          )}
          <p className="fine">The minimum order is $500.00. Orders over $1,500 qualify for free delivery on a delivery route in AL, MS &amp; GA. Will-call is pickup at the Birmingham warehouse during business hours. Tobacco products supplied to licensed retailers only — 21+.</p>
        </form>
      </div>
    </section>
  );
}
