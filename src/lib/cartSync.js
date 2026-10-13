// The account's saved cart (AW-334): a signed-in buyer's cart follows the
// account to another phone or computer. Each device keeps its own copy in
// localStorage (src/lib/cartStorage.js); this module keeps the account's
// row in public.carts (supabase/migrations/20261012110000_carts.sql) in step
// with it. The row holds the line keys and quantities in their order, never
// a price.
//
// - Guests: nothing is sent; their cart stays in the browser.
// - A page load with a session: the row is read once, and whichever of the
//   row and this device's copy changed last is kept (the row's updated_at
//   against the device's savedAt). The two are never added together.
// - Signing in with lines added as a guest (adoptGuestCart in
//   cartStorage.js): the guest's lines are added to the newer of the row and
//   this device's copy of the account's cart, once, then saved.
// - After that, every change on this device (or another tab of it) is saved
//   CART_SAVE_DELAY_MS after the last one, and at once when the tab is
//   hidden. A tab that comes back into view after RECHECK_MS reads the row
//   again, so a cart changed on the phone shows on the computer's open tab.
// - Offline nothing is sent; it is retried when the browser is back online.
//   A request that fails otherwise is retried at the next change (a save) or
//   the next 'online' (a load): never in a loop.
// - Before the migration is applied the table is missing (PostgREST answers
//   PGRST205, Postgres 42P01): that one request turns syncing off for the
//   rest of the page view, and carts stay on each device as before.
//
// useCartSync({ client, userId, owner }) runs it for the signed-in account
// (App) and returns the status, also from useCartSyncStatus():
//   'off'          a guest, no backend, or not started
//   'loading'      reading the row for the first time
//   'active'       the row was read: the cart follows the account
//   'failed'       the first read failed (offline or an error); retried on
//                  'online'
//   'unavailable'  the table isn't there (until the next page load)
// The drawer and checkout say the cart follows the account only while it is
// 'active' (cartDeviceNote in src/data/terms.js).

import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';
import { REQUEST_TIMEOUT_MS, isOffline, timeoutSignal } from './network.js';
import { GUEST, mergeCarts, readCartState, sanitizeEntries, subscribeCart, takeAdoption, writeCart } from './cartStorage.js';

export const CART_SAVE_DELAY_MS = 1500;
export const RECHECK_MS = 30000;
// "No such table": PostgREST's schema cache doesn't have it, or Postgres.
export const MISSING_TABLE_CODES = ['PGRST205', '42P01'];
const TABLE = 'carts';

export const isMissingTable = (error) => MISSING_TABLE_CODES.includes(error?.code);

// ---- Status -----------------------------------------------------------------

let status = 'off';
// The table is missing: no more requests this page view.
let tableMissing = false;
const listeners = new Set();
function setStatus(next) {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}
export const cartSyncStatus = () => status;
function subscribeStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const useCartSyncStatus = () => useSyncExternalStore(subscribeStatus, cartSyncStatus, () => 'off');

// ---- The row ----------------------------------------------------------------

// The saved row as a cart state ({ cart, order, savedAt }), or null for no
// row. Its lines are checked like the device's own (sanitizeEntries).
export function serverCartState(row) {
  if (!row) return null;
  const { cart, order } = sanitizeEntries(Array.isArray(row.lines) ? row.lines : []);
  const time = Date.parse(row.updated_at);
  return { cart, order, savedAt: Number.isFinite(time) ? time : 0 };
}

// A cart state as the row's lines: [[key, quantity], …] in order.
export const rowLines = (state) => state.order.map((key) => [key, state.cart[key]]);

// Reads the account's row: { ok: true, state } (state null for no row), or
// { ok: false, missing, error }. Never throws.
export async function loadServerCart(client, userId) {
  const t = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const { data, error } = await client.from(TABLE).select('lines,updated_at').eq('user_id', userId)
      .abortSignal(t.signal).maybeSingle();
    if (error) return { ok: false, missing: isMissingTable(error), error };
    return { ok: true, state: serverCartState(data) };
  } catch (error) {
    return { ok: false, missing: false, error };
  } finally {
    t.clear();
  }
}

// Saves a cart state as the account's row (an upsert on user_id): { ok }, or
// { ok: false, missing, error }. Never throws.
export async function saveServerCart(client, userId, state) {
  const t = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const row = { user_id: userId, lines: rowLines(state), updated_at: new Date(state.savedAt).toISOString() };
    const { error } = await client.from(TABLE).upsert(row, { onConflict: 'user_id' }).abortSignal(t.signal);
    if (error) return { ok: false, missing: isMissingTable(error), error };
    return { ok: true };
  } catch (error) {
    return { ok: false, missing: false, error };
  } finally {
    t.clear();
  }
}

const sameLines = (a, b) => a.order.length === b.order.length
  && a.order.every((key, i) => key === b.order[i] && a.cart[key] === b.cart[key]);

