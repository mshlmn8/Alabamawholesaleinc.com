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
// still need a variant (AW-354) are listed at the top. A bare line gets its
// variant on the line itself (AW-011), and quantities are typed or stepped,
// 1 to 100,000 (AW-013). Removing a line or clearing them all is read out,
// and focus moves to the next line (else the one before), or to the empty
// page's heading, never to <body> (AW-042).
//
// The catalog may have changed since the page was opened (AW-191, AW-204):
// Submit first loads it again (checkCart, from App) and stops, naming the
// lines, when one can no longer be ordered, needs a variant or has a new
// price. When the catalog can't be loaded, nothing is sent against the old
// copy.
//
// submit_quote (src/lib/orders.js): the reference number comes back from
// the server and only a saved quote shows one (AW-049); will-call hides the
// ship-to address (AW-079); the fields carry the server's limits, and a
// hidden honeypot field stops simple bots (AW-198); a suspended account sees
// that ordering is paused instead of a submit button (AW-201).
//
// Tobacco and vape lines from a guest or an unapproved account need a
// tobacco license number, a resale certificate number and a 21+ attestation
// (AW-014, PR #12; the rule is src/lib/regulated.js, and submit_quote applies
// the same one). Guests also get sign-in and apply links.
//
// The $500 minimum is not enforced (AW-076, owner question). An approved
// buyer below it is told "You can still submit this order" only while the
// submit button can actually be used (Cursor's PR #13).
//
// After the save (AW-012, AW-022): one send at a time, the lines that were
// sent leave the cart, and the page shows a receipt (QuoteReceipt.jsx) built
// from what was sent and what submit_quote answered. App keeps that receipt
// for this history entry (src/lib/receipt.js) and passes it back as
// savedReceipt, so a reload or Back shows it again instead of checkout.
//
// While a send runs, the lines and the fields are locked (one disabled
// fieldset each), and a send that takes too long gives up and says the
// request may have been saved (AW-194). Offline, the submit button is off
// with a note, and nothing is sent (AW-344).

