// Admin -> Orders keeps itself current (AW-111): a Supabase Realtime
// subscription to public.orders (in the supabase_realtime publication since
// 20261010122000; Realtime applies row-level security, so only admins hear
// every order), plus a reload every minute while the tab is visible and when
// it becomes visible again. Realtime is silent on a database without that
// migration, so the minute's reload is what keeps the live site current
// until then. Several changes in a row (an order and its lines) cause one
// reload.

import { useEffect, useRef } from 'react';

export const POLL_MS = 60000;
export const REALTIME_DEBOUNCE_MS = 500;
export const ORDERS_CHANNEL = 'admin-orders';

// Subscribes to every change of public.orders; returns the unsubscribe. A
// client with ready() (src/pages/admin/realtime.js, AW-179) is waited for,
// so the channel joins with the admin's token.
export function subscribeOrders(client, onChange, { debounceMs = REALTIME_DEBOUNCE_MS } = {}) {
  if (typeof client?.channel !== 'function') return () => {};
  let timer = null;
  let stopped = false;
  const changed = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  };
  let channel = null;
  const start = () => {
    if (stopped) return;
    try {
      channel = client
        .channel(ORDERS_CHANNEL)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, changed)
        .subscribe();
    } catch {
      channel = null;
    }
  };
  if (typeof client.ready === 'function') Promise.resolve(client.ready()).then(start, start);
  else start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    if (!channel) return;
    try {
      Promise.resolve(client.removeChannel(channel)).catch(() => {});
    } catch {
      // Already gone.
    }
  };
}

// Calls the latest `reload` on every change, every pollMs while the tab is
// visible, and when the tab becomes visible.
export function useLiveOrders(reload, { client, pollMs = POLL_MS, debounceMs = REALTIME_DEBOUNCE_MS } = {}) {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  });
  useEffect(() => {
    const run = () => latest.current?.();
    const unsubscribe = subscribeOrders(client, run, { debounceMs });
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') run();
    }, pollMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [client, pollMs, debounceMs]);
}
