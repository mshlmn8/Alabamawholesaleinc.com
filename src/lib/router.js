// History API router (AW-043). Pages live at real paths (see ./routes.js for
// the URL scheme); internal links are <Link> elements, i.e. real <a href>s
// that open in a new tab, copy and crawl like any link, while a plain click
// stays inside the app.
//
// Besides the current location this module owns what happens around a page
// change:
//   - the scroll position: reset to the top before paint on a new page, kept
//     when only filters or the product line change, restored on Back/Forward
//     and after a reload (AW-037, AW-008);
//   - focus and announcement: the new page's h1 (or <main>) takes focus and
//     its title is read out through the shared live region (AW-041). Back
//     and Forward put focus back on the link or line it was on when the
//     visitor left that entry (stored beside its scroll position), so the
//     next Tab carries on from there instead of from the top (NEW-007);
//   - history hygiene: a link to the current URL adds no entry, and filter
//     changes replace the entry instead of pushing one (AW-327);
//   - dialogs: every ModalLayer holds a history entry while it is open, so
//     the browser's Back button closes the dialog through its own close
//     handler instead of changing the page underneath (AW-065).
//
// Old '#/…' links are redirected to their path by redirectLegacyHash(), which
// main.jsx calls once before the first render. Supabase auth fragments
// ('#access_token=…', '#error=…') are read and removed before that, by
// takeAuthLink() in src/lib/authLink.js.

import { createElement, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { hrefFor, legacyHashTarget, pageKeyFor, parseUrl } from './routes.js';
import { announce, ensureLiveRegion } from './announce.js';

export {
  SUPPORT_PAGES, hrefFor, pathFor, parseUrl, resolveRoute, routeKey, slugify,
} from './routes.js';

const hasWindow = typeof window !== 'undefined';

const listeners = new Set();
let snapshot = null;
let seq = 0;
// The sequence number of the last navigation that moved focus to a new page;
// ModalLayer leaves focus alone when one happened while it was open.
let lastPageMoveSeq = 0;
let started = false;
// Scroll positions by history entry (history.state.awKey): { x, y, focus? }.
// Kept in sessionStorage when the page is hidden, so a reload or coming back
// from another site restores them too; the most recent 50 are kept. `focus`
// says what had focus when the entry was left (NEW-007): { href } an
// internal link's path (and #anchor; never its query, which can hold typed
// text), { line } a cart line's data-line-key, or { id }.
const positions = new Map();
const SCROLL_STORE = 'aw-scroll';
const MAX_POSITIONS = 50;
// Dialog history entries (AW-065). `holders` are the open ModalLayers, oldest
// first; `pushed` is true while the entry they share is in the history.
const overlay = { holders: [], pushed: false, baseUrl: null, baseKey: null, ignorePop: false, replaceOnPop: null };

const historyState = () => {
  try { return window.history.state; } catch { return null; }
};
const writeState = (method, state, url) => {
  // Browsers throw on too many calls in a short time (Safari: 100 per 30 s).
  try { window.history[method](state, '', url); return true; } catch { return false; }
};
const newKey = () => Math.random().toString(36).slice(2, 10);
const currentUrl = () => window.location.pathname + window.location.search + window.location.hash;
const urlOf = (loc) => loc.pathname + loc.search + loc.hash;
const scrollPos = () => ({ x: window.scrollX || 0, y: window.scrollY || 0 });
const withoutOverlay = (state) => {
  const next = { ...(state || {}) };
  delete next.awOverlay;
  return next;
};

function makeSnapshot(action, extra = {}) {
  const { pathname, search, hash } = window.location;
  const pageKey = pageKeyFor({ pathname, search });
  return {
    pathname, search, hash,
    key: historyState()?.awKey || null,
    action,
    pageKey,
    pageChanged: snapshot ? snapshot.pageKey !== pageKey : false,
    reset: false,
    restore: null,
    seq: ++seq,
    ...extra,
  };
}

function emit(next) {
  snapshot = next;
  if (next.reset || (next.action === 'pop' && next.pageChanged)) lastPageMoveSeq = next.seq;
  for (const listener of listeners) listener();
}

function start() {
  if (started || !hasWindow) return;
  started = true;
  try {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  } catch { /* read-only in some embedded browsers */ }
  loadPositions();
  const st = historyState();
  // A reload while a dialog was open leaves its entry current; the dialog is gone.
  if (!st?.awKey || st.awOverlay) writeState('replaceState', { ...withoutOverlay(st), awKey: st?.awKey || newKey() });
  const key = historyState()?.awKey;
  snapshot = makeSnapshot('load', { restore: (key && positions.get(key)) || null });
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onPopState);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', savePositions);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePositions(); });
  ensureLiveRegion();
}

