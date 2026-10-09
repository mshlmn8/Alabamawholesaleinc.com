// The notice at the top of every page while the browser is offline
// (AW-344), rendered by SiteNotices first, before the account and catalog
// notices (which read it out). Pure, so the rule is unit-tested. It has no
// close button: it goes away by itself when the connection comes back, and
// App then announces "You’re back online."
//
// Browsing, search and the cart keep working offline; anything that has to
// reach the server waits, and says so where it is offered (QuotePage, the
// sign-in dialog through friendlyAuthError in src/lib/authErrors.js). The
// pages that load on demand open offline too: once the page is idle their
// files are fetched into the browser's cache (every support page, Quote, My
// account and the sign-in dialog), and one opened before that says
// 'Loading…' until the connection is back (src/lib/chunks.js, NEW-006).

// TODO(owner): Should a reload while offline still open the site (an installable app with an offline copy of the pages and catalog)? Not built: a service worker's cache would fight the cache rules for the site's code files (AW-179, AW-182). (AW-344)

export const OFFLINE_NOTICE = Object.freeze({
  id: 'offline',
  tone: 'warn',
  title: 'You’re offline',
  text: 'You can keep browsing and adding to your cart. Sending a quote or order, signing in and uploads wait until you’re back online.',
});

export function offlineNotices({ online = true } = {}) {
  return online ? [] : [OFFLINE_NOTICE];
}
