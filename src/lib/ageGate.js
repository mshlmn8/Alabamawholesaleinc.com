// The 21+ age confirmation behind the age gate (AW-044, AW-176, AW-339,
// AW-340). This merges the Phase 1 store with the behaviour of Cursor's
// PR #12, which the owner merged; where the two differed, PR #12 wins.
//
// - "Yes" stores a dated record, {"ok":true,"at":<ms>}, in localStorage under
//   STORAGE.age. It counts for AGE_CONFIRMATION_MAX_AGE_MS; after that, or
//   when the value is damaged, the gate asks again and the value is removed.
// - Earlier versions stored a bare 'yes' with no date. It counts as expired
//   (PR #12): the visitor sees the gate once more, and the value is removed.
// - "No, exit" is remembered in sessionStorage for this browser session, so
//   a reload keeps the exit screen; the exit screen can take it back.
// - Tabs follow each other: confirming in one tab, or signing out (which
//   clears the confirmation, see CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT), updates
//   the others through the 'storage' event. The check runs again when a tab
//   comes back into view, so a tab left open does not outlive the period.
// - Where storage is blocked, the answer holds in memory for this page view.
//
// index.html repeats the check in its boot script to colour the loading
// shell; src/boot-shell.test.js keeps the two in step.

import { useSyncExternalStore } from 'react';
import { STORAGE } from '../data/content.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// TODO(owner): How long should a visitor's 21+ confirmation stay valid before the site asks again (for example 30 days, or every browser session)? 30 days is a placeholder. (AW-340)
export const AGE_CONFIRMATION_DAYS = 30;
export const AGE_CONFIRMATION_MAX_AGE_MS = AGE_CONFIRMATION_DAYS * DAY_MS;
// PR #12's name for the same period.
export const AGE_VERIFIED_TTL_MS = AGE_CONFIRMATION_MAX_AGE_MS;

// TODO(owner): Should signing out clear the 21+ confirmation, so the next person on a shared computer is asked again? It does for now. (AW-340)
export const CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT = true;

// A record dated further ahead than this (a clock that was wrong, or an
// edited value) does not count.
const MAX_CLOCK_SKEW_MS = DAY_MS;
const LEGACY_VALUE = 'yes';
const DECLINED_VALUE = '1';
// PR #12 stored "No, exit" as 'yes'; a tab that answered under that build
// keeps its exit screen.
const DECLINED_VALUES = new Set([DECLINED_VALUE, 'yes']);

export const ageRecord = (at) => JSON.stringify({ ok: true, at });

// Reads a stored confirmation. Returns { confirmed, legacy }: legacy is true
// for the old undated 'yes', which no longer counts (PR #12, AW-340).
export function parseAgeRecord(raw, now = Date.now()) {
  if (raw === LEGACY_VALUE) return { confirmed: false, legacy: true };
  let data = null;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : null; } catch { /* damaged value */ }
  const at = data && data.ok === true ? data.at : NaN;
  const confirmed = Number.isFinite(at) && at <= now + MAX_CLOCK_SKEW_MS && now - at < AGE_CONFIRMATION_MAX_AGE_MS;
  return { confirmed, legacy: false };
}

// PR #12's reader: true only for a dated record within the period.
export const isAgeVerifiedValue = (raw, now = Date.now()) => parseAgeRecord(raw, now).confirmed;

// Storage access that never throws: undefined means the store is unavailable
// (blocked cookies, private modes, sandboxed frames).
function storageGet(area, key) {
  try { return window[area].getItem(key); } catch { return undefined; }
}
function storageSet(area, key, value) {
  try { window[area].setItem(key, value); return true; } catch { return false; }
}
function storageRemove(area, key) {
  try { window[area].removeItem(key); } catch { /* blocked: nothing stored */ }
}

// Answers this page view could not store.
let memoryAt = null;
let memoryDeclined = false;

function readConfirmed(now) {
  const raw = storageGet('localStorage', STORAGE.age);
  if (raw !== undefined && raw !== null) {
    if (parseAgeRecord(raw, now).confirmed) return true;
    // Expired, damaged, or the old undated 'yes': ask again.
    storageRemove('localStorage', STORAGE.age);
  }
  return memoryAt !== null && now - memoryAt < AGE_CONFIRMATION_MAX_AGE_MS;
}

const readDeclined = () => memoryDeclined || DECLINED_VALUES.has(storageGet('sessionStorage', STORAGE.ageDeclined));

// The gate's state as a small external store, read with useSyncExternalStore.
let snapshot = null;
const listeners = new Set();
const compute = () => ({ confirmed: readConfirmed(Date.now()), declined: readDeclined() });

// Keeps the same object while nothing changed (useSyncExternalStore needs a
// stable snapshot). Returns true when it changed.
function update(next) {
  if (snapshot && next.confirmed === snapshot.confirmed && next.declined === snapshot.declined) return false;
  snapshot = next;
  return true;
}

function refresh() {
  if (update(compute())) for (const listener of listeners) listener();
}

function getSnapshot() {
  // With no subscriber, no event kept the snapshot current: read storage again.
  if (!snapshot || listeners.size === 0) update(compute());
  return snapshot;
}

// { confirmed, declined } now, for code outside React.
export const ageGateState = () => getSnapshot();

// The gate is client-only: HTML rendered ahead of time (prerendering, AW-044
// step 5) carries the page, and the gate appears over it once the app runs.
const SERVER_SNAPSHOT = { confirmed: true, declined: false };
const getServerSnapshot = () => SERVER_SNAPSHOT;

function onStorage(event) {
  // key is null when another tab cleared all of this site's storage.
  if (event.key !== null && event.key !== STORAGE.age) return;
  memoryAt = null;
  refresh();
}
function onVisibilityChange() {
  if (document.visibilityState === 'visible') refresh();
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Anything that changed before this first subscriber listened.
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

// "Yes, I am 21+". The actions take no arguments, so they can be passed
// straight to onClick.
export function confirmAge() {
  const now = Date.now();
  memoryDeclined = false;
  storageRemove('sessionStorage', STORAGE.ageDeclined);
  memoryAt = storageSet('localStorage', STORAGE.age, ageRecord(now)) ? null : now;
  refresh();
}

// "No, exit": the exit screen, for the rest of this browser session.
export function declineAge() {
  memoryDeclined = !storageSet('sessionStorage', STORAGE.ageDeclined, DECLINED_VALUE);
  refresh();
}

// "Answered by mistake? Go back": the question again.
export function reconsiderAge() {
  memoryDeclined = false;
  storageRemove('sessionStorage', STORAGE.ageDeclined);
  refresh();
}

// Forgets the confirmation in every tab; the gate shows again.
export function clearAgeConfirmation() {
  memoryAt = null;
  storageRemove('localStorage', STORAGE.age);
  refresh();
}

// Called when the visitor signs out (AW-340).
export function endAgeConfirmationOnSignOut() {
  if (CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT) clearAgeConfirmation();
}

// { confirmed, declined } for this tab, kept current across tabs.
export function useAgeGate() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
