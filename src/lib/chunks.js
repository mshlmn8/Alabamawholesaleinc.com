// Code that loads on demand (AW-179). The pages most visits never open
// (account, admin, quote, the support pages) and the sign-in dialog are
// separate files that App.jsx loads with React.lazy when first needed:
//
//   isChunkLoadError(error)  the error a failed import() of such a file
//                            throws, so a fallback can say what happened
//                            (the site was updated, or the connection
//                            dropped) and offer Reload;
//   whenIdle(callback)       runs callback once the page has loaded and the
//                            browser is idle; returns a cancel function;
//   prefetch(loaders)        starts loading files in the background, quietly.
//
// Nothing here reloads the page by itself: a visitor may be typing.

// What each browser's import() says when a module file can't be fetched,
// and what Vite's preload helper says when a file it needs first fails.
const CHUNK_MESSAGES = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
  /Unable to preload CSS/i, // Vite
];

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || error);
  return CHUNK_MESSAGES.some((re) => re.test(message));
}

// Without requestIdleCallback (Safari), how long after the load event.
export const IDLE_FALLBACK_MS = 1500;
// requestIdleCallback's deadline: run by then even on a busy page.
export const IDLE_TIMEOUT_MS = 5000;

export function whenIdle(callback) {
  if (typeof window === 'undefined') return () => {};
  let cancelled = false;
  let idleId = null;
  let timer = null;
  const run = () => {
    if (!cancelled) callback();
  };
  const schedule = () => {
    if (cancelled) return;
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    else timer = window.setTimeout(run, IDLE_FALLBACK_MS);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', schedule);
    if (idleId != null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
    if (timer != null) window.clearTimeout(timer);
  };
}

// Each loader is a () => import('…') that React.lazy also uses: the browser
// keeps one copy of each module, so the page or dialog opens at once later.
// A failure is ignored here: when the page or dialog is opened, its own
// load fails too and its error boundary offers Reload.
export function prefetch(loaders) {
  for (const load of loaders) {
    try {
      Promise.resolve(load()).catch(() => {});
    } catch {
      // A loader that throws at once: the same as a failed load.
    }
  }
}