function remember(key, pos) {
  if (!key) return;
  positions.delete(key);
  positions.set(key, pos);
}

function onScroll() {
  remember(snapshot?.key, scrollPos());
}

// What a stored focus may be: short strings shaped like a path, a cart line
// key or an element id, nothing else (the store is sessionStorage, which
// other code on the origin could write).
const FOCUS_SHAPES = {
  href: /^\/[\w\-./~%]*(#[A-Za-z][\w-]*)?$/,
  line: /^[\w.:-]+$/,
  id: /^[A-Za-z][\w-]*$/,
};
const FOCUS_MAX = 200;
function cleanFocus(focus) {
  if (!focus || typeof focus !== 'object') return null;
  for (const [kind, shape] of Object.entries(FOCUS_SHAPES)) {
    const value = focus[kind];
    if (typeof value === 'string' && value.length <= FOCUS_MAX && shape.test(value)) return { [kind]: value };
  }
  return null;
}

function loadPositions() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(SCROLL_STORE) || '{}');
    for (const [key, pos] of Object.entries(saved)) {
      if (!pos || !Number.isFinite(pos.y)) continue;
      const focus = cleanFocus(pos.focus);
      positions.set(key, focus ? { x: Number(pos.x) || 0, y: pos.y, focus } : { x: Number(pos.x) || 0, y: pos.y });
    }
  } catch { /* storage blocked or corrupt: positions start empty */ }
}

