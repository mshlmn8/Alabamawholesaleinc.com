// The approved buyer's prices at the top of the page (NEW-054), rendered by
// SiteNotices after the catalog's notices. Pure, so the rule is unit-tested.
//
//   prices-error  the buyer's prices (my_prices(), src/lib/prices.jsx) could
//                 not be loaded and none are kept from an earlier load: the
//                 cards and the product page say "Your price didn’t load." in
//                 body type, and this says why, with Try again
//
// A failed refresh that kept the prices already on screen gets no notice:
// those prices are still shown (and checkout checks them again on submit).
// Admin pages don't use these prices, so they get none either. Until the
// prices load, the notice can't be dismissed: every price on the site waits
// on it, as with the account's own 'Your account details didn’t load'.

export const PRICES_ERROR_TITLE = 'We couldn’t load your prices';

// prices: usePrices()'s value ({ status, prices, refreshing }).
// state: { routePage }. act: { retry }.
export function pricesNotices(prices, { routePage = null } = {}, act = {}) {
  if (!prices || prices.status !== 'error' || prices.prices) return [];
  if (routePage === 'admin') return [];
  const refreshing = !!prices.refreshing;
  return [{
    id: 'prices-error',
    tone: 'warn',
    title: PRICES_ERROR_TITLE,
    text: 'Products show without your account prices until they load. Try again, or check your connection.',
    actions: [{ id: 'retry', label: refreshing ? 'Trying again…' : 'Try again', onClick: act.retry, disabled: refreshing }],
  }];
}
