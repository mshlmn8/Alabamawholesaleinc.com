// Quote / checkout. Saved only by submit_quote, which prices the lines on
// the server.

import { useState } from 'react';
import { COMPANY, ORDER_MINIMUM } from '../data/content.js';
import { submitOrder } from '../lib/orders.js';
import { formatMoney } from '../lib/format.js';
import { CallOrEmail } from '../components/ContactLinks.jsx';
import { CartLine } from '../components/CartLine.jsx';

export function QuotePage({ items, total, addLine, decLine, removeLine, clearCart, goHome, goCatalog, goProduct, profile, isApprovedBuyer, isBackendConfigured }) {
  const [step, setStep] = useState('review');
  const [data, setData] = useState({
    business: profile?.business || '', contact: profile?.name || '', email: profile?.email || '', phone: '',
    notes: '', delivery: 'delivery', preferredDate: '',
    shipStreet: '', shipCity: '', shipState: '', shipZip: '',
  });
  const set = k => e => setData({ ...data, [k]: e.target.value });
  const [refNum] = useState(() => `ALW-Q-${Math.floor(Math.random() * 90000) + 10000}`);
  const [receipt, setReceipt] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const needsVariant = items.some(it => it.needsVariant);
  const pricedBelowMinimum = isApprovedBuyer && Number(total) < ORDER_MINIMUM;

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
    setSending(true);
    setSubmitError(null);
    try {
      const r = await submitOrder({ refNum, formData: data, items });
      if (!r?.ok || !r.order?.id) throw new Error('The quote was not saved.');
      setReceipt(r.order);
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      setSubmitError(err?.code === 'unavailable'
        ? { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' }
        : { before: 'We couldn’t save this quote. Please call', after: ` and reference ${refNum}.` });
    } finally { setSending(false); }
  };

  if (items.length === 0 && step === 'review') {
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <h1>Your cart is empty</h1>
        <p style={{ margin: '0 auto 20px' }}>Add products, then come back to checkout.</p>
        <button className="button" onClick={goCatalog}>Browse catalog <span aria-hidden="true">↗</span></button>
      </section>
    );
  }

  if (step === 'submitted') {
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="eyebrow">{isApprovedBuyer ? 'ORDER RECEIVED' : 'QUOTE RECEIVED'}</p>
        <h1>Thank you, {data.contact || 'partner'}.</h1>
        <p style={{ margin: '0 auto 14px' }}>
          {isApprovedBuyer ? 'Your order has been saved.' : 'Your quote request has been saved.'} A trade desk rep will reach out within one business day at <strong style={{ color: 'var(--purple)' }}>{data.phone || data.email}</strong> to confirm details.
        </p>
        <p className="result-note" style={{ fontSize: 13 }}>Reference number: <strong>{receipt?.ref_num || refNum}</strong></p>
        <div className="dialog-actions" style={{ justifyContent: 'center' }}>
          <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call to discuss</a>
          <button className="button" onClick={() => { clearCart(); goHome(); }}>Back to home <span aria-hidden="true">↗</span></button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div className="crumbs"><button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span><span>{isApprovedBuyer ? 'Checkout' : 'Request Quote'}</span></div>
        <p className="eyebrow">{isApprovedBuyer ? 'CHECKOUT' : 'QUOTE REQUEST'}</p>
        <h1>{isApprovedBuyer ? 'Place your order' : 'Request your quote'}</h1>
        <p>Review your items and submit. The minimum order is $500.00. A trade desk rep will confirm pricing, availability and delivery within one business day.</p>
      </div>
      <div className="checkout-grid">
        <div>
          <ul className="checkout-lines" aria-label="Items in this request">
            {items.map(it => (
              <CartLine key={it.lineKey} item={it} layout="checkout" showPrice={isApprovedBuyer}
                        onInc={() => addLine(it.productId, it.variant)} onDec={() => decLine(it.lineKey)}
                        onRemove={() => removeLine(it.lineKey)} onChoose={() => goProduct(it.productId)} />
            ))}
          </ul>
          <button className="text-link checkout-clear" type="button" onClick={clearCart}>Clear all items</button>
        </div>
        <form onSubmit={handleQuoteSubmit} aria-labelledby="quote-form-title">
          <h2 id="quote-form-title" className="checkout-form-title">Your details</h2>
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
          </div>
          <div className="drawer-total checkout-total">
            <span>{totalUnits} units</span>
            <span>{isApprovedBuyer ? formatMoney(total) : (profile ? 'Pricing after approval' : 'Pricing after sign-in')}</span>
          </div>
          {pricedBelowMinimum && <p className="notice" role="status">The order minimum is $500.00. You can still submit this order.</p>}
          {!isBackendConfigured && <p className="form-error" role="status"><CallOrEmail before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {needsVariant && <p className="form-error" role="alert">Choose a variant for every product that has more than one.</p>}
          {submitError && <p className="form-error" role="alert">{typeof submitError === 'string' ? submitError : <CallOrEmail before={submitError.before} after={submitError.after} />}</p>}
          <button className="button wide" type="submit" disabled={sending || !isBackendConfigured || needsVariant}>
            {sending ? 'Sending…' : (isApprovedBuyer ? 'Submit order' : 'Submit quote request')} <span aria-hidden="true">↗</span></button>
          <p className="fine">The minimum order is $500.00. Orders over $1,500 qualify for free delivery on a delivery route in AL, MS &amp; GA. Will-call is pickup at the Birmingham warehouse during business hours. Tobacco products supplied to licensed retailers only — 21+.</p>
        </form>
      </div>
    </section>
  );
}
