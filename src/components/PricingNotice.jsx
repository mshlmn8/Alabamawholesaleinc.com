// One pricing notice above a product grid (AW-224), instead of the pricing
// sentence in the intro, the sidebar box and a sign-in link on every card.
//
//   guest      "Trade prices are shown to approved accounts." with Sign in
//              and Apply for a trade account
//   pending    "Pricing unlocks after your account is approved." with a link
//              to the account page, which shows the approval status
//   approved   nothing: the cards show the prices
//   suspended  nothing: the account's own notices cover it
//
// The cards themselves say "Pricing after approval" as plain text, with no
// tab stop of their own.
import { Link } from '../lib/router.js';

export function PricingNotice({ profile, isApprovedBuyer, onLoginClick, onApplyClick }) {
  if (isApprovedBuyer || profile?.status === 'suspended') return null;
  if (profile) {
    return (
      <div className="callout info pricing-notice">
        <p>Pricing unlocks after your account is approved.</p>
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
        <button className="button sm" type="button" onClick={onLoginClick}>Sign in</button>
        <button className="text-link" type="button" onClick={onApplyClick}>Apply for a trade account</button>
      </div>
    </div>
  );
}