import { useEffect, useRef, useState } from 'react';
import { COMPANY, FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { QUOTE_ERROR_GENERIC, QUOTE_OFFLINE, quoteErrorField, quoteErrorMessage, submitOrder, todayInBirmingham } from '../lib/orders.js';
import { isOffline } from '../lib/network.js';
import { useOnlineStatus } from '../lib/useOnlineStatus.js';
import { cartChanges, describeCartChanges } from '../lib/cart.js';
import { QTY_RANGE_TEXT, isOrderableQty } from '../lib/quantity.js';
import { formatMoney, formatMoneyShort } from '../lib/format.js';
import { totalLabel } from '../lib/pricing.js';
import { cartNeedsTobaccoLicense } from '../lib/regulated.js';
import { Link, focusPageHeading, scrollToTop } from '../lib/router.js';
import { DELIVERY_LABELS, buildReceipt } from '../lib/receipt.js';
import { announce } from '../lib/announce.js';
import { LINE_CONTROL, focusLineSoon, neighbourKey } from '../lib/focus.js';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { CartLine } from '../components/CartLine.jsx';
import { SavedLinesNotice, UnavailableNotice } from '../components/CartNotices.jsx';
import { AccountLoading } from '../components/AccountStatus.jsx';
import { initialQuoteForm, quoteFormForAccount } from '../lib/quoteForm.js';
import { QuoteReceipt } from './QuoteReceipt.jsx';

const UNAVAILABLE_ERROR = 'Remove the items that are no longer available before you submit.';
// Never shown for a cart read from storage, which is repaired on read; a
// guard in case a quantity the database would refuse gets through (AW-013).
const QTY_ERROR = `Quantities must be ${QTY_RANGE_TEXT}.`;

// Identifies what the buyer is looking at: which lines, how many, whether
// each can be ordered and at what price.
const itemsSignature = (items) => items.map((it) => `${it.lineKey}|${it.qty}|${it.unavailable || ''}|${it.needsVariant ? 1 : 0}|${it.price ?? ''}`).join(',');

export function QuotePage({
  items, total, setLine, chooseVariant, removeLine, removeLines, clearCart, legacy = [], onDismissLegacy,
  profile, account = profile ? 'ready' : 'signed-out', signedIn = !!profile, onSignIn, onApplyClick, isApprovedBuyer, isBackendConfigured,
  checkCart = null, pricesStatus = 'ready', isSuspended = false,
  savedReceipt = null, entryKey = null, onSubmitted,
}) {
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

  // The receipt of the quote just saved (AW-022). It belongs to the history
  // entry it was shown on: another entry starts again (App passes the saved
  // copy for this one as savedReceipt).
  const [receipt, setReceipt] = useState(null);
  const [receiptFor, setReceiptFor] = useState(entryKey);
  if (receiptFor !== entryKey) {
    setReceiptFor(entryKey);
    setReceipt(null);
  }
  const shownReceipt = receipt || savedReceipt;
  // After a save, the receipt's heading takes focus, at the top of the page
  // (at once, like a page change: the form it replaced is gone).
  const receiptHeading = useRef(null);
  const focusReceiptNext = useRef(false);
  useEffect(() => {
    if (!shownReceipt || !focusReceiptNext.current) return;
    focusReceiptNext.current = false;
    scrollToTop();
    receiptHeading.current?.focus({ preventScroll: true });
  }, [shownReceipt]);

  // The details follow the signed-in account (AW-190), also when its profile
  // arrives after the page opened (AW-186).
  const profileId = profile?.id ?? null;
  const [formFor, setFormFor] = useState(profileId);
  if (formFor !== profileId) {
    setFormFor(profileId);
    setData((current) => quoteFormForAccount(current, profile, formFor));
    // The receipt on screen was the last account's.
    setReceipt(null);
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

  // Removing lines (AW-042). With none left, the page turns into the empty
  // cart, and its heading takes focus once it is on screen.
  const linesRef = useRef(null);
  const focusHeadingNext = useRef(false);
  useEffect(() => {
    if (!focusHeadingNext.current) return;
    focusHeadingNext.current = false;
    focusPageHeading();
  }, [items.length]);
  const removeItem = (it) => {
    const next = neighbourKey(items.map(x => x.lineKey), it.lineKey);
    if (!next) focusHeadingNext.current = true;
    removeLine(it.lineKey);
    announce(`Removed ${it.name}.`);
    if (next) focusLineSoon(linesRef.current, next, { selector: LINE_CONTROL, fallback: focusPageHeading });
  };
  const clearAll = () => {
    focusHeadingNext.current = true;
    clearCart();
    announce(`Removed all items from your ${isApprovedBuyer ? 'order' : 'quote'}.`);
  };

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
  const invalidQty = orderable.some(it => !isOrderableQty(it.qty));
  const willCall = data.delivery === 'willcall';
  // The tobacco license answers (AW-014): asked of a visitor who isn't an
  // approved buyer when a line needs them (not of a suspended account, which
  // can't submit).
  const needsLicense = !isApprovedBuyer && !isSuspended && cartNeedsTobaccoLicense(orderable);
  const minDate = todayInBirmingham();
  // Not while the buyer's prices are still loading (the total is not known yet).
  const pricedBelowMinimum = isApprovedBuyer && pricesStatus !== 'loading' && Number(total) < ORDER_MINIMUM;
  const online = useOnlineStatus();
  // What keeps the submit button off (apart from a send in progress). The
  // minimum note says "you can still submit" only when nothing does (AW-076).
  const submitBlocked = isSuspended || !isBackendConfigured || needsVariant || unavailable.length > 0 || invalidQty || lostOrdering || !online;
  let submitLabel = isApprovedBuyer ? 'Submit order' : 'Submit quote request';
  if (phase === 'checking') submitLabel = 'Checking the catalog…';
  else if (phase === 'sending') submitLabel = 'Sending…';

  // A send in progress (AW-012). The button is disabled while one runs, but a
  // fast second Enter or click can arrive before that render.
  const submittingRef = useRef(false);
  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
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
    if (invalidQty) {
      setSubmitError(QTY_ERROR);
      return;
    }
    if (isOffline()) {
      setSubmitError(QUOTE_OFFLINE);
      return;
    }
    submittingRef.current = true;
    // What is sent, and what the receipt shows: edits made while it is on
    // its way change neither.
    const sent = data;
    setPhase('checking');
    setSubmitError(null);
    setErrorField(null);
    setChangeNote(null);
    let saved = null;
    try {
      let lines = orderable;
      if (checkCart) {
        const check = await checkCart();
        if (!check?.ok) {
          setSubmitError(isOffline() ? QUOTE_OFFLINE : {
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
      // License answers go only with lines that need them, from a buyer who
      // isn't approved (approved accounts were checked when they applied).
      const formData = !isApprovedBuyer && cartNeedsTobaccoLicense(lines)
        ? sent
        : { ...sent, licenseNo: '', resaleCert: '', purchasers21: false };
      const r = await submitOrder({ formData, items: lines });
      if (!r?.ok || !r.order?.id) throw new Error('The quote was not saved.');
      // The server says whether it saved an order or a quote (v2); an older
      // database doesn't, and the account decides.
      const asOrder = r.order.kind ? r.order.kind === 'order' : isApprovedBuyer;
      saved = buildReceipt({ order: r.order, lines, data: formData, asOrder });
    } catch (err) {
      // What the server refused and why, never a reference: a failed quote
      // has none (AW-049). One that took too long may have been saved.
      setSubmitError(quoteErrorMessage(err));
      setErrorField(quoteErrorField(err));
    } finally {
      submittingRef.current = false;
      setPhase(null);
    }
    if (!saved) return;
    // Saved: show the receipt and let App keep it for this history entry.
    setReceipt(saved);
    onSubmitted?.(saved);
    // Only the lines that were sent leave the cart (not clearCart): a line
    // another tab added meanwhile stays for the next quote (AW-046).
    removeLines(saved.lines.map((line) => line.lineKey));
    focusReceiptNext.current = true;
  };

  // Before the empty cart: the receipt's lines have just left the cart.
  if (shownReceipt) {
    return <QuoteReceipt receipt={shownReceipt} signedIn={signedIn} headingRef={receiptHeading} />;
  }

  if (items.length === 0) {
    return (
      <section className="page-head is-centered">
        <h1>Your cart is empty</h1>
        <p>Add products, then come back to checkout.</p>
        <Link className="button" to="/catalog">Browse catalog</Link>
        {legacy.length > 0 && (
          <div className="quote-saved-lines">
            <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} />
          </div>
        )}
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
        <p>{`Review your items and submit. The minimum order is ${formatMoney(ORDER_MINIMUM)}. A trade desk rep will confirm pricing, availability and delivery within one business day.`}</p>
      </div>
      <div className="checkout-grid">
        <div>
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} />
          {/* Locked while a send runs (AW-194): no −/+/×, variant or Clear. */}
          <fieldset className="checkout-fieldset" disabled={sending}>
          <ul className="checkout-lines" aria-label="Items in this request" ref={linesRef}>
            {items.map(it => (
              <CartLine key={it.lineKey} item={it} layout="checkout" showPrice={isApprovedBuyer} pricesStatus={pricesStatus}
                        onSetQty={(n) => setLine(it.lineKey, n)} onChooseVariant={chooseVariant}
                        onRemove={() => removeItem(it)} />
            ))}
          </ul>
          <button className="text-link checkout-clear" type="button" onClick={clearAll}>Clear all items</button>
          </fieldset>
        </div>
        <form onSubmit={handleQuoteSubmit} aria-labelledby="quote-form-title">
          <h2 id="quote-form-title" className="checkout-form-title">Your details</h2>
          {/* Guests can sign in, or apply, before filling this in (AW-014). */}
          {!signedIn && (
            <p className="fine quote-account-links">
              {onSignIn && <button className="text-link" type="button" onClick={onSignIn}>Have an account? Sign in</button>}
              <span aria-hidden="true"> · </span>
              {onApplyClick
                ? <button className="text-link" type="button" onClick={onApplyClick}>New? Apply for a trade account</button>
                : <Link className="text-link" to="/apply">New? Apply for a trade account</Link>}
            </p>
          )}
          {/* Honeypot (AW-198): out of sight and out of the tab order; people
              leave it empty. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="quote-company-website">Company website</label>
            <input id="quote-company-website" name="company_website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <fieldset className="checkout-fieldset" disabled={sending}>
          <div className="form-grid checkout-form-grid">
            <div><label htmlFor="quote-business">Business</label><input id="quote-business" name="business" value={data.business} onChange={set('business')} required maxLength={200} autoComplete="organization" {...fieldProps('business')} /></div>
            <div><label htmlFor="quote-contact">Contact</label><input id="quote-contact" name="contact" value={data.contact} onChange={set('contact')} required maxLength={120} autoComplete="name" {...fieldProps('contact')} /></div>
            <div><label htmlFor="quote-email">Email</label><input id="quote-email" name="email" type="email" value={data.email} onChange={set('email')} required maxLength={254} autoComplete="email" inputMode="email" {...fieldProps('email')} /></div>
            <div><label htmlFor="quote-phone">Phone</label><input id="quote-phone" name="phone" type="tel" value={data.phone} onChange={set('phone')} required maxLength={40} autoComplete="tel" inputMode="tel" {...fieldProps('phone')} /></div>
            {/* TODO(owner): Confirm guest tobacco and vape quotes may collect a license number, resale certificate, and 21+ attestation instead of requiring an approved sign-in. (AW-014) */}
            {needsLicense && (
              <>
                <p className="full result-note" id="quote-license-note">Your cart has tobacco or vape items. Tobacco products are supplied to licensed retailers only — 21+.</p>
                <div className="full"><label htmlFor="quote-license">State tobacco/retail license #</label><input id="quote-license" name="licenseNo" value={data.licenseNo} onChange={set('licenseNo')} required maxLength={64} autoComplete="off" {...fieldProps('licenseNo', 'quote-license-note')} /></div>
                <div className="full"><label htmlFor="quote-resale">Sales-tax / resale certificate #</label><input id="quote-resale" name="resaleCert" value={data.resaleCert} onChange={set('resaleCert')} required maxLength={64} autoComplete="off" {...fieldProps('resaleCert', 'quote-license-note')} /></div>
                <div className="full consent">
                  <input id="quote-age" name="purchasers21" type="checkbox" checked={data.purchasers21} onChange={setChecked('purchasers21')} required />
                  <label htmlFor="quote-age">I confirm this business holds a valid tobacco retail license and all purchasers are 21+</label>
                </div>
              </>
            )}
            {/* Delivery method first: will-call needs no address (AW-079). */}
            <div className="full"><label htmlFor="quote-delivery">Delivery method</label>
              <select id="quote-delivery" name="delivery" value={data.delivery} onChange={set('delivery')} aria-describedby={willCall ? 'quote-pickup' : undefined}>
                <option value="delivery">{DELIVERY_LABELS.delivery}</option>
                <option value="willcall">{DELIVERY_LABELS.willcall}</option>
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
          </fieldset>
          <div className="drawer-total checkout-total">
            <span>{`${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}</span>
            <span>{isApprovedBuyer ? totalLabel(items, total, pricesStatus) : (isSuspended ? 'Ordering paused' : (signedIn ? 'Pricing after approval' : 'Pricing after sign-in'))}</span>
          </div>
          {pricedBelowMinimum && !submitBlocked && <p className="notice" role="status">{`The order minimum is ${formatMoney(ORDER_MINIMUM)}. You can still submit this order.`}</p>}
          {!isBackendConfigured && <p className="form-error" role="status"><CallOrEmail before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {needsVariant && <p className="form-error" role="alert">Choose a variant for every product that has more than one.</p>}
          {unavailable.length > 0 && <p className="form-error" role="alert">{UNAVAILABLE_ERROR}</p>}
          {invalidQty && <p className="form-error" role="alert">{QTY_ERROR}</p>}
          {changeText && <p className="form-error" role="alert">{changeText}</p>}
          {submitError && <p className="form-error" id="quote-submit-error" role="alert">{typeof submitError === 'string' ? submitError : <CallOrEmail before={submitError.before} after={submitError.after} />}</p>}
          {lostOrdering && (
            <div className="checkout-lost">
              <p className="form-error" role="alert">{signedIn
                ? 'The account you’re signed in with can’t place orders yet, so this would go in as a quote request without prices.'
                : 'You were signed out, so this can’t be placed as an order. Sign in again to place it.'}</p>
              <div className="dialog-actions">
                {!signedIn && onSignIn && <button className="button" type="button" onClick={onSignIn}>Sign in</button>}
                <button className="text-link" type="button" onClick={() => setSendAsQuote(true)}>Send it as a quote request instead</button>
              </div>
            </div>
          )}
          {/* A suspended account can't order (AW-201): no submit, a way to reach the trade desk. */}
          {isSuspended && <p className="notice quote-paused">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>}
          {!isSuspended && (
          <button className="button wide" type="submit" disabled={sending || submitBlocked}>
            <span>{submitLabel}</span></button>
          )}
          {/* The site notice reads "You’re offline" out; this says why the button is off. */}
          {!online && <p className="result-note quote-offline">You’re offline. Reconnect to submit.</p>}
          <p className="fine">{`Orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} qualify for free delivery on a delivery route in AL, MS & GA. Will-call is pickup at the Birmingham warehouse during business hours. Tobacco products supplied to licensed retailers only — 21+.`}</p>
        </form>
      </div>
    </section>
  );
}
