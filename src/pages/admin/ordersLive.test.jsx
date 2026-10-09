// Orders that keep themselves current and mark what's new (AW-111): the
// Realtime subscription and its cleanup, the minute's reload while the tab is
// visible, the visit marker (with its in-memory fallback, never
// localStorage), and the header's count.
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import { ORDERS_CHANNEL, POLL_MS, REALTIME_DEBOUNCE_MS, subscribeOrders, useLiveOrders } from './liveOrders.js';
import {
  countUnseen, firstOrdersView, isNewSince, markOrdersSeen, onOrdersActivity, ordersActivity, resetOrdersSeenForTests, useOrdersSeen,
} from './ordersSeen.js';
import { UNSEEN_POLL_MS, useAdminUnseen } from './useAdminUnseen.js';

let fake;
const setVisibility = (value) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
};
beforeEach(() => {
  fake = createFakeSupabase();
  resetOrdersSeenForTests();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Realtime', () => {
  it('subscribes to every change of public.orders, debounces, and removes the channel', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const stop = subscribeOrders(fake.client, onChange);
    expect(fake.channels).toHaveLength(1);
    const [channel] = fake.channels;
    expect(channel.name).toBe(ORDERS_CHANNEL);
    expect(channel.handlers).toHaveLength(1);
    const [event, filter, handler] = channel.handlers[0];
    expect(event).toBe('postgres_changes');
    expect(filter).toEqual({ event: '*', schema: 'public', table: 'orders' });
    // An order and its lines arrive together: one reload.
    handler({ eventType: 'INSERT' });
    handler({ eventType: 'UPDATE' });
    vi.advanceTimersByTime(REALTIME_DEBOUNCE_MS);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(fake.channels).toHaveLength(0);
    handler({ eventType: 'UPDATE' });
    vi.advanceTimersByTime(REALTIME_DEBOUNCE_MS);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a client that has channels', () => {
    expect(() => subscribeOrders(null, () => {})()).not.toThrow();
    expect(() => subscribeOrders({ channel: () => { throw new Error('closed'); } }, () => {})()).not.toThrow();
  });

  it('reloads on a change, every minute while visible, and when the tab comes back; cleans up on unmount', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const { unmount } = renderHook(() => useLiveOrders(reload, { client: fake.client }));
    expect(fake.channels).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(POLL_MS); });
    expect(reload).toHaveBeenCalledTimes(1);
    setVisibility('hidden');
    act(() => { vi.advanceTimersByTime(POLL_MS * 2); });
    expect(reload).toHaveBeenCalledTimes(1);
    act(() => { setVisibility('visible'); });
    expect(reload).toHaveBeenCalledTimes(2);
    act(() => { fake.channels[0].handlers[0][2]({}); vi.advanceTimersByTime(REALTIME_DEBOUNCE_MS); });
    expect(reload).toHaveBeenCalledTimes(3);
    unmount();
    expect(fake.channels).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(POLL_MS); setVisibility('visible'); });
    expect(reload).toHaveBeenCalledTimes(3);
    expect(POLL_MS).toBe(60000);
  });
});

