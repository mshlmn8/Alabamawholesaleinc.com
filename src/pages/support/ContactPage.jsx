// Contact & visit: click-to-call, email, warehouse address with directions,
// hours, and will-call pickup. Facts come from COMPANY and HOURS in
// data/content.js.

import { useEffect, useState } from 'react';
import { COMPANY, HOURS, TIME_ZONE_LABEL, TIME_ZONE_NAME, hoursRange, openStatusNow } from '../../data/content.js';
import { Link } from '../../lib/router.js';
import { Icon } from '../../components/Icon.jsx';
import { PageHead, DIRECTIONS_URL } from './SupportShell.jsx';

// 'Open now · closes 6:00 PM CT' or 'Closed · opens 8:00 AM CT' (AW-275),
// filled in after mount and kept current each minute. Until then the line
// holds a no-break space, so the text arriving moves nothing below it.
const OPEN_STATUS_REFRESH_MS = 60 * 1000;
function OpenStatus() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => setLabel(openStatusNow());
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, OPEN_STATUS_REFRESH_MS);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  return <p className="support-note">{label || '\u00A0'}</p>;
}

export function ContactPage({ onApplyClick }) {
  return (
    <section className="support-page">
      <PageHead crumb="Contact & visit" eyebrow="TALK TO THE WAREHOUSE" title="Contact & visit">
        <p>Real people, same building as the inventory. Call the trade desk, email us, or come by the Birmingham warehouse for will-call pickup.</p>
      </PageHead>

      <div className="info-grid">
        <article className="info-card">
          <p className="eyebrow">CALL</p>
          <a className="info-lead" href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a>
          <p>Trade desk, orders, will-call and account questions. Tap the number to call from your phone.</p>
          <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call now</a>
        </article>
        <article className="info-card">
          <p className="eyebrow">EMAIL</p>
          <a className="info-lead info-lead-small" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <p>Applications, quotes, invoices and anything you would rather put in writing. Include your business name and phone number.</p>
          <a className="button ghost" href={`mailto:${COMPANY.email}`}>Email the trade desk</a>
        </article>
        <article className="info-card">
          <p className="eyebrow">VISIT</p>
          <address className="info-lead info-lead-small">{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</address>
          <p>Warehouse and will-call counter in Birmingham. Open the directions in your maps app for turn-by-turn navigation.</p>
          <a className="button ghost" href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">Get directions<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>
        </article>
      </div>

      <div className="support-columns">
        <section className="support-block" aria-labelledby="hours-title">
          <p className="eyebrow">HOURS</p>
          <h2 id="hours-title">When we’re open</h2>
          <dl className="hours-list">
            {HOURS.map(row => (
              <div key={row.days}><dt>{row.long}</dt><dd>{hoursRange(row)}</dd></div>
            ))}
          </dl>
          <p className="support-note">{`All times are ${TIME_ZONE_NAME} (${TIME_ZONE_LABEL}).`}</p>
          <OpenStatus />
          {/* TODO(owner): The warehouse's holiday closure dates, to print here instead of the general note. (AW-275) */}
          <p className="support-note">Holiday hours can differ — call ahead if you are making a special trip.</p>
        </section>

        <section className="support-block" aria-labelledby="willcall-title">
          <p className="eyebrow">WILL-CALL PICKUP</p>
          <h2 id="willcall-title">Pick up at the warehouse</h2>
          <p>Order ahead online or by phone, then collect your order at {COMPANY.addressLine1} during business hours. Have your order reference and business name ready at the counter.</p>
          <p>Prefer delivery? We run our own trucks on routes in Alabama, Mississippi and Georgia.</p>
          <div className="dialog-actions compact-actions">
            <Link className="text-link" to="/delivery">Delivery &amp; service area</Link>
            <Link className="text-link" to="/shipping">Delivery policy</Link>
          </div>
        </section>
      </div>

      <section className="support-cta">
        <div>
          <p className="eyebrow">NEW TO ALABAMA WHOLESALE?</p>
          <h2>Open a trade account</h2>
          <p>Licensed retail businesses only. See what you’ll need before you start.</p>
        </div>
        <div className="contact-strip-actions">
          <Link className="button" to="/apply">Application checklist</Link>
          <button className="button ghost" type="button" onClick={onApplyClick}>Start application</button>
        </div>
      </section>
    </section>
  );
}
