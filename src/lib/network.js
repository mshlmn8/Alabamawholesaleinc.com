// Time limits for the requests a buyer waits on, and whether the browser is
// offline (AW-194, AW-344). Pure and Node-safe: nothing here touches window
// when it is imported.
//
// supabase-js waits for an answer as long as the network lets it, so a
// stalled quote, sign-in or order list used to say "Sending…" or "Loading…"
// forever. Each such call now gives up on its own:
//   PostgREST   client.from(…)…abortSignal(t.signal) or client.rpc(…).abortSignal(t.signal),
//               with t = timeoutSignal(ms), and t.clear() once it answered
//   auth-js     takes no signal, so withTimeout(client.auth.…(…), ms)
// Never a global fetch timeout in src/lib/supabase.js: storage-js shares that
// fetch, and it would cut off a slow licence upload.
//
// What a timed-out PostgREST call looks like (@supabase/postgrest-js
// 2.117): fetch rejects with the signal's reason, and postgrest-js resolves
// { data: null, error: { message: 'TimeoutError: The request took too
// long.', code: '' } } ('AbortError: …' in a browser that ignores the
// reason). A POST (every rpc) is never retried. postgrest-js retries a GET
// whose fetch failed up to three times, but its wait between tries ends when
// the signal is aborted, and a fetch with an aborted signal fails at once
// without a request, so a timed-out GET gives up within the time limit.
// isTimeoutError() recognises all of these.

// submit_quote (src/lib/orders.js): the server prices and saves every line.
export const QUOTE_SUBMIT_TIMEOUT_MS = 25000;
// Reads a page waits on: order history, the licence documents list.
export const REQUEST_TIMEOUT_MS = 20000;
// Sign-in, the application, reset and confirmation emails (src/lib/auth.jsx).
export const AUTH_REQUEST_TIMEOUT_MS = 20000;

const TIMEOUT_TEXT = 'The request took too long.';

// The reason a timed-out signal aborts with. A DOMException named
// TimeoutError, like AbortSignal.timeout()'s, which isn't used because it
// runs on the browser's own clock: Vitest's fake timers and Playwright's
// page.clock can't move it.
function timeoutReason() {
  if (typeof DOMException === 'function') return new DOMException(TIMEOUT_TEXT, 'TimeoutError');
  return Object.assign(new Error(TIMEOUT_TEXT), { name: 'TimeoutError' });
}

// An AbortSignal that aborts after `ms`. clear() stops the timer once the
// request has answered; abort() cancels the request now (a page that went
// away), with a plain AbortError.
export function timeoutSignal(ms) {
  if (typeof AbortController !== 'function') return { signal: undefined, clear() {}, abort() {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(timeoutReason()), ms);
  const clear = () => clearTimeout(timer);
  return {
    signal: controller.signal,
    clear,
    abort() {
      clear();
      controller.abort();
    },
  };
}

// The error withTimeout() rejects with.
export function timeoutError(message = TIMEOUT_TEXT) {
  return Object.assign(new Error(message), { name: 'TimeoutError', code: 'timeout' });
}

// The promise, or a rejection with timeoutError() after `ms`. The promise
// itself keeps running (auth-js can't be cancelled): a sign-in that answers
// later still signs the buyer in, through onAuthStateChange.
export function withTimeout(promise, ms) {
  let timer = 0;
  const limit = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(timeoutError()), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

const TIMEOUT_MESSAGE = /^(AbortError|TimeoutError)\b/;

// A request that gave up: withTimeout()'s error, an aborted fetch, or
// postgrest-js's { message: 'TimeoutError: …' } for one.
export function isTimeoutError(err) {
  if (!err) return false;
  return err.code === 'timeout' || err.name === 'TimeoutError' || err.name === 'AbortError'
    || TIMEOUT_MESSAGE.test(String(err.message || ''));
}

// The browser says it has no connection. navigator.onLine is only ever
// sure about "offline"; true means "maybe".
export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