describe('new since the last visit', () => {
  it('uses the previous visit admin_mark_orders_seen returns, and tells the header', async () => {
    fake.rpcData.admin_mark_orders_seen = '2026-10-08T14:00:00Z';
    const heard = vi.fn();
    onOrdersActivity(heard);
    expect(await markOrdersSeen(fake.client)).toEqual({ since: '2026-10-08T14:00:00Z', stored: true });
    expect(fake.find({ kind: 'rpc', name: 'admin_mark_orders_seen' })).toHaveLength(1);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(isNewSince({ created_at: '2026-10-08T15:00:00Z' }, '2026-10-08T14:00:00Z')).toBe(true);
    expect(isNewSince({ created_at: '2026-10-08T13:00:00Z' }, '2026-10-08T14:00:00Z')).toBe(false);
    expect(isNewSince({ created_at: '2026-10-08T15:00:00Z' }, null)).toBe(false);
    expect(isNewSince({ created_at: 'later' }, '2026-10-08T14:00:00Z')).toBe(false);
  });

  it('counts from the first view in this tab on the first visit ever', async () => {
    fake.rpcData.admin_mark_orders_seen = null;
    const first = await markOrdersSeen(fake.client);
    expect(first.stored).toBe(true);
    expect(first.since).toBe(firstOrdersView());
  });

  it('falls back to the first Orders view in this tab, in memory only, when the function is missing', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    fake.respond = (request) => (request.name === 'admin_mark_orders_seen' ? { data: null, error: { code: 'PGRST202', message: 'missing' } } : undefined);
    const first = await markOrdersSeen(fake.client);
    expect(first.stored).toBe(false);
    expect(Date.parse(first.since)).toBeGreaterThan(Date.now() - 5000);
    const again = await markOrdersSeen(fake.client);
    expect(again.since).toBe(first.since);
    // The missing function is asked for once.
    expect(fake.find({ kind: 'rpc', name: 'admin_mark_orders_seen' })).toHaveLength(1);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('marks a visit each time Orders becomes active', async () => {
    fake.rpcData.admin_mark_orders_seen = '2026-10-08T14:00:00Z';
    const { result, rerender } = renderHook(({ active }) => useOrdersSeen(active, fake.client), { initialProps: { active: true } });
    await act(async () => {});
    expect(result.current).toBe('2026-10-08T14:00:00Z');
    rerender({ active: false });
    expect(result.current).toBeNull();
    fake.rpcData.admin_mark_orders_seen = '2026-10-08T16:00:00Z';
    rerender({ active: true });
    await act(async () => {});
    expect(result.current).toBe('2026-10-08T16:00:00Z');
    expect(fake.find({ kind: 'rpc', name: 'admin_mark_orders_seen' })).toHaveLength(2);
  });
});

describe('the header’s count', () => {
  it('counts the orders placed after this admin’s stored visit', async () => {
    fake.tables.admin_order_views = [{ admin_id: 'a1', seen_at: '2026-10-08T16:00:00Z' }];
    fake.respond = (request) => (request.table === 'orders' ? { data: null, error: null, count: 3 } : undefined);
    expect(await countUnseen(fake.client, 'a1')).toBe(3);
    const [view, orders] = fake.calls;
    expect(view).toMatchObject({ table: 'admin_order_views', columns: 'seen_at', filters: [['eq', 'admin_id', 'a1']], single: 'maybe' });
    expect(orders).toMatchObject({ table: 'orders', columns: 'id', options: { count: 'exact', head: true }, filters: [['gt', 'created_at', '2026-10-08T16:00:00Z']] });
  });

  it('is 0 before the first visit, and unknown (no badge) without the table', async () => {
    expect(await countUnseen(fake.client, 'a1')).toBe(0);
    fake.respond = (request) => (request.table === 'admin_order_views' ? { data: null, error: { code: 'PGRST205', message: 'missing' } } : undefined);
    expect(await countUnseen(fake.client, 'a1')).toBeNull();
    fake.calls.length = 0;
    // Not asked again once the table is known to be missing.
    expect(await countUnseen(fake.client, 'a1')).toBeNull();
    expect(fake.calls).toHaveLength(0);
    expect(await countUnseen(fake.client, null)).toBeNull();
  });

  it('useAdminUnseen counts at once, every minute while visible, and when Orders marks a visit', async () => {
    vi.useFakeTimers();
    let count = 2;
    fake.tables.admin_order_views = [{ admin_id: 'a1', seen_at: '2026-10-08T16:00:00Z' }];
    fake.respond = (request) => (request.table === 'orders' ? { data: null, error: null, count } : undefined);
    const { result, rerender } = renderHook(({ id }) => useAdminUnseen(id, fake.client), { initialProps: { id: 'a1' } });
    await act(async () => {});
    expect(result.current).toBe(2);
    count = 5;
    await act(async () => { vi.advanceTimersByTime(UNSEEN_POLL_MS); });
    expect(result.current).toBe(5);
    count = 0;
    await act(async () => { ordersActivity(); });
    expect(result.current).toBe(0);
    // Not an admin (or signed out): nothing, and no requests.
    fake.calls.length = 0;
    rerender({ id: null });
    await act(async () => { vi.advanceTimersByTime(UNSEEN_POLL_MS); });
    expect(result.current).toBe(0);
    expect(fake.calls).toHaveLength(0);
  });

  it('the badge says the count to screen readers', async () => {
    const { AdminUnseenBadge } = await import('../../components/AdminUnseenBadge.jsx');
    const { container, rerender } = render(<a href="/admin">Admin<AdminUnseenBadge count={2} /></a>);
    expect(container.textContent).toBe('Admin2 (2 new orders)');
    expect(container.querySelector('.admin-unseen').getAttribute('aria-hidden')).toBe('true');
    rerender(<a href="/admin">Admin<AdminUnseenBadge count={1} /></a>);
    expect(container.querySelector('.sr-only').textContent).toBe(' (1 new order)');
    rerender(<a href="/admin">Admin<AdminUnseenBadge count={0} /></a>);
    expect(container.textContent).toBe('Admin');
  });
});
