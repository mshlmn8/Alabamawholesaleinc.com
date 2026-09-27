// Delivery & service area: own-truck routes in Alabama, Mississippi and
// Georgia, will-call at the Birmingham warehouse, and a state-level check that
// always points the customer to the trade desk to confirm their stop.

import React, { useState } from 'react';
import { COMPANY, FREE_DELIVERY_THRESHOLD } from '../../data/content.js';
import { DELIVERY_STATES, OTHER_STATES } from '../../data/onboarding.js';
import { PageHead, ContactStrip, PhoneLink } from './SupportShell.jsx';

const ROUTE_STATE_NAMES = DELIVERY_STATES.map(s => s.name);
const routeStates = `${ROUTE_STATE_NAMES.slice(0, -1).join(', ')} and ${ROUTE_STATE_NAMES[ROUTE_STATE_NAMES.length - 1]}`;
const money = (n) => `$${Number(n).toLocaleString('en-US')}`;

export function DeliveryPage({ goHome, navigate }) {
  const [stateCode, setStateCode] = useState('');
  const routeState = DELIVERY_STATES.find(s => s.code === stateCode);
  const otherState = OTHER_STATES.find(s => s.code === stateCode);

  return (
    <section className="support-page">
      <PageHead goHome={goHome} crumb="Delivery & service area" eyebrow="OUR OWN TRUCKS" title="Delivery & service area">
        <p>We run our own delivery routes across {routeStates} from the Birmingham warehouse. When your store is on a route, your order rides on our truck and arrives the next day.</p>
      </PageHead>

      <div className="info-grid">
        <article className="info-card">
          <p className="eyebrow">01 · ROUTE DELIVERY</p>
          <h2>Next day, on our trucks</h2>
          <p>Next-day delivery on our own trucks when your stop is on a delivery route. Free delivery on orders over {money(FREE_DELIVERY_THRESHOLD)} when the stop is on a route.</p>
        </article>
        <article className="info-card">
          <p className="eyebrow">02 · WILL-CALL</p>
          <h2>Pick up in Birmingham</h2>
          <p>Order ahead and collect at {COMPANY.addressLine1}, {COMPANY.addressLine2}. {COMPANY.hoursLine1}, {COMPANY.hoursLine2}.</p>
          <button className="text-link" type="button" onClick={() => navigate({ page: 'contact' })}>Contact &amp; visit</button>
        </article>
        <article className="info-card">
          <p className="eyebrow">03 · NOT ON A ROUTE?</p>
          <h2>Call the trade desk</h2>
          <p>Routes don’t reach every address. A trade rep can tell you whether a route passes your store and what your options are.</p>
          <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
        </article>
      </div>

      <section className="eligibility" aria-labelledby="eligibility-title">
        <div>
          <p className="eyebrow">SERVICE AREA CHECK</p>
          <h2 id="eligibility-title">Is my store in the service area?</h2>
          <p>Our routes are planned stop by stop, so this check only confirms the states we drive in. Call to confirm your stop before you count on next-day delivery.</p>
        </div>
        <form className="eligibility-form" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="delivery-state">State your store is in</label>
          <select id="delivery-state" value={stateCode} onChange={(e) => setStateCode(e.target.value)} autoComplete="address-level1">
            <option value="">Choose a state…</option>
            <optgroup label="Delivery routes">
              {DELIVERY_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Other">
              {OTHER_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </optgroup>
          </select>
          <div className="eligibility-result" role="status" aria-live="polite">
            {routeState && (
              <>
                <b>We run delivery routes in {routeState.name}.</b>
                <span>Routes don’t reach every address. Call <PhoneLink /> to confirm your stop and delivery day before you count on next-day delivery.</span>
              </>
            )}
            {otherState && (
              <>
                <b>Our delivery routes run in {routeStates}.</b>
                <span>Call <PhoneLink /> to talk about options for a store in {otherState.code === 'XX' ? 'your state' : otherState.name}, including will-call pickup in Birmingham.</span>
              </>
            )}
          </div>
        </form>
      </section>

      <div className="support-columns">
        <section className="support-block" aria-labelledby="how-title">
          <p className="eyebrow">HOW ROUTE DELIVERY WORKS</p>
          <h2 id="how-title">From order to your back door</h2>
          <ol className="next-steps">
            <li><b>Place your order.</b><span>Online with your trade account, or by phone with the trade desk.</span></li>
            <li><b>We confirm the details.</b><span>The trade desk confirms your route, timing and anything specific to your delivery — dock hours, pallets, substitutions.</span></li>
            <li><b>Our driver delivers.</b><span>Count the cases and check for damage while the driver is there. Anything short or damaged, see Returns &amp; damaged goods.</span></li>
          </ol>
        </section>
        <section className="support-block" aria-labelledby="states-title">
          <p className="eyebrow">WHERE WE DRIVE</p>
          <h2 id="states-title">Route states</h2>
          <ul className="state-list">
            {DELIVERY_STATES.map(s => <li key={s.code}><b>{s.code}</b><span>{s.name}</span></li>)}
          </ul>
          <p className="support-note">Tobacco and vapor products are delivered to the licensed retail business on the account only.</p>
          <div className="dialog-actions compact-actions">
            <button className="text-link" type="button" onClick={() => navigate({ page: 'shipping' })}>Shipping &amp; delivery policy</button>
            <button className="text-link" type="button" onClick={() => navigate({ page: 'returns' })}>Returns &amp; damaged goods</button>
          </div>
        </section>
      </div>

      <ContactStrip navigate={navigate} eyebrow="CONFIRM YOUR STOP" title="Ask about your route" />
    </section>
  );
}
