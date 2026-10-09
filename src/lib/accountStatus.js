// One account-status model for the storefront (AW-101, AW-097, AW-098,
// AW-149): what a visitor's trade account allows, the label each status
// shows, and the pricing-lock copy for everyone who can't see prices yet.
// Pure and Node-safe, so meta.js and tests can use it.
//
// Not to be confused with auth.jsx's account ('loading' | 'signed-out' |
// 'no-profile' | 'ready'), which says whether the session and profile have
// loaded. This says what a loaded profile may do.

import { ACCOUNT_STATUS_LABELS } from './accountLabels.js';

export const ACCOUNT_STATUSES = ['guest', 'pending', 'approved', 'suspended'];

// 'guest' without a profile; a profile's own status otherwise. A status this
// site doesn't know is treated as still under review: it never unlocks prices.
export function accountStatus(profile) {
  if (!profile) return 'guest';
  const status = profile.status;
  return status === 'approved' || status === 'suspended' ? status : 'pending';
}

// What a signed-in account's status is called on screen: accountLabels.js's
// map, so there is one (AW-149).
export const STATUS_LABEL = ACCOUNT_STATUS_LABELS;

// The pricing lock, for each status that has no prices: `short` on a product
// card, `line` as a sentence in a page intro, `detail` under `short` (the
// department sidebar). A suspended account is told ordering is paused, never
// that pricing comes "after approval" (AW-101).
export const PRICE_LOCK = {
  guest: {
    short: 'Sign in for pricing',
    line: 'Sign in to see your wholesale pricing.',
    detail: 'Sign in to see your account pricing.',
  },
  pending: {
    short: 'Pricing after approval',
    line: 'Pricing unlocks after your account is approved.',
    detail: 'Your account is not approved for trade pricing yet.',
  },
  suspended: {
    short: 'Account on hold',
    line: 'Ordering is paused on this account.',
    detail: 'Ordering is paused on this account — call the trade desk.',
  },
};