// An internal link's path plus its #anchor, the way focusTarget() compares
// links; null for another site's.
function linkKey(link) {
  try {
    const url = new URL(link.getAttribute('href'), window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + (anchorOf(url.hash) ? url.hash : '');
  } catch {
    return null;
  }
}

// What has focus now, as a stored focus (see `positions`), or null.
function focusDescriptor() {
  const el = document.activeElement;
  if (!el || el === document.body || !el.closest || !el.closest('main')) return null;
  const link = el.closest('a[href]');
  const href = link && linkKey(link);
  if (href) return cleanFocus({ href });
  const line = el.closest('[data-line-key]');
  if (line) return cleanFocus({ line: line.getAttribute('data-line-key') });
  return el.id ? cleanFocus({ id: el.id }) : null;
}

// The scroll position and focus of the entry being left.
const leaving = () => {
  const focus = focusDescriptor();
  return focus ? { ...scrollPos(), focus } : scrollPos();
};

// For a reload, or for coming back from another site.
function savePositions() {
  remember(snapshot?.key, scrollPos());
  try {
    const recent = [...positions.entries()].slice(-MAX_POSITIONS);
    window.sessionStorage.setItem(SCROLL_STORE, JSON.stringify(Object.fromEntries(recent)));
  } catch { /* storage blocked or full */ }
}

function onPopState() {
  // An old '#/…' link pasted into the address bar while the site is open is
  // a same-page fragment change, not a load: redirect it here too.
  const legacy = legacyHashTarget(window.location.hash);
  if (legacy !== null) writeState('replaceState', historyState(), legacy);

  // The history.back() that removed a closed dialog's entry. Filters changed
  // while the dialog was open are carried onto the entry below (AW-327).
  const ours = overlay.ignorePop;
  const carry = overlay.replaceOnPop;
  overlay.ignorePop = false;
  overlay.replaceOnPop = null;
  if (ours && carry) writeState('replaceState', carry.state, carry.url);
  const st = historyState();
  const sameUrl = !!snapshot && currentUrl() === urlOf(snapshot);
  if (ours && sameUrl) return;

  if (overlay.pushed && !st?.awOverlay) {
    overlay.pushed = false;
    if (st?.awKey === overlay.baseKey) {
      // Back while a dialog is open: the dialog closes through its own close
      // handler and the page stays, with any filters changed in the dialog
      // (the filter drawer), as its × button would leave it.
      if (!sameUrl) writeState('replaceState', { ...st, awKey: snapshot.key || st.awKey }, urlOf(snapshot));
      closeTopOverlay();
      return;
    }
    // A jump further back closes every dialog and changes the page.
    for (const holder of [...overlay.holders].reverse()) holder.close();
  } else if (st?.awOverlay && !overlay.pushed) {
    // Forward onto the entry of a dialog that has since closed: straight
    // back to the page's own entry, so the next Back leaves the page in one
    // press (NEW-028). Forward then does nothing here, which is fine:
    // nothing can follow a dialog's entry (a link in a dialog replaces it).
    overlay.ignorePop = true;
    window.history.back();
    return;
  }
  if (sameUrl) return; // e.g. the hashchange that follows a popstate

  // A form with unsaved changes kept the page (AW-118): the URL Back or
  // Forward left is put back as a new entry, so the address bar matches the
  // page still on screen.
  if (snapshot && !mayLeave(currentUrl())) {
    writeState('pushState', { awKey: snapshot.key }, urlOf(snapshot));
    return;
  }

  let key = historyState()?.awKey;
  if (!key) {
    // An entry this router did not create (a plain #fragment link).
    key = newKey();
    writeState('replaceState', { ...(historyState() || {}), awKey: key });
  }
  // Where focus was on the entry just left, for a Forward back to it
  // (NEW-007). Its scroll position is the one last recorded there.
  const focus = snapshot?.key ? focusDescriptor() : null;
  if (focus) remember(snapshot.key, { ...(positions.get(snapshot.key) || scrollPos()), focus });
  emit(makeSnapshot('pop', { restore: positions.get(key) || null }));
}

function pushOverlayEntry() {
  if (overlay.pushed) return;
  const st = historyState() || {};
  if (writeState('pushState', { ...st, awOverlay: true })) {
    overlay.pushed = true;
    overlay.baseUrl = currentUrl();
    overlay.baseKey = st.awKey || null;
  }
}

function closeTopOverlay() {
  const top = overlay.holders[overlay.holders.length - 1];
  const stillOpen = overlay.holders.length - 1;
  top?.close();
  // Dialogs below the one that closed keep one entry between them.
  if (stillOpen > 0) pushOverlayEntry();
}

function settleOverlay() {
  if (overlay.holders.length || !overlay.pushed) return;
  overlay.pushed = false;
  const st = historyState();
  if (!st?.awOverlay) return;
  // Closed with ×, Escape or the backdrop: drop the dialog's entry so the
  // next Back leaves the page. When the URL changed while it was open (the
  // filter drawer), the entry below takes the new URL, so filter changes add
  // no history entry on phones either.
  overlay.ignorePop = true;
  const here = currentUrl();
  if (here !== overlay.baseUrl) overlay.replaceOnPop = { state: withoutOverlay(st), url: here };
  window.history.back();
}

// Called by ModalLayer when a layer opens. Returns the release function for
// when it closes. `close` is the layer's own close handler, so Back behaves
// like its × button (and any guard on that handler applies to Back too).
export function holdOverlayEntry(close) {
  if (!hasWindow) return () => {};
  start();
  const holder = { close };
  overlay.holders.push(holder);
  pushOverlayEntry();
  return () => {
    const i = overlay.holders.indexOf(holder);
    if (i !== -1) overlay.holders.splice(i, 1);
    // After the commit: a layer that replaces another (cart -> sign in) takes
    // over the same entry.
    queueMicrotask(settleOverlay);
  };
}

// A close handler that decides not to close (e.g. unsaved input) calls this
// to put the dialog's history entry back after Back removed it.
export function restoreOverlayEntry() {
  if (overlay.holders.length) pushOverlayEntry();
}

// The number of the latest navigation that moved focus to a new page.
export const lastPageMove = () => lastPageMoveSeq;

// Leave guards (AW-118): a form with unsaved changes is asked before the URL
// changes, by navigate() and by Back/Forward. The newest guard decides; it
// gets the next URL and must answer at once (window.confirm), true to let the
// navigation go ahead. In-page actions ask with a dialog instead. Returns the
// function that removes the guard.
const guards = [];
export function setNavigationGuard(guard) {
  const entry = { guard };
  guards.push(entry);
  return () => {
    const i = guards.indexOf(entry);
    if (i !== -1) guards.splice(i, 1);
  };
}
function mayLeave(next) {
  const top = guards[guards.length - 1];
  if (!top) return true;
  try {
    return top.guard(next) !== false;
  } catch {
    return true;
  }
}
// Asks the leave guard before an action that drops the page some other way
// than a link (signing out): true when there is no guard or it lets go. The
// action's own navigate() then passes force, so the guard isn't asked twice.
export const confirmLeave = (next) => mayLeave(next);

// Goes to `to` (a route object or an href). Options:
//   replace  replace the current history entry instead of adding one
//   scroll   false keeps the scroll position and focus even on a new page
//   force    true skips the leave guard (setNavigationGuard)
export function navigate(to, { replace = false, scroll = true, force = false } = {}) {
  if (!hasWindow) return;
  start();
  const href = typeof to === 'string' ? to : hrefFor(to);
  let url;
  try { url = new URL(href, window.location.href); } catch { return; }
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  const next = url.pathname + url.search + url.hash;
  if (next === currentUrl()) {
    // AW-327: the page you are on gets no second history entry. Following a
    // link to it brings its top (or its anchor) back into view.
    if (!replace && scroll !== false) emit(makeSnapshot('same', { reset: true, pageChanged: false }));
    return;
  }
  if (!force && !mayLeave(next)) return;
  remember(snapshot?.key, leaving());
  const st = historyState() || {};
  const onOverlay = overlay.pushed && !!st.awOverlay;
  let ok;
  if (onOverlay && replace) {
    // A filter change while a drawer is open stays on the drawer's entry.
    ok = writeState('replaceState', { ...st, awKey: newKey() }, next);
  } else if (onOverlay) {
    // A link followed from inside a dialog takes over the dialog's entry, so
    // Back returns to the page the dialog was opened on, not to a copy of it.
    ok = writeState('replaceState', { ...withoutOverlay(st), awKey: newKey() }, next);
    if (ok) overlay.pushed = false;
  } else if (replace) {
    ok = writeState('replaceState', { ...st, awKey: st.awKey || newKey() }, next);
  } else {
    ok = writeState('pushState', { awKey: newKey() }, next);
  }
  if (!ok) {
    window.location.assign(next);
    return;
  }
  const snap = makeSnapshot(replace ? 'replace' : 'push');
  snap.reset = scroll !== false && (snap.pageChanged || anchorOf(url.hash) !== null);
  emit(snap);
}

// Rewrites an old '/#/category/X' address to '/category/X' before the first
// render. Returns true when it did.
export function redirectLegacyHash() {
  if (!hasWindow) return false;
  const target = legacyHashTarget(window.location.hash);
  if (target === null) return false;
  return writeState('replaceState', historyState(), target);
}

function subscribe(listener) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() {
  start();
  return snapshot;
}

// The current location: { pathname, search, hash, key, action, pageKey,
// pageChanged, reset, restore, seq }. A new object on every navigation.
export function useLocation() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// The current location, its raw (not yet validated) route and navigate().
export function useRoute() {
  const location = useLocation();
  const raw = useMemo(() => parseUrl(location), [location]);
  return { location, raw, navigate };
}

// An internal link: a real <a href> whose plain left click navigates inside
// the app. Modified clicks (new tab, new window, download) and other buttons
// keep the browser's behaviour. `to` is an href or a route object.
export function Link({ to, replace = false, scroll = true, onClick, children, ...rest }) {
  const href = typeof to === 'string' ? to : hrefFor(to);
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    if (rest.download !== undefined) return;
    event.preventDefault();
    navigate(href, { replace, scroll });
  };
  return createElement('a', { ...rest, href, onClick: handleClick }, children);
}

