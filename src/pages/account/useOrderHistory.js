// The signed-in buyer's order history for /account (AW-326, AW-194).
//
// orderHistoryQuery() is the one place the query is built; add columns or
// paging there. useOrderHistory(profileId) loads it and returns
//   orders   the rows, newest first, or null while loading
//   error    null | 'offline' | 'timeout' | 'failed'
//   reload() tries again (the page's Try again)
// Another account starts from nothing, so its orders never show the last
// one's; a late answer for an account (or a page) that has gone is ignored;
// a request gives up after REQUEST_TIMEOUT_MS; a load that failed is tried
// again when the connection comes back. Offline before anything loaded, the
// error is 'offline' at once, without waiting for the request's retries.

import { useEffect, useState } from 'react';
import { supabase as defaultClient } from '../../lib/supabase.js';
import { REQUEST_TIMEOUT_MS, isOffline, isTimeoutError, timeoutSignal } from '../../lib/network.js';
import { useOnlineStatus } from '../../lib/useOnlineStatus.js';

export const ORDER_HISTORY_SELECT = 'id, ref_num, status, total_units, subtotal, created_at, order_items(id, product_id, variant, product_name, sku, qty, unit_price)';

export function orderHistoryQuery(client, profileId) {
  return client
    .from('orders')
    .select(ORDER_HISTORY_SELECT)
    .eq('user_id', profileId)
    .order('created_at', { ascending: false });
}

const failureOf = (error) => {
  if (isOffline()) return 'offline';
  return isTimeoutError(error) ? 'timeout' : 'failed';
};

export function useOrderHistory(profileId, { client = defaultClient } = {}) {
  const online = useOnlineStatus();
  const [state, setState] = useState({ for: profileId, orders: null, error: null, attempt: 0 });
  // Another account: nothing of the last one's stays on screen.
  let current = state;
  if (state.for !== profileId) {
    current = { for: profileId, orders: null, error: null, attempt: state.attempt };
    setState(current);
  }
  // Back online after a failed load: try again.
  const [wasOnline, setWasOnline] = useState(online);
  if (wasOnline !== online) {
    setWasOnline(online);
    if (online && current.error) {
      current = { ...current, error: null, attempt: current.attempt + 1 };
      setState(current);
    }
  }

  const { attempt } = current;
  useEffect(() => {
    if (!client || !profileId) return undefined;
    let cancelled = false;
    const t = timeoutSignal(REQUEST_TIMEOUT_MS);
    (async () => {
      let result;
      try {
        result = await orderHistoryQuery(client, profileId).abortSignal(t.signal);
      } catch (error) {
        result = { data: null, error };
      } finally {
        t.clear();
      }
      if (cancelled) return;
      if (result?.error) {
        // The database's own words, for the console only: they name no buyer.
        console.error('Order history did not load:', [result.error.code, result.error.message || String(result.error)].filter(Boolean).join(' '));
        setState((prev) => (prev.for === profileId ? { ...prev, error: failureOf(result.error) } : prev));
      } else {
        setState((prev) => (prev.for === profileId ? { ...prev, orders: result?.data || [], error: null } : prev));
      }
    })();
    return () => {
      cancelled = true;
      t.abort();
    };
  }, [client, profileId, attempt]);

  const reload = () => setState((prev) => ({ ...prev, error: null, attempt: prev.attempt + 1 }));
  const error = current.error || (!online && current.orders === null ? 'offline' : null);
  return { orders: current.orders, error, reload };
}
