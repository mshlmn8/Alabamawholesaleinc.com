// The signed-in buyer's prices for the whole app (AW-003, AW-351). One
// PricesProvider, mounted in main.jsx inside the AuthProvider and the
// CatalogProvider, loads them with loadPrices() (src/lib/pricing.js) and
// keeps them current; App reads them with usePrices().
//
// Only an approved account asks for prices. Guests, pending and suspended
// accounts make no price request at all, and see none. Prices load again when
// the account, its tier or its status changes, and whenever the catalog loads
// again (so an admin's price edit reaches open tabs with the catalog's, and a
// checkout re-check sees it, AW-191).
//
// usePrices() returns:
//   prices      null, or normalizePrices()' { tier, tierLabel, discountPct, byId }
//   status      'off'      no approved account is signed in (or no backend)
//               'loading'  the first load for this account is running
//               'ready'    loaded (a refresh may be running)
//               'error'    the last load failed; prices are the last ones
//                          loaded for this account, or null
//   error       the last failure, or null
//   source      'rpc' (my_prices) | 'legacy' (a database without it) | null
//   refreshing  a load is running
//   refresh()   loads them again; resolves to { ok, prices, error }. Calls made
//               while a load runs share it. With no approved account it
//               resolves at once to { ok: true, prices: null }. A load gives
//               up after REQUEST_TIMEOUT_MS (AW-194), so checkout's re-check
//               never waits on a stalled network for good.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as defaultClient } from './supabase.js';
import { useAuth } from './auth.jsx';
import { useCatalog } from './catalog.jsx';
import { loadPrices } from './pricing.js';
import { REQUEST_TIMEOUT_MS, timeoutSignal } from './network.js';

const EMPTY = Object.freeze({ for: null, prices: null, status: 'off', error: null, source: null, refreshing: false });
const NONE = Object.freeze({ ok: true, prices: null, error: null });
const ACCOUNT_CHANGED = Object.freeze({ ok: false, prices: null, error: Object.freeze({ message: 'The account changed while its prices loaded.' }) });

// Which account the prices are for: null unless an approved account is
// signed in. A change of account, tier or status loads them again.
export function pricesKey(client, { account, profile }) {
  if (!client || account !== 'ready' || profile?.status !== 'approved') return null;
  return `${profile.id}|${profile.pricing_tier ?? ''}|${profile.status}`;
}

export const PricesContext = createContext(null);

export function PricesProvider({ client = defaultClient, children }) {
  const { account, profile } = useAuth();
  const { lastLoadedAt } = useCatalog();
  const key = pricesKey(client, { account, profile });

  const [state, setState] = useState(EMPTY);
  // Signed out, or no longer approved: forget the last account's prices.
  if (!key && state !== EMPTY) setState(EMPTY);

  // Read by the load callback and event handlers only.
  const keyRef = useRef(key);
  const profileRef = useRef(profile);
  const statusRef = useRef(state.status);
  const inflightRef = useRef(null); // { key, promise }
  useEffect(() => {
    keyRef.current = key;
    profileRef.current = profile;
    statusRef.current = state.status;
  });

  const refresh = useCallback(() => {
    const forKey = keyRef.current;
    if (!client || !forKey) return Promise.resolve(NONE);
    if (inflightRef.current?.key === forKey) return inflightRef.current.promise;
    setState((prev) => (prev.for === forKey
      ? { ...prev, refreshing: true }
      : { for: forKey, prices: null, status: 'loading', error: null, source: null, refreshing: true }));
    const t = timeoutSignal(REQUEST_TIMEOUT_MS);
    const promise = loadPrices(client, { profile: profileRef.current, signal: t.signal }).then((result) => {
      t.clear();
      if (inflightRef.current?.promise === promise) inflightRef.current = null;
      // Another account (or tier) by now: these prices are not its prices.
      if (keyRef.current !== forKey) return ACCOUNT_CHANGED;
      setState((prev) => {
        if (result.ok) return { for: forKey, prices: result.prices, status: 'ready', error: null, source: result.source, refreshing: false };
        // A failed refresh keeps the prices already on screen.
        const kept = prev.for === forKey ? prev.prices : null;
        return { for: forKey, prices: kept, status: 'error', error: result.error, source: prev.for === forKey ? prev.source : null, refreshing: false };
      });
      return result.ok ? { ok: true, prices: result.prices, error: null } : { ok: false, prices: null, error: result.error };
    });
    inflightRef.current = { key: forKey, promise };
    return promise;
  }, [client]);

  // The first load for an account, and a reload each time the catalog loads.
  useEffect(() => {
    if (key) refresh();
  }, [key, lastLoadedAt, refresh]);

  // After a failed load: try again when the connection or the tab comes back.
  useEffect(() => {
    if (!key) return undefined;
    const retry = () => {
      if (statusRef.current === 'error' && document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [key, refresh]);

  const current = key && state.for === key ? state : null;
  let status = 'off';
  if (key) status = current ? current.status : 'loading';
  const prices = current ? current.prices : null;
  const error = current ? current.error : null;
  const source = current ? current.source : null;
  const refreshing = !!current?.refreshing;

  const value = useMemo(() => ({ prices, status, error, source, refreshing, refresh }), [prices, status, error, source, refreshing, refresh]);
  return <PricesContext.Provider value={value}>{children}</PricesContext.Provider>;
}

export function usePrices() {
  const value = useContext(PricesContext);
  if (!value) throw new Error('usePrices() needs a <PricesProvider> above it (see src/main.jsx).');
  return value;
}
