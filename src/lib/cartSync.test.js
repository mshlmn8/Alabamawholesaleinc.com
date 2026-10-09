// The account's saved cart (AW-334) against a fake Supabase client: guests
// and a missing table send nothing more, the newer copy wins on load and
// the two are never added together, a guest cart joins the newer copy once
// at sign-in, and saves wait for the last change.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../pages/admin/fakeSupabase.js';
import { GUEST, adoptGuestCart, readCartState, resetCartStoreForTests, updateCart, writeCart } from './cartStorage.js';
import {
  CART_SAVE_DELAY_MS, RECHECK_MS, cartSyncStatus, newerCart, resetCartSyncForTests, serverCartState, startCartSync, useCartSync,
} from './cartSync.js';

const A = '11111111-2222-4333-8444-555555555555';
const T0 = Date.parse('2026-10-12T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

const fake = createFakeSupabase();
const cartCalls = () => fake.calls.filter((c) => c.table === 'carts');
const reads = () => cartCalls().filter((c) => c.op === 'select');
const saves = () => cartCalls().filter((c) => c.op === 'upsert');
// Lets the fake's answers (promises) and any due timers run.
const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
const state = (owner = A) => readCartState(owner);
const lines = (owner = A) => state(owner).order.map((key) => [key, state(owner).cart[key]]);

let stop = () => {};
const start = (options = {}) => {
  stop = startCartSync({ client: fake.client, userId: A, ...options });
  return stop;
};
// The account's row, as the database would answer it.
const row = (rowLines, at) => ({ user_id: A, lines: rowLines, updated_at: iso(at) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  window.localStorage.clear();
  resetCartStoreForTests();
  resetCartSyncForTests();
  fake.reset();
});
afterEach(() => {
  stop();
  stop = () => {};
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetCartStoreForTests();
  resetCartSyncForTests();
});

describe('newerCart', () => {
  const local = (entries, savedAt) => ({ ...serverCartState({ lines: entries, updated_at: iso(1) }), savedAt });
  it('keeps the copy that changed last, and does nothing when they agree', () => {
    expect(newerCart(local([['14', 1]], 5), null)).toBe('local');
    expect(newerCart(local([], 5), null)).toBe('same');
    expect(newerCart(local([['14', 1]], 5), local([['45', 1]], 9))).toBe('server');
    expect(newerCart(local([['14', 1]], 9), local([['45', 1]], 5))).toBe('local');
    expect(newerCart(local([['14', 1]], 9), local([['14', 1]], 5))).toBe('same');
    expect(newerCart(local([['14', 1]], 5), local([['45', 1]], 5))).toBe('same');
  });

  it('reads a row’s lines like the device’s own: no prices, no strangers', () => {
    expect(serverCartState({ lines: [['174', 1], ['14', 2, 9.99], ['x', 1], ['14', '3']], updated_at: iso(T0) }))
      .toEqual({ cart: { 174: 1, 14: 3 }, order: ['174', '14'], savedAt: T0 });
    expect(serverCartState({ lines: 'all', updated_at: 'soon' })).toEqual({ cart: {}, order: [], savedAt: 0 });
    expect(serverCartState(null)).toBeNull();
  });
});

describe('startCartSync (AW-334)', () => {
  it('sends nothing for a guest or without a client', async () => {
    startCartSync({ client: fake.client, userId: null });
    startCartSync({ client: fake.client, userId: GUEST });
    startCartSync({ client: null, userId: A });
    await settle(5000);
    expect(fake.calls).toEqual([]);
    expect(cartSyncStatus()).toBe('off');
  });

  it('makes one request when the table is missing, then nothing for the rest of the page view', async () => {
    fake.respond = (req) => (req.table === 'carts'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.carts' in the schema cache" } }
      : undefined);
    writeCart(A, { 14: 1 });
    start();
    await settle();
    expect(cartCalls()).toHaveLength(1);
    expect(cartSyncStatus()).toBe('unavailable');
    // Changes, another start (a sign-in again), going online: nothing more.
    updateCart(A, (c) => ({ ...c, 45: 1 }));
    await settle(CART_SAVE_DELAY_MS * 2);
    stop();
    start();
    window.dispatchEvent(new Event('online'));
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(cartCalls()).toHaveLength(1);
    expect(cartSyncStatus()).toBe('unavailable');
  });

  it('treats Postgres’s 42P01 the same, also when it answers a save', async () => {
    let n = 0;
    fake.respond = (req) => {
      if (req.table !== 'carts') return undefined;
      n += 1;
      return n === 1 ? { data: null, error: null } : { data: null, error: { code: '42P01', message: 'relation "public.carts" does not exist' } };
    };
    writeCart(A, { 14: 1 });
    start();
    await settle();
    expect(cartCalls().map((c) => c.op)).toEqual(['select', 'upsert']);
    expect(cartSyncStatus()).toBe('unavailable');
    updateCart(A, (c) => ({ ...c, 14: 2 }));
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(cartCalls()).toHaveLength(2);
  });

  it('takes the saved cart when it changed last, in its order, and never adds the two together', async () => {
    vi.setSystemTime(T0 - 60000);
    writeCart(A, { 14: 1 });
    vi.setSystemTime(T0);
    fake.tables.carts = [row([['45', 2], ['1::red', 1]], T0 - 1000)];
    start();
    await settle();
    expect(reads()).toHaveLength(1);
    expect(reads()[0].filters).toEqual([['eq', 'user_id', A]]);
    expect(lines()).toEqual([['45', 2], ['1::red', 1]]);
    expect(state().savedAt).toBe(T0 - 1000);
    expect(cartSyncStatus()).toBe('active');
    // Taking it is not a change to save back.
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(saves()).toHaveLength(0);
  });

  it('saves this device’s copy when it changed last, or when there is no row yet', async () => {
    writeCart(A, { 174: 1, 14: 2 }, { order: ['174', '14'] });
    fake.tables.carts = [row([['45', 2]], T0 - 60000)];
    start();
    await settle();
    expect(saves()).toHaveLength(1);
    expect(saves()[0].rows).toEqual({ user_id: A, lines: [['174', 1], ['14', 2]], updated_at: iso(state().savedAt) });
    expect(saves()[0].options).toEqual({ onConflict: 'user_id' });
    expect(lines()).toEqual([['174', 1], ['14', 2]]);
    stop();

    fake.reset();
    resetCartStoreForTests();
    window.localStorage.clear();
    writeCart(A, { 14: 2 });
    start();
    await settle();
    expect(saves().map((s) => s.rows.lines)).toEqual([[['14', 2]]]);
  });

  it('sends nothing more when both copies hold the same lines, or neither has any', async () => {
    fake.tables.carts = [];
    start();
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(cartCalls().map((c) => c.op)).toEqual(['select']);
    expect(cartSyncStatus()).toBe('active');
  });

  it('saves CART_SAVE_DELAY_MS after the last change, once, with the lines as they are then', async () => {
    fake.tables.carts = [];
    start();
    await settle();
    updateCart(A, (c) => ({ ...c, 14: 1 }));
    await settle(1000);
    updateCart(A, (c) => ({ ...c, 45: 1 }));
    await settle(1000);
    updateCart(A, (c) => ({ ...c, 14: 3 }));
    await settle(CART_SAVE_DELAY_MS - 1);
    expect(saves()).toHaveLength(0);
    await settle(1);
    expect(saves()).toHaveLength(1);
    expect(saves()[0].rows.lines).toEqual([['14', 3], ['45', 1]]);
    // Nothing new: nothing sent.
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(saves()).toHaveLength(1);
  });

  it('saves a waiting change at once when the tab is hidden', async () => {
    fake.tables.carts = [];
    start();
    await settle();
    updateCart(A, (c) => ({ ...c, 14: 1 }));
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(saves()).toHaveLength(1);
  });

  it('keeps a change made while the saved cart was loading', async () => {
    let answer;
    fake.respond = (req) => (req.table === 'carts' && req.op === 'select'
      ? new Promise((resolve) => { answer = resolve; })
      : undefined);
    writeCart(A, { 14: 1 });
    start();
    await settle();
    expect(cartSyncStatus()).toBe('loading');
    vi.setSystemTime(T0 + 5000);
    updateCart(A, (c) => ({ ...c, 174: 1 }));
    // The row is newer than the device's copy was, but the buyer just changed it.
    answer({ data: row([['45', 9]], T0 + 1000), error: null });
    await settle();
    expect(lines()).toEqual([['14', 1], ['174', 1]]);
    expect(saves().map((s) => s.rows.lines)).toEqual([[['14', 1], ['174', 1]]]);
  });

  it('waits for the connection: offline nothing is sent, and it loads once back online', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    writeCart(A, { 14: 1 });
    start();
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(fake.calls).toEqual([]);
    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(cartCalls().map((c) => c.op)).toEqual(['select', 'upsert']);
  });

  it('retries a failed first read only when back online, never in a loop', async () => {
    let fail = true;
    fake.respond = (req) => (req.table === 'carts' && fail ? { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } } : undefined);
    start();
    await settle(RECHECK_MS * 2);
    expect(reads()).toHaveLength(1);
    expect(cartSyncStatus()).toBe('failed');
    // Changes aren't saved over a row it hasn't seen.
    updateCart(A, (c) => ({ ...c, 14: 1 }));
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(saves()).toHaveLength(0);
    fail = false;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(reads()).toHaveLength(2);
    expect(cartSyncStatus()).toBe('active');
    expect(saves().map((s) => s.rows.lines)).toEqual([[['14', 1]]]);
  });

  it('retries a failed save at the next change', async () => {
    let failSave = true;
    fake.tables.carts = [];
    fake.respond = (req) => (req.table === 'carts' && req.op === 'upsert' && failSave ? { data: null, error: { code: '500', message: 'boom' } } : undefined);
    start();
    await settle();
    updateCart(A, (c) => ({ ...c, 14: 1 }));
    await settle(CART_SAVE_DELAY_MS * 4);
    expect(saves()).toHaveLength(1);
    failSave = false;
    updateCart(A, (c) => ({ ...c, 14: 2 }));
    await settle(CART_SAVE_DELAY_MS);
    expect(saves()).toHaveLength(2);
    expect(saves()[1].rows.lines).toEqual([['14', 2]]);
  });

  it('reads the row again when the tab comes back into view a while later', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    fake.tables.carts = [row([['14', 1]], T0 - 1000)];
    start();
    await settle();
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(reads()).toHaveLength(1);
    // Another device changes the cart; this tab comes back later.
    fake.tables.carts = [row([['14', 1], ['45', 3]], T0 + 10000)];
    await settle(RECHECK_MS);
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(reads()).toHaveLength(2);
    expect(lines()).toEqual([['14', 1], ['45', 3]]);
    expect(saves()).toHaveLength(0);
  });

  it('stops when the buyer signs out: nothing is sent after', async () => {
    fake.tables.carts = [];
    start();
    await settle();
    stop();
    expect(cartSyncStatus()).toBe('off');
    updateCart(A, (c) => ({ ...c, 14: 1 }));
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(saves()).toHaveLength(0);
  });
});

