// Customer-facing error text. A network failure is a service problem, not
// something the customer typed wrong, so it gets the same "unavailable, call
// or email the trade desk" copy everywhere (AW-331).

import { COMPANY } from '../data/content.js';

const NETWORK_ERROR = /fetch|network|load failed/i;

export const isNetworkError = (err) => NETWORK_ERROR.test(err?.message || '');

export const unavailableMessage = (what) =>
  `${what} is unavailable right now. Call ${COMPANY.phone} or email ${COMPANY.email} and a trade rep will help you.`;

// The message to show for a failed request: the unavailable copy for network
// failures, otherwise the error's own message, otherwise the fallback.
export const describeError = (err, what, fallback) =>
  (isNetworkError(err) ? unavailableMessage(what) : (err?.message || fallback));
