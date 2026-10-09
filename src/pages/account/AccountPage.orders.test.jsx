// Order history on /account (AW-326, AW-194, AW-344): another account
// starts from nothing and a late answer for the last one is ignored, a
// stalled request gives up after 20 s, a failed load says so in words with
// Try again, and offline says the orders load on reconnect (and they do).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS } from '../../lib/network.js';

// Each orders request waits until the test answers it, or its signal aborts
// (answered the way postgrest-js answers an aborted fetch).
const db = vi.hoisted(() => ({ requests: [] }));
vi.mock('../../lib/supabase.js', () => {
  const from = (table) => {
    const request = { table, filters: {}, signal: null, answer: null };
    const query = {
      select: (columns) => { request.columns = columns; return query; },
      eq: (column, value) => { request.filters[column] = value; return query; },
      order: () => query,
      abortSignal: (signal) => {
        request.signal = signal;
        db.requests.push(request);
        return new Promise((resolve) => {
          request.answer = resolve;
          signal.addEventListener('abort', () => resolve({ data: null, error: { message: `${signal.reason.name}: ${signal.reason.message}`, code: '' } }));
        });
      },
    };
    return query;
  };
  return { supabase: { from }, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { AccountPage, ORDER_HISTORY_ERRORS } = await import('./AccountPage.jsx');
const { ORDER_HISTORY_SELECT } = await import('./useOrderHistory.js');

const profile = (id, business) => ({ id, business, name: 'Test Buyer', email: `${id}@example.test`, status: 'approved', role: 'customer', pricing_tier: 'silver' });
const order = (id, ref) => ({ id, ref_num: ref, status: 'new', total_units: 1, subtotal: null, created_at: '2026-10-01T12:00:00Z', order_items: [] });
const last = () => db.requests[db.requests.length - 1];
const alert = () => screen.queryByRole('alert');

let logged;
beforeEach(() => {
  db.requests.length = 0;
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe('AccountPage order history', () => {
  it('asks for the account’s orders, newest first, with a time limit', () => {
    render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    expect(last()).toMatchObject({ table: 'orders', filters: { user_id: 'a' }, columns: ORDER_HISTORY_SELECT });
    expect(last().signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('starts from nothing for another account, and ignores the last account’s late answer', async () => {
    const view = render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    const forA = last();
    await act(async () => { forA.answer({ data: [order('oa1', 'ALW-O-AAAAAAAAAA')], error: null }); });
    expect(screen.getByText('ALW-O-AAAAAAAAAA')).toBeTruthy();
    // Another account on the same page (no remount).
    view.rerender(<AccountPage profile={profile('b', 'Bravo')} account="ready" />);
    expect(screen.queryByText('ALW-O-AAAAAAAAAA')).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
    const forB = last();
    expect(forB.filters.user_id).toBe('b');
    await act(async () => { forB.answer({ data: [order('ob1', 'ALW-O-BBBBBBBBBB')], error: null }); });
    expect(screen.getByText('ALW-O-BBBBBBBBBB')).toBeTruthy();
  });

  it('cancels its request when the page goes, and a late answer changes nothing', async () => {
    const view = render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    const request = last();
    view.unmount();
    expect(request.signal.aborted).toBe(true);
    await act(async () => { request.answer({ data: [order('oa1', 'ALW-O-AAAAAAAAAA')], error: null }); });
    expect(logged).not.toHaveBeenCalled();
  });

  it('says it couldn’t load the orders, logs the detail, and tries again on request', async () => {
    render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    await act(async () => { last().answer({ data: null, error: { code: 'XX000', message: 'upstream exploded' } }); });
    expect(alert().textContent).toMatch(/^We couldn’t load your orders\. Need an order now\? Call \(205\) [\d-]+ or email \S+@\S+\.Try again$/);
    expect(alert().textContent).not.toMatch(/upstream exploded/);
    expect(logged).toHaveBeenCalledWith('Order history did not load:', 'XX000 upstream exploded');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(alert()).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(db.requests).toHaveLength(2);
    await act(async () => { last().answer({ data: [order('oa1', 'ALW-O-AAAAAAAAAA')], error: null }); });
    expect(screen.getByText('ALW-O-AAAAAAAAAA')).toBeTruthy();
  });

  it('gives up on a stalled request after 20 s', async () => {
    vi.useFakeTimers();
    render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1); });
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(alert().textContent).toMatch(/^Your orders are taking too long to load\./);
    expect(ORDER_HISTORY_ERRORS.timeout).toBe('Your orders are taking too long to load.');
  });

  it('says the orders load on reconnect while offline, and loads them then', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<AccountPage profile={profile('a', 'Alpha')} account="ready" />);
    // At once, without waiting for the request's retries.
    expect(alert().textContent).toMatch(/^You’re offline\. Your orders will load when you reconnect\./);
    await act(async () => { last().answer({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }); });
    expect(alert().textContent).toMatch(/^You’re offline\./);
    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(db.requests).toHaveLength(2);
    expect(screen.getByText('Loading…')).toBeTruthy();
    await act(async () => { last().answer({ data: [], error: null }); });
    expect(screen.getByText('No orders yet')).toBeTruthy();
  });
});
