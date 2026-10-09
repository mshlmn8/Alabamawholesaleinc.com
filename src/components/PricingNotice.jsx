// One pricing notice above a product grid (AW-224), instead of the pricing
// sentence in the intro, the sidebar box and a sign-in link on every card.
//
//   guest      "Trade prices are shown to approved accounts." with Sign in
//              and Apply for a trade account
//   pending    "Pricing unlocks after your account is approved." with a link
//              to the account page, which shows the approval status
//   approved   nothing: the cards show the prices
//   suspended  "Ordering is paused on this account." with the trade desk's
//              phone and email, never "wait for approval" (AW-101)
//
// The cards themselves say "Pricing after approval" (or "Account on hold")
// as plain text, with no tab stop of their own. The sentences are
// accountStatus.js's PRICE_LOCK lines, and the labels src/data/terms.js's.
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { PRICE_LOCK, accountStatus } from '../lib/accountStatus.js';
import { Link } from '../lib/router.js';
import { CallOrEmail } from './ContactLinks.jsx';

export function PricingNotice({ profile, isApprovedBuyer, onLoginClick, onApplyClick }) {
  if (isApprovedBuyer) return null;
  const status = accountStatus(profile);
  if (status === 'suspended') {
    return (
      <div className="callout info pricing-notice">
        <p>{PRICE_LOCK.suspended.line} <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="callout info pricing-notice">
        <p>{PRICE_LOCK.pending.line}</p>
        <div className="pricing-notice-actions">
          <Link className="text-link" to="/account">View approval status</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="callout info pricing-notice">
      <p>Trade prices are shown to approved accounts.</p>
      <div className="pricing-notice-actions">
        <button className="button sm" type="button" onClick={onLoginClick}>{SIGN_IN_LABEL}</button>
        <button className="text-link" type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
      </div>
    </div>
  );
}
