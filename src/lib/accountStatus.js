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

// Before a signed-in account's profile is known (auth.jsx's account
// 'loading'), a price lock says this instead of guessing (NEW-002); a profile
// that didn't load ('no-profile') gets PRICES_NEED_PROFILE where a price
// goes, and the site notice offers Try again.
export const CHECKING_ACCOUNT_TEXT = 'Checking your account…';
export const PRICES_NEED_PROFILE = 'Prices need your account details.';

// What /apply shows a visitor (its page head, App's title for it, and the
// account panels below): 'loading' until the session and profile are known,
// 'no-profile' when it is signed in but its profile didn't load (NEW-002),
// then accountStatus().
export function accountView(profile, account) {
  if (account === 'loading' || account === 'no-profile') return account;
  return accountStatus(profile);
}

// A signed-in account's own panel, where a guest is asked to apply: the home
// page's account section and /contact (AW-066, NEW-014). Its eyebrow is the
// one /apply's page head shows for the same view (ApplyPage's VIEWS), under
// TRADE_ACCOUNT_TITLE. An approved account goes to My account; one waiting
// for approval or on hold to /apply, which shows where the application
// stands and who to call. Before the profile is known, or when it didn't
// load, My account, which says which.
export const TRADE_ACCOUNT_TITLE = 'Your trade account';
export const ACCOUNT_EYEBROWS = Object.freeze({
  loading: 'TRADE ACCOUNT',
  'no-profile': 'TRADE ACCOUNT',
  pending: 'APPLICATION UNDER REVIEW',
  approved: 'ACCOUNT ACTIVE',
  suspended: 'ACCOUNT ON HOLD',
});
const MY_ACCOUNT = Object.freeze({ to: '/account', label: 'My account' });
const APPLICATION_STATUS = Object.freeze({ to: '/apply', label: 'Application status' });
export const TRADE_ACCOUNT_PANELS = Object.freeze({
  loading: { text: CHECKING_ACCOUNT_TEXT, link: MY_ACCOUNT },
  'no-profile': { text: 'You’re signed in, but your account details didn’t load.', link: MY_ACCOUNT },
  pending: { text: 'Your application is with a trade rep. See where it stands, and add your license documents while you wait.', link: APPLICATION_STATUS },
  approved: { text: 'Your trade account is active. See your orders and reorder by SKU in My account.', link: MY_ACCOUNT },
  suspended: { text: `${PRICE_LOCK.suspended.line} See who to call on your application status page.`, link: APPLICATION_STATUS },
});
// The panel for a signed-in visitor's view (accountView), with its eyebrow;
// null for a guest, who is asked to apply instead.
export function tradeAccountPanel(view) {
  const panel = TRADE_ACCOUNT_PANELS[view];
  return panel ? { eyebrow: ACCOUNT_EYEBROWS[view], title: TRADE_ACCOUNT_TITLE, ...panel } : null;
}
