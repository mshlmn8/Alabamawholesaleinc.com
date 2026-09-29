// "Talk to the warehouse" dialog opened from the header's Help button.

import { COMPANY } from '../data/content.js';
import { ModalLayer } from './ModalLayer.jsx';
import { Icon } from './Icon.jsx';

export function HelpDialog({ onClose, onApply }) {
  return (
    <ModalLayer onClose={onClose}>
      {/* Backdrop click is a mouse shortcut; Escape (ModalLayer) and the Close button are the keyboard paths. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="overlay" onClick={onClose}>
        {/* Keeps clicks inside the dialog from reaching the backdrop. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
          <div className="dialog-top"><p className="eyebrow">ACCOUNT SERVICE</p><button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
          <p className="kicker">WE ANSWER FAST</p>
          <h2 id="help-title">Talk to the warehouse</h2>
          <p className="desc">Real people, same building as the inventory. Call, email or stop by will-call.</p>
          <dl className="contact-grid">
            <div><dt>Phone</dt><dd><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a></dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></dd></div>
            <div><dt>Hours</dt><dd>{COMPANY.hoursLine1} · {COMPANY.hoursLine2}</dd></div>
            <div><dt>Will-call</dt><dd>{COMPANY.addressShort}</dd></div>
          </dl>
          <div className="dialog-actions">
            <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call now</a>
            <button className="text-link" type="button" onClick={onApply}>Apply for an account</button>
          </div>
          <p className="fine">The minimum order is $500.00. Next-day delivery on our own trucks when the stop is on a delivery route in AL, MS and GA. Will-call is pickup at the Birmingham warehouse during business hours.</p>
        </div>
      </div>
    </ModalLayer>
  );
}
