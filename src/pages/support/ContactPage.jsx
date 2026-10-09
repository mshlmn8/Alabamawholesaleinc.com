// Contact & visit: click-to-call, email, warehouse address with directions,
// hours, and will-call pickup. Facts come from COMPANY and HOURS in
// data/content.js.
//
// TODO(owner): Do you want an on-site contact form? Messages would be stored in Supabase and read in Admin, and the privacy policy would list them. (AW-280)

import { useEffect, useState } from 'react';
import { COMPANY, HOURS, TIME_ZONE_LABEL, TIME_ZONE_NAME, hoursRange, openStatusNow } from '../../data/content.js';
import { APPLY_LABEL } from '../../data/terms.js';
import { Link } from '../../lib/router.js';
import { Icon } from '../../components/Icon.jsx';
import { EmailText } from '../../components/ContactLinks.jsx';
import { showToast } from '../../lib/toast.js';
import { PageHead, SupportLayout, DIRECTIONS_URL } from './SupportShell.jsx';

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

// Copies the email address for webmail users, whom a mailto: link sends to a
// mail app they may not use (AW-280). Shown only where the browser can write
// to the clipboard. The toast speaks the result once through the shared live
// region; the label says 'Copied' for a moment.
export const COPIED_MS = 2000;
export const EMAIL_COPIED = 'Email address copied.';
export const EMAIL_COPY_FAILED = 'Couldn’t copy. Select the address and copy it.';
function CopyEmailButton() {
  const [canCopy] = useState(() => typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function');
  // Counts copies, so a second copy restarts the 'Copied' time.
  const [copies, setCopies] = useState(0);
  useEffect(() => {
    if (!copies) return undefined;
    const timer = window.setTimeout(() => setCopies(0), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copies]);
  if (!canCopy) return null;
  const copy = () => {
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(COMPANY.email))
      .then(() => {
        setCopies((n) => n + 1);
        showToast({ text: EMAIL_COPIED });
      }, () => {
        setCopies(0);
        showToast({ text: EMAIL_COPY_FAILED });
      });
  };
  return (
    <button type="button" className="text-link info-copy" onClick={copy}>
      <span>{copies ? 'Copied' : 'Copy email address'}</span>
    </button>
  );
}

export function ContactPage({ onApplyClick }) {
  return (
    <section className="support-page">
      <PageHead crumb="Contact & visit" eyebrow="TALK TO THE WAREHOUSE" title="Contact & visit">
        <p>Real people, same building as the inventory. Call the trade desk, email us, or come by the Birmingham warehouse for will-call pickup.</p>
      </PageHead>
      <SupportLayout current="contact">

      <div className="info-grid">
        <article className="info-card">
          <h2 className="eyebrow">Call</h2>
          <a className="info-lead" href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a>
          <p>Trade desk, orders, will-call and account questions. Tap the number to call from your phone.</p>
          <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call now</a>
        </article>
        <article className="info-card">
          <h2 className="eyebrow">Email</h2>
          <a className="info-lead info-lead-small" href={`mailto:${COMPANY.email}`}><EmailText /></a>
          <CopyEmailButton />
          <p>Applications, quotes, invoices and anything you would rather put in writing. Include your business name and phone number.</p>
          <a className="button ghost" href={`mailto:${COMPANY.email}`}>Email the trade desk</a>
        </article>
        <article className="info-card">
          <h2 className="eyebrow">Visit</h2>
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
          {/* The form itself, as on /apply; the checklist is the secondary step (AW-271). */}
          <button className="button" type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
          <Link className="button ghost" to="/apply">Application checklist</Link>
        </div>
      </section>
      </SupportLayout>
    </section>
  );
}
