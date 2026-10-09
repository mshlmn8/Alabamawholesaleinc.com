// One pricing notice above a product grid (AW-224), instead of the pricing
// sentence in the intro, the sidebar box and a sign-in link on every card:
// department and line pages, search results and /catalog (NEW-050), in one
// style and one wording.
//
//   guest      "Trade prices are shown to approved accounts." with Sign in
//              and Apply for a trade account
//   pending    "Pricing unlocks after your account is approved." with a link
//              to the account page, which shows the approval status
//   approved   nothing: the cards show the prices
//   suspended  "Ordering is paused on this account." with the trade desk's
//              phone and email, never "wait for approval" (AW-101)
//
// The account decides first (NEW-002; useAuth's account, through App's
// cardProps): the guest's Sign in and Apply only when nobody is signed in.
//   loading    the session or the profile is still being checked: "Checking
//              your account…" in the guest notice's shape, its actions row
//              kept but invisible, so the notice that follows doesn't move
//              the grid
//   no-profile signed in, but the profile didn't load: nothing here; the
//              site notice says so, with Try again and Sign out
//
// The cards themselves say "Sign in for pricing" to a guest, "Pricing after
// approval" to an account waiting for approval and "Account on hold" to one
// on hold, as plain text, with no tab stop of their own (NEW-050). The
// sentences are accountStatus.js's PRICE_LOCK, and the labels
// src/data/terms.js's.
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { CHECKING_ACCOUNT_TEXT, PRICE_LOCK, accountStatus } from '../lib/accountStatus.js';
import { Link } from '../lib/router.js';
import { CallOrEmail } from './ContactLinks.jsx';

export function PricingNotice({ profile, account = profile ? 'ready' : 'signed-out', isApprovedBuyer, onLoginClick, onApplyClick }) {
  if (isApprovedBuyer || account === 'no-profile') return null;
  if (account === 'loading') {
    return (
      <div className="callout info pricing-notice">
        <p role="status">{CHECKING_ACCOUNT_TEXT}</p>
        {/* Holds the guest notice's height (NEW-002): never read out, never a tab stop. */}
        <div className="pricing-notice-actions is-placeholder" aria-hidden="true">
          <span className="button sm">{SIGN_IN_LABEL}</span>
          <span className="text-link">{APPLY_LABEL}</span>
        </div>
      </div>
    );
  }
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
      <p>{PRICE_LOCK.guest.notice}</p>
      <div className="pricing-notice-actions">
        <button className="button sm" type="button" onClick={onLoginClick}>{SIGN_IN_LABEL}</button>
        <button className="text-link" type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
      </div>
    </div>
  );
}
