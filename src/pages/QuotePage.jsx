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
// Under the list (AW-082, AW-238): the lines and units, and "Clear all items"
// at the other end of the row, away from the steppers. Clearing can be
// undone: the empty page says how many items went, with an Undo that puts
// them back (restoreLines, keeping lines another tab added meanwhile) and
// focuses the first one's quantity. The offer has no time limit (WCAG
// 2.2.1); it goes when lines come back another way or the cart's owner
// changes. Under the total, an approved buyer sees how far the order is from
// the minimum and from free delivery (CartSummary). The page, empty or not,
// says where the cart is kept (AW-334): on this device, or with the account
// while it is saved there (cartSynced, src/lib/cartSync.js).
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
// The $500 minimum is not enforced (AW-076, owner question), and the page
// states it once, as $500 (AW-283, NEW-059): in the intro, or, for an
// approved buyer whose meter asks for the rest of it, in the meter alone,
// which adds "You can still submit this order." only while the submit
// button can actually be used (Cursor's PR #13). Lines without a price yet
// (prices loading or failed, price on request, a variant to choose) are not
// measured against it (NEW-010). When the buyer's prices didn't load, a
// "Load prices again" button sits by the total, and a submit that can't
// re-check them says so instead of blaming the connection.
//
// A suspended account (AW-201, NEW-064) reads that ordering is paused, and
// how to reach the trade desk, in place of the intro. Its lines can still be
// changed (the cart is kept for later); the details are locked, and there is
// no submit button.
//
// A signed-in buyer's ship-to address starts from the store address on the
// application (src/lib/quoteForm.js), then from the address of their last
// delivery order when there is one (loadShipTo, from App: src/lib/shipTo.js,
// AW-102), without new storage and never over typed text. While the fields
// hold one of those, "Use a different address" empties them and moves to
// Street.
//
// The form is kept as a draft for this tab and cart owner (AW-080,
// src/lib/quoteDraft.js), so following a line's product link, Back or a
// reload brings back what was typed. A successful submit clears it.
//
// The fields (AW-078): the ship-to State lists the delivery route states,
// the phone needs 10 digits (checked before anything is sent) and Notes is a
// box of several lines. On phones State and ZIP share a row (AW-241).
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
// with a note, and nothing is sent (AW-344). A refusal names the product it
// is about (AW-200, quoteErrorMessage in src/lib/orders.js). The lock drops
// focus to <body>, so when a submit ends without a save, focus comes back
// to the field the refusal is about, else to the message saying what
// happened (NEW-009).