// Which copy a page load keeps: 'server' (the row changed last), 'local'
// (this device's copy did, or there is no row yet), or 'same' (nothing to
// do: equal lines, or nothing on either side).
export function newerCart(local, server) {
  if (!server) return local.order.length ? 'local' : 'same';
  if (sameLines(local, server)) return 'same';
  if (server.savedAt > local.savedAt) return 'server';
  if (local.savedAt > server.savedAt) return 'local';
  return 'same';
}

// ---- Syncing ----------------------------------------------------------------

const hasWindow = () => typeof window !== 'undefined';

// Keeps userId's row in step with this device's cart until the returned stop
// function is called. `delay` is the wait after the last change.
export function startCartSync({ client, userId, delay = CART_SAVE_DELAY_MS }) {
  if (!client || !userId || userId === GUEST || tableMissing) {
    setStatus(tableMissing ? 'unavailable' : 'off');
    return () => {};
  }
  let stopped = false;
  let loaded = false;
  let loading = false;
  let saving = false;
  let again = false;
  let pending = false;
  let timer = null;
  let lastLoad = 0;
  // savedAt of the copy the row holds now, as far as this tab knows.
  let syncedAt = null;

  function stopListening() {
    window.clearTimeout(timer);
    timer = null;
    unsubscribe();
    if (hasWindow()) {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  }

  function tableIsMissing() {
    tableMissing = true;
    stopped = true;
    stopListening();
    setStatus('unavailable');
  }

  async function save() {
    window.clearTimeout(timer);
    timer = null;
    if (stopped || !loaded) return;
    if (isOffline()) return; // still pending: 'online' sends it
    if (saving) {
      again = true;
      return;
    }
    const state = readCartState(userId);
    if (state.savedAt === syncedAt) {
      pending = false;
      return;
    }
    saving = true;
    pending = false;
    const result = await saveServerCart(client, userId, state);
    saving = false;
    if (stopped) return;
    if (result.ok) syncedAt = state.savedAt;
    else if (result.missing) return tableIsMissing();
    else pending = true; // tried again at the next change, or 'online'
    if (again) {
      again = false;
      schedule();
    }
  }

  function schedule(ms = delay) {
    pending = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(save, ms);
  }

  async function load() {
    if (stopped || loading) return;
    if (isOffline()) return; // 'online' loads it
    loading = true;
    if (!loaded) setStatus('loading');
    const before = readCartState(userId);
    const result = await loadServerCart(client, userId);
    loading = false;
    if (stopped) return;
    if (!result.ok) {
      if (result.missing) return tableIsMissing();
      if (!loaded) setStatus('failed');
      return;
    }
    lastLoad = Date.now();
    const server = result.state;
    const local = readCartState(userId);
    // A change made on this device while the row was on its way is the
    // newest of all.
    const changedMeanwhile = local.savedAt !== before.savedAt;
    const adoption = takeAdoption(userId);
    if (adoption) {
      // Signed in with a guest cart: its lines join the row instead when the
      // row is newer than the account's copy on this device.
      const untouched = local.savedAt === adoption.after.savedAt;
      if (untouched && server && server.savedAt > adoption.before.savedAt) {
        writeCart(userId, mergeCarts(server.cart, adoption.guest.cart), { order: [...server.order, ...adoption.guest.order] });
      }
      loaded = true;
      setStatus('active');
      return save();
    }
    const pick = changedMeanwhile ? 'local' : newerCart(local, server);
    loaded = true;
    setStatus('active');
    if (pick === 'server') {
      syncedAt = server.savedAt;
      writeCart(userId, server.cart, { order: server.order, savedAt: server.savedAt });
    } else if (pick === 'local') {
      return save();
    } else {
      syncedAt = local.savedAt;
    }
    return undefined;
  }

  // A change to the cart (this tab, another tab, or the row just taken).
  const unsubscribe = subscribeCart(() => {
    if (stopped || !loaded) return;
    if (readCartState(userId).savedAt !== syncedAt) schedule();
  });

  function onOnline() {
    if (!loaded) load();
    else if (pending) save();
  }
  function onHide() {
    if (pending) save();
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') onHide();
    else if (loaded && !pending && !saving && Date.now() - lastLoad >= RECHECK_MS) load();
  }
  if (hasWindow()) {
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  load();
  return () => {
    if (stopped) return;
    stopped = true;
    stopListening();
    setStatus('off');
  };
}

// Runs startCartSync for the signed-in account whose cart is on screen
// (owner, cartOwner() in cartStorage.js, is the account once its session is
// confirmed). Returns the status.
export function useCartSync({ client = supabase, userId = null, owner = GUEST } = {}) {
  const enabled = !!client && !!userId && owner === userId;
  useEffect(() => (enabled ? startCartSync({ client, userId }) : undefined), [enabled, client, userId]);
  return useCartSyncStatus();
}

// Tests only: forgets that the table was missing, and the status.
export function resetCartSyncForTests() {
  tableMissing = false;
  status = 'off';
}