describe('signing in with a guest cart (AW-334, AW-189)', () => {
  it('adds the guest’s lines to the saved cart when it is newer than this device’s copy, once', async () => {
    vi.setSystemTime(T0 - 60000);
    writeCart(A, { 14: 1 });
    vi.setSystemTime(T0);
    writeCart(GUEST, { 174: 1, 14: 2 }, { order: ['174', '14'] });
    fake.tables.carts = [row([['45', 2], ['14', 1]], T0 - 1000)];
    adoptGuestCart(A);
    start();
    await settle();
    expect(lines()).toEqual([['45', 2], ['14', 3], ['174', 1]]);
    expect(saves().map((s) => s.rows.lines)).toEqual([[['45', 2], ['14', 3], ['174', 1]]]);
    expect(state(GUEST).order).toEqual([]);
    // A second start (the tab signs in again) doesn't add them again.
    stop();
    start();
    await settle(CART_SAVE_DELAY_MS * 2);
    expect(lines()).toEqual([['45', 2], ['14', 3], ['174', 1]]);
  });

  it('keeps this device’s copy with the guest’s lines when the saved cart is older', async () => {
    writeCart(A, { 14: 1 });
    writeCart(GUEST, { 174: 1 });
    fake.tables.carts = [row([['45', 2]], T0 - 60000)];
    adoptGuestCart(A);
    start();
    await settle();
    expect(lines()).toEqual([['14', 1], ['174', 1]]);
    expect(saves().map((s) => s.rows.lines)).toEqual([[['14', 1], ['174', 1]]]);
  });
});

describe('useCartSync', () => {
  it('runs for the signed-in account whose cart is on screen, and stops on sign-out', async () => {
    fake.tables.carts = [];
    const { result, rerender, unmount } = renderHook((props) => useCartSync({ client: fake.client, ...props }), {
      initialProps: { userId: null, owner: GUEST },
    });
    await settle();
    expect(fake.calls).toEqual([]);
    expect(result.current).toBe('off');
    // The saved session's account while its session is checked: not yet.
    rerender({ userId: null, owner: A });
    await settle();
    expect(fake.calls).toEqual([]);
    rerender({ userId: A, owner: A });
    await settle();
    expect(reads()).toHaveLength(1);
    expect(result.current).toBe('active');
    rerender({ userId: null, owner: GUEST });
    await settle();
    expect(result.current).toBe('off');
    unmount();
  });
});
