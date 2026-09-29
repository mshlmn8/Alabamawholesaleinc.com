// The catalog's notices at the top of the page (AW-204), rendered by
// SiteNotices next to the account notices. Pure, so the rules are
// unit-tested.
//
//   catalog-loading  the first load of the live catalog is slow; what is on
//                    screen is the copy bundled with the site
//   catalog-error    the live catalog could not be loaded: the bundled copy
//                    is on screen and may be out of date
//   catalog-stale    loading it again failed: the catalog on screen is the
//                    live one from lastLoadedAt
//
// A page that explains the problem itself (a product that isn't in the
// bundled copy, see NotFoundPage) passes pageExplains and gets no notice. A
// dismissed notice stays away until the catalog loads again (App resets
// `dismissed`), so retries in the background don't bring it back.

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// '2:15 PM', or 'Sep 27, 2:15 PM' for another day.
export function loadedAtText(at, now = Date.now()) {
  const when = new Date(at);
  const options = { hour: 'numeric', minute: '2-digit' };
  if (!sameDay(when, new Date(now))) Object.assign(options, { month: 'short', day: 'numeric' });
  return when.toLocaleString('en-US', options);
}

// catalog: useCatalog()'s value. state: { dismissed, pageExplains, now }.
// act: { retry, dismiss }.
export function catalogNotices(catalog, { dismissed = false, pageExplains = false, now = Date.now() } = {}, act = {}) {
  if (pageExplains) return [];
  const { status, source, slow, error, refreshing, lastLoadedAt } = catalog;
  if (status === 'loading') {
    return slow ? [{
      id: 'catalog-loading',
      title: 'Loading the latest catalog…',
      text: 'Some products, names or prices shown here may change when it arrives.',
    }] : [];
  }
  if (status !== 'error' || !error || dismissed) return [];
  const retry = { id: 'retry', label: refreshing ? 'Trying again…' : 'Try again', onClick: act.retry, disabled: !!refreshing };
  const onDismiss = act.dismiss;
  if (source === 'live' && lastLoadedAt) {
    return [{
      id: 'catalog-stale',
      tone: 'warn',
      title: 'We couldn’t check the catalog for changes',
      text: `Products and prices shown are from ${loadedAtText(lastLoadedAt, now)} and may have changed since. Orders and quote requests are checked against the latest catalog when you send them.`,
      actions: [retry],
      onDismiss,
    }];
  }
  return [{
    id: 'catalog-error',
    tone: 'warn',
    title: 'We couldn’t load the latest catalog',
    text: 'The products shown here may be out of date. You can send an order or quote request once the catalog loads.',
    actions: [retry],
    onDismiss,
  }];
}
