// Customer-facing error text. A network failure is a service problem, not
// something the customer typed wrong, so it gets the same "unavailable, call
// or email the trade desk" copy everywhere (AW-331). A browser that is
// offline, and a request that took too long (src/lib/network.js), are told
// apart from that (AW-344, AW-194): this file is the one place that words
// them.

import { COMPANY } from '../data/content.js';
import { isOffline, isTimeoutError } from './network.js';

const NETWORK_ERROR = /fetch|network|load failed/i;

export const isNetworkError = (err) => NETWORK_ERROR.test(err?.message || '');

export const unavailableMessage = (what) =>
  `${what} is unavailable right now. Call ${COMPANY.phone} or email ${COMPANY.email} and a trade rep will help you.`;

// The browser has no connection: the buyer's side, not the business's.
export const OFFLINE_MESSAGE = 'You appear to be offline. Check your connection and try again.';

export const slowMessage = (what) =>
  `${what} is taking too long to answer. Check your connection and try again, or call ${COMPANY.phone}.`;

// What to say when the application (sign-up) timed out: it may have gone
// through, and its confirmation email says so.
export const APPLICATION_TIMEOUT_MESSAGE = `The application is taking too long to send. Check your inbox: if a confirmation email arrives, it went through. Otherwise try again, or call ${COMPANY.phone}.`;

// The message to show for a failed request: the offline copy while the
// browser is offline, the "taking too long" copy for a timeout, the
// unavailable copy for network failures, otherwise the error's own message,
// otherwise the fallback.
export const describeError = (err, what, fallback) => {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isTimeoutError(err)) return slowMessage(what);
  return isNetworkError(err) ? unavailableMessage(what) : (err?.message || fallback);
};

// Supabase refuses to send another auth email this soon (AW-016): its
// over_email_send_rate_limit error, or any HTTP 429. The caller says what to
// do instead of showing Supabase's own text.
export const isRateLimitError = (err) => err?.code === 'over_email_send_rate_limit' || err?.status === 429;