import { useEffect, useRef, useState } from 'react';
import { COMPANY, FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { APPLY_INSTEAD, SIGN_IN_INSTEAD, basketTerms, cartDeviceNote } from '../data/terms.js';
import { QUOTE_ERROR_GENERIC, QUOTE_OFFLINE, quoteErrorField, quoteErrorMessage, submitOrder, todayInBirmingham } from '../lib/orders.js';
import { isOffline } from '../lib/network.js';
import { useOnlineStatus } from '../lib/useOnlineStatus.js';
import { cartChanges, describeCartChanges, variantExcludedText } from '../lib/cart.js';
import { cartCounts, countsLabel, deliveryProgress, meterReady } from '../lib/cartSummary.js';
import { PRICE_LOCK } from '../lib/accountStatus.js';
import { QTY_RANGE_TEXT, isOrderableQty } from '../lib/quantity.js';
import { formatMoneyShort } from '../lib/format.js';
import { totalLabel } from '../lib/pricing.js';
import { cartNeedsTobaccoLicense } from '../lib/regulated.js';
import { Link, focusPageHeading, scrollToTop } from '../lib/router.js';
import { DELIVERY_LABELS, buildReceipt } from '../lib/receipt.js';
import { announce } from '../lib/announce.js';
import { LINE_CONTROL, focusLineSoon, neighbourKey } from '../lib/focus.js';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { CartLine } from '../components/CartLine.jsx';
import { CartSummary } from '../components/CartSummary.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { SavedLinesNotice, UnavailableNotice } from '../components/CartNotices.jsx';
import { AccountLoading } from '../components/AccountStatus.jsx';
import { Field, ValidatedForm } from '../components/Field.jsx';
import { accountShipToSource, applyShipTo, clearShipTo, initialQuoteForm, phoneDigitsOk, quoteFormForAccount } from '../lib/quoteForm.js';
import { readQuoteDraft, useQuoteDraft } from '../lib/quoteDraft.js';
import { DELIVERY_ROUTE_STATES, DELIVERY_STATE_NOTE } from '../data/quoteRules.js';
import { stateName } from '../data/usStates.js';
import { QuoteReceipt } from './QuoteReceipt.jsx';

const UNAVAILABLE_ERROR = 'Remove the items that are no longer available before you submit.';
const UNAVAILABLE_ONE_ERROR = 'Remove the item that is no longer available before you submit.';
const VARIANT_ERROR = 'Choose a variant for every product that has more than one.';
// What takes focus on a line put back by Undo (AW-082): its quantity, else
// its variant select or "Choose variant" link, else its ×. Never the
// thumbnail's link, which is out of the tab order.
const RESTORED_LINE_CONTROL = 'input, select, a.choose, .drawer-remove';
// Never shown for a cart read from storage, which is repaired on read; a
// guard in case a quantity the database would refuse gets through (AW-013).
const QTY_ERROR = `Quantities must be ${QTY_RANGE_TEXT}.`;
// The ship-to State offers the delivery route states only, by name (AW-078);
// the value is the 2-letter code submit_quote takes.
const ROUTE_STATE_OPTIONS = DELIVERY_ROUTE_STATES.map((code) => ({ code, name: stateName(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name));
// The catalog or the prices couldn't be loaded again before a submit
// (AW-191): nothing is sent against the copy on screen.
const CHECK_FAILED = {
  before: 'We couldn’t check the latest prices and availability, so nothing was sent. Check your connection and try again, or call the trade desk at',
  after: '.',
};
// Only the buyer's prices failed to load again, and the browser is online:
// the connection is not the problem (NEW-010).
const PRICES_CHECK_FAILED = {
  before: 'Your prices didn’t load, so nothing was sent. Try again, or call the trade desk at',
  after: '.',
};
const PHONE_EXAMPLE = '(205) 555-0123';
const PHONE_ERROR = 'Enter a 10-digit phone number.';

// Identifies what the buyer is looking at: which lines, how many, whether
// each can be ordered and at what price.
const itemsSignature = (items) => items.map((it) => `${it.lineKey}|${it.qty}|${it.unavailable || ''}|${it.needsVariant ? 1 : 0}|${it.price ?? ''}`).join(',');

export function QuotePage({
  items, total, setLine, chooseVariant, removeLine, removeLines, clearCart, restoreLines, owner = null, legacy = [], onDismissLegacy,
  profile, account = profile ? 'ready' : 'signed-out', signedIn = !!profile, onSignIn, onApplyClick, isApprovedBuyer, isBackendConfigured,
  checkCart = null, pricesStatus = 'ready', onRetryPrices = null, pricesRefreshing = false, isSuspended = false,
  savedReceipt = null, entryKey = null, onSubmitted, loadShipTo = null, cartSynced = false,
}) {
  // A quote, or an order for an approved buyer (AW-132, src/data/terms.js).
  const basket = basketTerms(isApprovedBuyer);
  // What was typed here before survives leaving the page and a reload: this
  // owner's draft, then the profile in the fields still empty (AW-080).
  const [data, setData] = useState(() => initialQuoteForm(profile, readQuoteDraft(owner)));
  const draft = useQuoteDraft(owner, data);
  // The field the last refused submit was about (its hint), marked invalid
  // until it is edited.
  const [errorField, setErrorField] = useState(null);
  const set = k => e => {
    draft.edited();
    setData({ ...data, [k]: e.target.value });
    if (k === errorField) setErrorField(null);
  };
  const setChecked = k => e => {
    draft.edited();
    setData({ ...data, [k]: e.target.checked });
  };
  // aria-describedby: the field's own hint, and the submit error when it is
  // about this field.
  const fieldProps = (k, hintId = null) => {
    const ids = [hintId, errorField === k ? 'quote-submit-error' : null].filter(Boolean).join(' ');
    return { 'aria-invalid': errorField === k ? true : undefined, 'aria-describedby': ids || undefined };
  };

  // The last "Clear all items" (AW-082): { snapshot, n, owner }, the lines it
  // removed, how many units, and whose cart they were in.
  const [cleared, setCleared] = useState(null);

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
    // The receipt on screen was the last account's, and so were the lines an
    // Undo would bring back.
    setReceipt(null);
    setCleared(null);
  }

  // The account's last delivery address (AW-102), once per account. It goes
  // into the ship-to fields once, when it arrives, and only where nothing was
  // typed (applyShipTo). Any failure leaves the form as it is.
  const [savedShipTo, setSavedShipTo] = useState(null); // { for, value }
  useEffect(() => {
    if (!profileId || !loadShipTo) return undefined;
    const controller = new AbortController();
    let live = true;
    loadShipTo(profileId, { signal: controller.signal }).then((value) => {
      if (live && value) setSavedShipTo({ for: profileId, value });
    }, () => {});
    return () => {
      live = false;
      controller.abort();
    };
  }, [profileId, loadShipTo]);
  const shipTo = savedShipTo?.for === profileId ? savedShipTo.value : null;
  const [shipToApplied, setShipToApplied] = useState(null);
  if (shipTo && shipToApplied !== savedShipTo) {
    setShipToApplied(savedShipTo);
    setData((current) => applyShipTo(current, profile, shipTo));
  }
  // "Use a different address": while the fields hold the account's own
  // address, the buyer can empty them in one go; Street takes focus.
  const streetRef = useRef(null);
  const shipFrom = profile ? accountShipToSource(data, profile, shipTo) : null;
  const chooseOtherAddress = () => {
    setData((current) => clearShipTo(current));
    if (errorField && errorField.startsWith('ship')) setErrorField(null);
    streetRef.current?.focus();
  };

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
    const n = items.reduce((sum, it) => sum + it.qty, 0);
    focusHeadingNext.current = true;
    const snapshot = clearCart();
    // Undo needs the lines, and a way to put them back.
    setCleared(snapshot && Object.keys(snapshot).length && restoreLines ? { snapshot, n, owner } : null);
    announce(`Removed all items from your ${basket.noun}.`);
  };
  // Lines back in the cart another way (added here or in another tab): the
  // Undo offer goes. It is only ever for the owner whose lines it holds.
  if (cleared && items.length > 0) setCleared(null);
  const undo = cleared && cleared.owner === owner ? cleared : null;
  // After an Undo, focus goes to the first restored line's quantity once the
  // list is back on the page.
  const focusRestoredNext = useRef(null);
  useEffect(() => {
    const keys = focusRestoredNext.current;
    if (!keys || !items.length) return;
    focusRestoredNext.current = null;
    const first = items.find((it) => keys.includes(it.lineKey)) || items[0];
    focusLineSoon(linesRef.current, first.lineKey, { selector: RESTORED_LINE_CONTROL, fallback: focusPageHeading });
  }, [items]);
  const undoClear = () => {
    if (!undo) return;
    focusRestoredNext.current = Object.keys(undo.snapshot);
    setCleared(null);
    restoreLines(undo.snapshot);
    announce(`Restored ${undo.n.toLocaleString('en-US')} ${undo.n === 1 ? 'item' : 'items'}.`);
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
  // Lines left out of the estimate (AW-103, NEW-063): waiting for a variant,
  // or priced by the trade desk.
  const excluded = isApprovedBuyer ? variantExcludedText(items, pricesStatus) : '';
  const invalidQty = orderable.some(it => !isOrderableQty(it.qty));
  const willCall = data.delivery === 'willcall';
  // The tobacco license answers (AW-014): asked of a visitor who isn't an
  // approved buyer when a line needs them (not of a suspended account, which
  // can't submit).
  const needsLicense = !isApprovedBuyer && !isSuspended && cartNeedsTobaccoLicense(orderable);
  const minDate = todayInBirmingham();
  // The approved buyer's meter asks for the rest of the minimum (AW-283): only
  // when every line has a price (meterReady, as CartSummary decides; not
  // while prices load or after they failed, nor with a price-on-request line,
  // NEW-010), measured in cents like the meter.
  const pricedBelowMinimum = isApprovedBuyer && meterReady(items, pricesStatus) && deliveryProgress(total).stage === 'minimum';
  const online = useOnlineStatus();
  // What keeps the submit button off (apart from a send in progress). The
  // meter says "you can still submit" only when nothing does (AW-076).
  const submitBlocked = isSuspended || !isBackendConfigured || needsVariant || unavailable.length > 0 || invalidQty || lostOrdering || !online;
  // Why the submit button is off, said under it as plain text it is
  // described by (NEW-021): these show from the start, before the buyer has
  // done anything, so they aren't alerts. The catalog-change message and a
  // refused send, which follow a submit, stay alerts; while the change
  // message names the lines that are no longer available, the line saying
  // so in general is left out.
  const blockedNotes = [
    needsVariant && { id: 'quote-blocked-variant', text: VARIANT_ERROR },
    unavailable.length > 0 && !changeText && {
      id: 'quote-blocked-unavailable', text: unavailable.length === 1 ? UNAVAILABLE_ONE_ERROR : UNAVAILABLE_ERROR,
    },
    invalidQty && { id: 'quote-blocked-qty', text: QTY_ERROR },
  ].filter(Boolean);
  // "Load prices again" (NEW-010): App's retry, which says so when they fail
  // again. Once they are in, the button goes, and focus moves to the total
  // they make instead of falling to <body>.
  const focusTotalNext = useRef(false);
  const reloadPrices = () => {
    if (pricesRefreshing || !onRetryPrices) return;
    focusTotalNext.current = true;
    onRetryPrices();
  };
  useEffect(() => {
    if (!focusTotalNext.current || pricesRefreshing) return;
    focusTotalNext.current = false;
    if (pricesStatus === 'error') return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    document.getElementById('checkout-total')?.focus();
  }, [pricesStatus, pricesRefreshing]);
  let submitLabel = basket.submit;
  if (phase === 'checking') submitLabel = 'Checking the catalog…';
  else if (phase === 'sending') submitLabel = 'Sending…';

  // A send in progress (AW-012). The button is disabled while one runs, but a
  // fast second Enter or click can arrive before that render.
  const submittingRef = useRef(false);
  // Where focus goes once a submit that didn't save is over (NEW-009). The
  // locked fieldsets and button drop focus to <body> while the catalog is
  // checked and the request is sent, so the buyer would start again at the
  // top of the page. Once the form is unlocked: the field the refusal is
  // about, else the message that says what happened. Only when focus was in
  // the form (or on <body>) when the submit began, and hasn't been moved
  // elsewhere since.
  const focusAfterSubmit = useRef(null); // { form, target: 'error' | 'change' }
  const [focusRequest, setFocusRequest] = useState(0);
  const focusWhenDone = (form, target) => {
    if (!form) return;
    focusAfterSubmit.current = { form, target };
    setFocusRequest((n) => n + 1);
  };
  useEffect(() => {
    const pending = focusAfterSubmit.current;
    if (!pending || phase !== null) return;
    focusAfterSubmit.current = null;
    const { form, target } = pending;
    const active = document.activeElement;
    if (active && active !== document.body && !form.contains(active)) return;
    const field = target === 'error' && errorField ? form.elements.namedItem(errorField) : null;
    const el = (field && typeof field.focus === 'function' && !field.disabled ? field : null)
      || document.getElementById(target === 'change' ? 'quote-change-note' : 'quote-submit-error');
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'center' });
  }, [focusRequest, phase, errorField]);
  // The form's own check (ValidatedForm, AW-173): the pattern lets through a
  // number with too few or too many digits (AW-078), so the digits are
  // counted too, and said under the field before anything is checked or
  // sent. An empty phone gets the field's own 'Enter phone'.
  const validateQuote = () => (data.phone.trim() && !phoneDigitsOk(data.phone) ? { 'quote-phone': PHONE_ERROR } : {});

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
      setSubmitError(VARIANT_ERROR);
      return;
    }
    if (unavailable.length) {
      setSubmitError(unavailable.length === 1 ? UNAVAILABLE_ONE_ERROR : UNAVAILABLE_ERROR);
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
    // Focus comes back to the form after a submit that didn't save
    // (NEW-009), unless the buyer was elsewhere when it began.
    const form = e.currentTarget;
    const active = document.activeElement;
    const returnFocusTo = !active || active === document.body || form.contains(active) ? form : null;
    // What is sent, and what the receipt shows: edits made while it is on
    // its way change neither.
    const sent = data;
    setPhase('checking');
    setSubmitError(null);
    setErrorField(null);
    setChangeNote(null);
    let saved = null;
    let lines = orderable;
    try {
      if (checkCart) {
        const check = await checkCart();
        if (!check?.ok) {
          if (isOffline()) setSubmitError(QUOTE_OFFLINE);
          else setSubmitError(check?.part === 'prices' ? PRICES_CHECK_FAILED : CHECK_FAILED);
          focusWhenDone(returnFocusTo, 'error');
          return;
        }
        const changes = cartChanges(items, check.items);
        if (changes.length) {
          setChangeNote({ text: describeCartChanges(changes, basket.noun), forItems: itemsSignature(check.items) });
          focusWhenDone(returnFocusTo, 'change');
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
      setSubmitError(quoteErrorMessage(err, { items: lines }));
      setErrorField(quoteErrorField(err));
      focusWhenDone(returnFocusTo, 'error');
    } finally {
      submittingRef.current = false;
      setPhase(null);
    }
    if (!saved) return;
    // Saved: the draft has done its job (AW-080). Show the receipt and let
    // App keep it for this history entry.
    draft.submitted();
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
        {/* The shared empty state (AW-299), in the basket's words (AW-132);
            its h1 takes focus when the last line goes, and the undo offer
            after "Clear all items" is the next stop (AW-082). */}
        <EmptyState
          level={1} title={basket.empty} actions={<Link className="button" to="/catalog">Browse the catalog</Link>}
          notice={undo && (
            <p className="notice cart-cleared">
              <span id="cart-cleared-text">{`Removed ${undo.n.toLocaleString('en-US')} ${undo.n === 1 ? 'item' : 'items'}.`}</span>
              {' '}
              <button className="text-link" type="button" onClick={undoClear} aria-describedby="cart-cleared-text">Undo</button>
            </p>
          )}
        >
          {`Add products, then come back to review your ${basket.noun}.`}
        </EmptyState>
        {/* Why items added on a phone aren't here on a computer (AW-334). */}
        <p className="fine cart-device-note">{cartDeviceNote(signedIn, cartSynced)}</p>
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
        <Breadcrumbs items={[HOME_CRUMB, { label: basket.page }]} />
        <p className="eyebrow">{isApprovedBuyer ? 'CHECKOUT' : 'QUOTE REQUEST'}</p>
        <h1>{basket.page}</h1>
        {/* A suspended account can't order (AW-201, NEW-064): that, and a way
            to reach the trade desk, instead of "Review your items and submit". */}
        {isSuspended ? (
          <p className="notice quote-paused"><span>{PRICE_LOCK.suspended.line}</span> <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
        ) : (
          <p>{pricedBelowMinimum
            ? 'Review your items and submit. A trade desk rep will confirm pricing, availability and delivery within one business day.'
            : `Review your items and submit. The minimum order is ${formatMoneyShort(ORDER_MINIMUM)}. A trade desk rep will confirm pricing, availability and delivery within one business day.`}</p>
        )}
      </div>
      <div className="checkout-grid">
        <div>
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} noun={basket.noun} />
          {/* Locked while a send runs (AW-194): no −/+/×, variant or Clear. */}
          <fieldset className="checkout-fieldset" disabled={sending}>
          <ul className="checkout-lines" aria-label="Items in this request" ref={linesRef}>
            {items.map(it => (
              <CartLine key={it.lineKey} item={it} layout="checkout" showPrice={isApprovedBuyer} pricesStatus={pricesStatus}
                        onSetQty={(n) => setLine(it.lineKey, n)} onChooseVariant={chooseVariant}
                        onRemove={() => removeItem(it)} />
            ))}
          </ul>
          <div className="checkout-list-foot">
            <p className="cart-counts">{countsLabel(cartCounts(items))}</p>
            <button className="text-link checkout-clear" type="button" onClick={clearAll}>Clear all items</button>
          </div>
          <p className="fine cart-device-note">{cartDeviceNote(signedIn, cartSynced)}</p>
          </fieldset>
        </div>
        {/* Checked before it is sent (AW-173): each problem shows under its
            field, and the first takes focus (src/components/Field.jsx). */}
        <ValidatedForm onSubmit={handleQuoteSubmit} validate={validateQuote} aria-labelledby="quote-form-title">
          <h2 id="quote-form-title" className="checkout-form-title">Your details</h2>
          {/* Guests can sign in, or apply, before filling this in (AW-014). */}
          {!signedIn && (
            <p className="fine quote-account-links">
              {onSignIn && <button className="text-link" type="button" onClick={onSignIn}>{SIGN_IN_INSTEAD}</button>}
              <span aria-hidden="true"> · </span>
              {onApplyClick
                ? <button className="text-link" type="button" onClick={onApplyClick}>{APPLY_INSTEAD}</button>
                : <Link className="text-link" to="/apply">{APPLY_INSTEAD}</Link>}
            </p>
          )}
          {/* Honeypot (AW-198): out of sight and out of the tab order; people
              leave it empty. */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="quote-company-website">Company website</label>
            <input id="quote-company-website" name="company_website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          {/* Locked while a send runs (AW-194), and for a suspended account,
              which can't submit (NEW-064): the fields show, read-only. */}
          <fieldset className="checkout-fieldset" disabled={sending || isSuspended}>
          {!isSuspended && <p className="form-note">All fields are required unless marked optional.</p>}
          <div className="form-grid checkout-form-grid">
            <Field id="quote-business" label="Business name">
              <input id="quote-business" name="business" value={data.business} onChange={set('business')} required maxLength={200} autoComplete="organization" {...fieldProps('business')} />
            </Field>
            <Field id="quote-contact" label="Contact name">
              <input id="quote-contact" name="contact" value={data.contact} onChange={set('contact')} required maxLength={120} autoComplete="name" {...fieldProps('contact')} />
            </Field>
            <Field id="quote-email" label="Email">
              <input id="quote-email" name="email" type="email" value={data.email} onChange={set('email')} required maxLength={254} autoComplete="email" inputMode="email" {...fieldProps('email')} />
            </Field>
            {/* Ten digits (AW-078): the pattern takes the usual characters, and
                validateQuote counts the digits. */}
            <Field id="quote-phone" label="Phone" hint={`10 digits, for example ${PHONE_EXAMPLE}`}>
              <input id="quote-phone" name="phone" type="tel" value={data.phone} onChange={set('phone')} required maxLength={40} pattern={String.raw`[0-9\(\)+.\-\s]{10,20}`} title={`Enter a 10-digit phone number, for example ${PHONE_EXAMPLE}`} autoComplete="tel" inputMode="tel" {...fieldProps('phone')} />
            </Field>
            {/* TODO(owner): Confirm guest tobacco and vape quotes may collect a license number, resale certificate, and 21+ attestation instead of requiring an approved sign-in. (AW-014) */}
            {needsLicense && (
              <>
                <p className="full result-note" id="quote-license-note">Your quote has tobacco or vape items. Tobacco products are supplied to licensed retailers only — 21+.</p>
                <Field id="quote-license" label="State tobacco/retail license #" full>
                  <input id="quote-license" name="licenseNo" value={data.licenseNo} onChange={set('licenseNo')} required maxLength={64} autoComplete="off" {...fieldProps('licenseNo', 'quote-license-note')} />
                </Field>
                <Field id="quote-resale" label="Sales-tax / resale certificate #" full>
                  <input id="quote-resale" name="resaleCert" value={data.resaleCert} onChange={set('resaleCert')} required maxLength={64} autoComplete="off" {...fieldProps('resaleCert', 'quote-license-note')} />
                </Field>
                <Field id="quote-age" label="I confirm this business holds a valid tobacco retail license and all purchasers are 21+" full inline>
                  <input id="quote-age" name="purchasers21" type="checkbox" checked={data.purchasers21} onChange={setChecked('purchasers21')} required />
                </Field>
              </>
            )}
            {/* Delivery method first: will-call needs no address (AW-079). */}
            <Field id="quote-delivery" label="Delivery method" full>
              <select id="quote-delivery" name="delivery" value={data.delivery} onChange={set('delivery')} aria-describedby={willCall ? 'quote-pickup' : undefined}>
                <option value="delivery">{DELIVERY_LABELS.delivery}</option>
                <option value="willcall">{DELIVERY_LABELS.willcall}</option>
              </select>
            </Field>
            {willCall ? (
              <p className="full result-note" id="quote-pickup">{`Pickup at ${COMPANY.addressShort} during business hours.`}</p>
            ) : (
              <>
                {shipFrom && (
                  <div className="full ship-from">
                    <span>{shipFrom === 'saved' ? 'Your last delivery address.' : 'Your store address.'}</span>
                    <button className="text-link" type="button" onClick={chooseOtherAddress}>Use a different address</button>
                  </div>
                )}
                <Field id="ship-street" label="Street" full>
                  <input id="ship-street" ref={streetRef} name="shipStreet" value={data.shipStreet} onChange={set('shipStreet')} required maxLength={200} autoComplete="street-address" {...fieldProps('shipStreet')} />
                </Field>
                <Field id="ship-city" label="City">
                  <input id="ship-city" name="shipCity" value={data.shipCity} onChange={set('shipCity')} required maxLength={100} autoComplete="address-level2" {...fieldProps('shipCity')} />
                </Field>
                {/* State and ZIP share a row on phones (AW-241). */}
                <Field id="ship-state" label="State" hint={DELIVERY_STATE_NOTE} className="half">
                  <select id="ship-state" name="shipState" value={data.shipState} onChange={set('shipState')} required autoComplete="address-level1" {...fieldProps('shipState')}>
                    <option value="" disabled>Choose a state…</option>
                    {ROUTE_STATE_OPTIONS.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </Field>
                <Field id="ship-zip" label="ZIP" className="half">
                  <input id="ship-zip" name="shipZip" value={data.shipZip} onChange={set('shipZip')} required maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" title="A 5-digit ZIP code, or ZIP+4" autoComplete="postal-code" inputMode="numeric" {...fieldProps('shipZip')} />
                </Field>
              </>
            )}
            {/* TODO(owner): Which days do the routes run, and what is the cutoff for next-day delivery, so the date picker can rule out other days? (AW-078, see AW-130) */}
            <Field id="quote-date" label="Preferred date" optional hint="Optional. Leave it blank if any day works.">
              <input id="quote-date" name="preferredDate" type="date" className={data.preferredDate ? undefined : 'is-empty'} value={data.preferredDate} onChange={set('preferredDate')} min={minDate} autoComplete="off" {...fieldProps('preferredDate')} />
            </Field>
            <Field id="quote-notes" label="Notes" full optional>
              <textarea id="quote-notes" name="notes" rows={4} value={data.notes} onChange={set('notes')} maxLength={2000} placeholder="Dock hours, pallet needs, substitutions…" autoComplete="off" />
            </Field>
          </div>
          </fieldset>
          {/* Lines still waiting for a variant, or priced by the trade desk, are not in the estimate (AW-103, NEW-063). */}
          <div className="drawer-total checkout-total" id="checkout-total" tabIndex={-1}>
            <span>{`Estimated subtotal · ${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}</span>
            <span>{isApprovedBuyer ? totalLabel(items, total, pricesStatus) : (isSuspended ? 'Ordering paused' : (signedIn ? 'Pricing after approval' : 'Pricing confirmed by the trade desk'))}</span>
          </div>
          {excluded && <p className="total-note">{excluded}</p>}
          {/* The buyer's prices didn't load (NEW-010): load them again here,
              beside the total they make. It stays enabled while they load,
              so it keeps focus; the total takes it once they are in. */}
          {isApprovedBuyer && pricesStatus === 'error' && onRetryPrices && (
            <div className="total-note prices-retry">
              <button className="text-link" type="button" onClick={reloadPrices} aria-disabled={pricesRefreshing || undefined}>
                {pricesRefreshing ? 'Loading prices…' : 'Load prices again'}
              </button>
            </div>
          )}
          {/* The approved buyer's way to the minimum and free delivery (AW-238),
              with "You can still submit this order." below the minimum while
              the button can be used (AW-076, NEW-059). Guests and pending
              accounts already read who confirms pricing in the row above; the
              counts are under the list. */}
          {isApprovedBuyer && (
            <CartSummary items={items} total={total} isApprovedBuyer isSuspended={isSuspended} pricesStatus={pricesStatus} showCounts={false}
                         canSubmitBelowMinimum={!submitBlocked} />
          )}
          {!isBackendConfigured && <p className="form-error" role="status"><CallOrEmail before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {blockedNotes.map((note) => <p key={note.id} className="form-error" id={note.id}>{note.text}</p>)}
          {/* Both take focus after a submit that didn't save (NEW-009). */}
          {changeText && <p className="form-error" id="quote-change-note" role="alert" tabIndex={-1}>{changeText}</p>}
          {submitError && <p className="form-error" id="quote-submit-error" role="alert" tabIndex={-1}>{typeof submitError === 'string' ? submitError : <CallOrEmail before={submitError.before} after={submitError.after} />}</p>}
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
          {/* A suspended account can't order (AW-201): no submit; the page
              head says so, with a way to reach the trade desk (NEW-064). */}
          {!isSuspended && (
          <button className="button wide" type="submit" disabled={sending || submitBlocked}
                  aria-describedby={blockedNotes.length ? blockedNotes.map((note) => note.id).join(' ') : undefined}>
            <span>{submitLabel}</span></button>
          )}
          {/* The site notice reads "You’re offline" out; this says why the button is off. */}
          {!online && <p className="result-note quote-offline">You’re offline. Reconnect to submit.</p>}
          <p className="fine">{`Orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} qualify for free delivery on a delivery route in AL, MS & GA. Will-call is pickup at the Birmingham warehouse during business hours. Tobacco products supplied to licensed retailers only — 21+.`}</p>
        </ValidatedForm>
      </div>
    </section>
  );
}