// '#new-arrivals' -> 'new-arrivals'; route-like and auth fragments -> null.
// LazyPage.jsx uses it for a page whose code arrives after the navigation.
export function anchorOf(hash) {
  const match = /^#([A-Za-z][\w-]*)$/.exec(hash || '');
  return match ? match[1] : null;
}

// Scrolls without the CSS smooth-scroll animation (AW-037): route changes
// must land at once, before paint, including in Safari. behavior 'instant'
// overrides `html { scroll-behavior: smooth }`; browsers that reject that
// value get the inline override (with a style flush, so it applies now).
function scrollInstantly(withOptions, fallback) {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  void root.offsetHeight;
  try {
    withOptions();
  } catch {
    fallback();
  } finally {
    root.style.scrollBehavior = previous;
  }
}
const scrollToPosition = (x, y) => scrollInstantly(
  () => window.scrollTo({ left: x, top: y, behavior: 'instant' }),
  () => window.scrollTo(x, y),
);

function scrollToAnchor(id, { smooth = false } = {}) {
  const target = document.getElementById(id);
  if (!target) return false;
  if (smooth) target.scrollIntoView({ block: 'start' });
  else {
    scrollInstantly(
      () => target.scrollIntoView({ block: 'start', behavior: 'instant' }),
      () => target.scrollIntoView(true),
    );
  }
  return true;
}

