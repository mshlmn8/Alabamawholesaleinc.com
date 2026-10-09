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
//   prefetchChunks(names)    fetches the files of those pages or dialogs
//                            into the browser's HTTP cache, quietly, so they
//                            open at once later, and offline (NEW-006,
//                            AW-344). Names are the keys of LAZY_CHUNKS in
//                            scripts/chunk-urls.mjs ('quote', 'account',
//                            'admin', 'auth', 'contact', 'delivery',
//                            'policy', 'apply', 'reset');
//   whenOnline()             resolves at once online, else on 'online';
//   loadPage(name, load)     for a page's React.lazy: `load` (its import())
//                            runs once the file can load: at once online,
//                            or offline when it was fetched ahead; otherwise
//                            the page shows 'Loading…' until the connection
//                            is back. A file that didn't download reloads
//                            the page once (see below);
//   loadDialog(name, load)   the same wait for a dialog, which never reloads
//                            the page by itself: the page under it may hold
//                            typed answers. Its 'This didn't open' offers
//                            Reload;
//   installChunkRecovery()   main.jsx: Vite's 'vite:preloadError' for a
//                            page's file takes the same one reload;
//   clearChunkReload()       a lazily loaded page rendered (LazyPage.jsx).
//
// Why fetch() and a reload: a browser that failed to import() a file keeps
// that failure for the file's address (Chromium never asks again), so the
// page or dialog can't open until the page is reloaded. Fetching ahead with
// fetch() never touches that module record, unlike import() or <link
// rel=modulepreload>. A page whose file still fails while online reloads
// itself once per address (sessionStorage 'aw-chunk-reload'); only when the
// reloaded page fails again does it say 'This page didn't load'.

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

// {name: [url, …]}, written over this string in the built code by
// scripts/chunk-urls.mjs (vite.config.js). It stays a string in development
// and tests, where nothing is fetched ahead. Only ever indexed by name, so
// the minifier can't fold the string away before the build replaces it.
let chunkMap = '__AW_CHUNK_URLS__';

// Files fetched ahead this visit, which the HTTP cache serves even offline
// (/assets/* is cached for a year: netlify.toml).
const warmed = new Set();

// The files (code and CSS) the page or dialog `name` needs that the page
// didn't load at start; [] when unknown.
export function chunkUrls(name) {
  // The placeholder string has no lists under these names.
  const urls = chunkMap?.[name];
  return Array.isArray(urls) ? urls : [];
}

export function setChunkUrlsForTests(map) {
  chunkMap = map;
  warmed.clear();
}

export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export function whenOnline() {
  if (typeof window === 'undefined' || isOnline()) return Promise.resolve();
  return new Promise((resolve) => {
    const back = () => {
      window.removeEventListener('online', back);
      resolve();
    };
    window.addEventListener('online', back);
  });
}

export function prefetchChunks(names) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  // Offline it would only fail; a data-saving connection waits for a page
  // that needs it.
  if (!isOnline() || navigator.connection?.saveData) return;
  for (const url of new Set(names.flatMap(chunkUrls))) {
    if (warmed.has(url)) continue;
    window.fetch(url, { credentials: 'same-origin' })
      // Read to the end, so the whole file goes into the cache.
      .then((response) => (response.ok ? response.arrayBuffer().then(() => { warmed.add(url); }) : null))
      .catch(() => {});
  }
}

// Every file of `name` was fetched ahead.
export function isWarm(name) {
  const urls = chunkUrls(name);
  return urls.length > 0 && urls.every((url) => warmed.has(url));
}

// Resolves when `name`'s code can load: online, or offline from the cache.
const whenLoadable = (name) => (isOnline() || isWarm(name) ? Promise.resolve() : whenOnline());

export const CHUNK_RELOAD_KEY = 'aw-chunk-reload';
const reloadNow = () => window.location.reload();
let reloadPage = reloadNow;
// A reload this document already started: later failures wait for it.
let reloadStarted = false;
// jsdom's location.reload can't be replaced; tests pass their own. It also
// stands for the next document: no reload started yet.
export function setReloadForTests(reload) {
  reloadPage = reload || reloadNow;
  reloadStarted = false;
}

// Reloads the page to recover a file that didn't download, at most once per
// address: the flag names the address reloaded for, and a page that
// rendered clears it. Offline, or without sessionStorage to keep the flag
// in (no way to stop a loop), it doesn't. Returns true when it reloads, or
// a reload is already under way.
export function reloadForChunkError() {
  if (reloadStarted) return true;
  if (typeof window === 'undefined' || !isOnline()) return false;
  const here = window.location.pathname + window.location.search;
  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === here) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, here);
  } catch {
    return false;
  }
  reloadStarted = true;
  reloadPage();
  return true;
}

export function clearChunkReload() {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // storage blocked: there is no flag either
  }
}

// A promise that never settles: the page is reloading meanwhile, and the
// loading view stays up until it does.
const reloading = () => new Promise(() => {});

export function loadPage(name, load) {
  return whenLoadable(name)
    .then(load)
    .catch((error) => {
      if (!isChunkLoadError(error)) throw error;
      // The connection dropped while the file downloaded: the reload waits
      // for it to come back.
      return whenOnline().then(() => {
        if (reloadForChunkError()) return reloading();
        throw error;
      });
    })
    // installChunkRecovery() already started the reload, and Vite's helper
    // resolved without the module.
    .then((module) => module || reloading());
}

// Dialog files loading now: a 'vite:preloadError' meanwhile may be theirs.
let dialogLoads = 0;

export function loadDialog(name, load) {
  dialogLoads += 1;
  const done = () => { dialogLoads -= 1; };
  return whenLoadable(name).then(load).then((module) => {
    done();
    return module;
  }, (error) => {
    done();
    throw error;
  });
}

// Vite reports a file of a page (or a dialog) that didn't download with a
// cancelable 'vite:preloadError' on window before the import() fails.
// While no dialog is loading it is a page's: reload once, as loadPage would.
export function installChunkRecovery() {
  if (typeof window === 'undefined') return () => {};
  const onPreloadError = (event) => {
    if (dialogLoads > 0) return;
    if (reloadForChunkError()) event.preventDefault();
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