// Restores a saved position. When the page is still shorter than that (late
// content), keeps trying for a moment unless the user scrolls first.
function restoreScroll({ x = 0, y = 0 }) {
  scrollToPosition(x, y);
  if (Math.abs(window.scrollY - y) <= 1) return;
  const startedAt = performance.now();
  let stopped = false;
  const stop = () => { stopped = true; };
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  events.forEach((type) => window.addEventListener(type, stop, { once: true, passive: true }));
  const tick = () => {
    if (!stopped) scrollToPosition(x, y);
    if (stopped || Math.abs(window.scrollY - y) <= 1 || performance.now() - startedAt > 1000) {
      events.forEach((type) => window.removeEventListener(type, stop));
      return;
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

// Focuses a heading (made focusable with tabindex=-1) without moving the
// page, also where preventScroll is not supported (Safari 14).
function focusWithoutScroll(el) {
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  const { x, y } = scrollPos();
  el.focus({ preventScroll: true });
  if (window.scrollX !== x || window.scrollY !== y) scrollToPosition(x, y);
}

const headingIn = (el) => (el && (el.matches('h1, h2, h3') ? el : el.querySelector('h1, h2, h3'))) || el;

// Focuses the current page's h1 (or <main>) the way a page change does. For
// a page that appears without a navigation, e.g. when the age gate closes.
export function focusPageHeading() {
  if (!hasWindow) return;
  focusWithoutScroll(document.querySelector('main h1') || document.querySelector('main'));
}

// Brings #id into view and focuses its heading, as following a link to it
// does, for a section that appears after its page did (My account's Quick
// Reorder once the account has loaded, AW-086). It runs after the current
// task, so a dialog that closes in the same update hands focus back first,
// and while a dialog keeps the page inert it waits for that dialog to close.
// Returns a function that cancels it.
export function revealAnchor(id) {
  if (!hasWindow) return () => {};
  let timer = 0;
  let observer = null;
  const cancel = () => {
    window.clearTimeout(timer);
    observer?.disconnect();
    observer = null;
  };
  const attempt = () => {
    const target = document.getElementById(id);
    if (!target) return;
    const cover = target.closest('[inert]');
    if (cover) {
      observer = new MutationObserver(() => {
        if (cover.hasAttribute('inert')) return;
        cancel();
        timer = window.setTimeout(attempt, 0);
      });
      observer.observe(cover, { attributes: true, attributeFilter: ['inert'] });
      return;
    }
    scrollToAnchor(id);
    focusWithoutScroll(headingIn(target));
  };
  timer = window.setTimeout(attempt, 0);
  return cancel;
}

// Jumps to the top of the page at once, as a page change does (AW-037), for
// a view that replaces the page without a navigation (the quote receipt).
export function scrollToTop() {
  if (hasWindow) scrollToPosition(0, 0);
}

// The element a stored focus names on the page now: a product card's link
// first, then any link in <main> to the same path, a cart line (its first
// control), or the id. Null when it isn't there (yet).
function focusTarget(focus) {
  const main = document.querySelector('main');
  if (!main || !focus) return null;
  if (focus.href) {
    const links = [...main.querySelectorAll('a.card-link[href]'), ...main.querySelectorAll('a[href]')];
    return links.find((a) => linkKey(a) === focus.href) || null;
  }
  if (focus.line) {
    const line = [...main.querySelectorAll('[data-line-key]')].find((el) => el.getAttribute('data-line-key') === focus.line);
    return line ? line.querySelector('a[href], button, input, select, textarea') || line : null;
  }
  const el = focus.id ? document.getElementById(focus.id) : null;
  return el && main.contains(el) ? el : null;
}

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && (r.width > 0 || r.height > 0);
};

// Back/Forward (NEW-007): once the page is on screen and its scroll
// restored, focus goes back to what had it when the visitor left this entry,
// without moving the page, so the next Tab carries on from there. It keeps
// looking for a moment while late content arrives (as restoreScroll does),
// and stops if the visitor clicks, types or moves focus meanwhile. Without
// one in view: a new page's h1; on the same page (an anchor jump undone on
// /catalog), the section in view's heading for an #anchor, the h1 at the
// top, or else <main>, never a heading scrolled out of view. Returns a
// cancel function.
let restoringFocus = 0;
// True while Back/Forward is still putting focus back (LazyPage.jsx then
// leaves focus to it).
export const isRestoringFocus = () => restoringFocus > 0;

function restoreFocus(location) {
  const wanted = location.restore?.focus || null;
  const y = location.restore ? location.restore.y : window.scrollY;
  const fallback = () => {
    if (location.pageChanged || y <= 0) return document.querySelector('main h1') || document.querySelector('main');
    const anchor = anchorOf(location.hash);
    const section = anchor && document.getElementById(anchor);
    if (section && inView(section)) return headingIn(section);
    return document.querySelector('main');
  };
  const startedAt = performance.now();
  let frame = 0;
  let done = false;
  const events = ['pointerdown', 'keydown', 'focusin'];
  const stop = () => {
    if (done) return;
    done = true;
    restoringFocus -= 1;
    window.cancelAnimationFrame(frame);
    events.forEach((type) => window.removeEventListener(type, stop, true));
  };
  const land = (el) => {
    stop();
    focusWithoutScroll(el);
  };
  const attempt = () => {
    if (done) return;
    const late = performance.now() - startedAt > 1000;
    const el = wanted && focusTarget(wanted);
    const settled = Math.abs(window.scrollY - y) <= 1 || late;
    if (el && settled) return land(inView(el) ? el : fallback());
    if (!wanted || late) return land(fallback());
    frame = window.requestAnimationFrame(attempt);
  };
  restoringFocus += 1;
  attempt();
  if (!done) events.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
  return stop;
}

// Runs the page-change behaviour for every navigation. App calls it once,
// after the effect that writes the page title.
export function useNavigationEffects() {
  const location = useLocation();

  // Scroll, before paint.
  useLayoutEffect(() => {
    const anchor = anchorOf(location.hash);
    if (location.action === 'load' || location.action === 'pop') {
      if (location.restore) restoreScroll(location.restore);
      else if (anchor) scrollToAnchor(anchor);
      else if (location.pageChanged) scrollToPosition(0, 0);
      return;
    }
    if (!location.reset) return;
    if (anchor && scrollToAnchor(anchor, { smooth: !location.pageChanged })) return;
    scrollToPosition(0, 0);
  }, [location]);

  // Focus and announcement. A passive effect, so it runs after a closing
  // dialog has handed focus back and wins over it.
  useEffect(() => {
    if (location.action === 'load') return undefined;
    if (location.action === 'pop') {
      // Back/Forward to another page, or to another address on this one.
      if (location.pageChanged) announce(document.title);
      return restoreFocus(location);
    }
    if (!location.reset) return undefined;
    const anchor = anchorOf(location.hash);
    const target = (anchor && headingIn(document.getElementById(anchor)))
      || document.querySelector('main h1')
      || document.querySelector('main');
    focusWithoutScroll(target);
    if (location.pageChanged || location.action === 'same') announce(document.title);
    return undefined;
  }, [location]);
}
