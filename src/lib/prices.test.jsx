// The prices provider (AW-003, AW-351): only approved accounts ask for
// prices; a change of account, tier or status, or a new catalog load, loads
// them again; refresh() is what checkout uses (AW-191). Amounts are test values.
import { StrictMode, useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './auth.jsx';
import { CatalogContext } from './catalog.jsx';
import { PricesProvider, pricesKey, usePrices } from './prices.jsx';
import { priceFor } from './pricing.js';

const APPROVED = { id: 'u1', status: 'approved', pricing_tier: 'silver' };
const payload = (unit) => ({ tier: 'silver', tier_label: 'Test silver', discount_pct: 5, products: { 1: { list: 10.10, unit, variants: {} } } });

// supabase-js's rpc(): `answer()` gives each response (or a promise of one).
function fakeClient(answer = () => ({ data: payload(9.60), error: null })) {
  const client = {
    calls: 0,
    rpc: vi.fn(() => {
      const b = {
        abortSignal() { return b; },
        then(resolve, reject) {
          client.calls += 1;
          return Promise.resolve().then(answer).then(resolve, reject);
        },
      };
      return b;
    }),
    from: vi.fn(() => { throw new Error('the legacy path should not run'); }),
  };
  return client;
}

let seen = null;
function Spy() {
  const value = usePrices();
  useEffect(() => { seen = value; });
  return null;
}

function mount(client, { account = 'ready', profile = APPROVED, lastLoadedAt = 1, strict = false } = {}) {
  let auth = { account, profile };
  let catalog = { lastLoadedAt };
  const ui = () => {
    const tree = (
      <AuthContext.Provider value={auth}>
        <CatalogContext.Provider value={catalog}>
          <PricesProvider client={client}><Spy /></PricesProvider>
        </CatalogContext.Provider>
      </AuthContext.Provider>
    );
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  const view = render(ui());
  return {
    setAuth(changes) { auth = { ...auth, ...changes }; view.rerender(ui()); },
    setCatalog(changes) { catalog = { ...catalog, ...changes }; view.rerender(ui()); },
  };
}

beforeEach(() => {
  seen = null;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  delete document.visibilityState;
});

describe('pricesKey', () => {
  it('is set only for a signed-in approved account with a backend', () => {
    expect(pricesKey({}, { account: 'ready', profile: APPROVED })).toBe('u1|silver|approved');
    expect(pricesKey(null, { account: 'ready', profile: APPROVED })).toBeNull();
    expect(pricesKey({}, { account: 'loading', profile: APPROVED })).toBeNull();
    expect(pricesKey({}, { account: 'ready', profile: { ...APPROVED, status: 'pending' } })).toBeNull();
    expect(pricesKey({}, { account: 'ready', profile: { ...APPROVED, status: 'suspended' } })).toBeNull();
    expect(pricesKey({}, { account: 'signed-out', profile: null })).toBeNull();
  });
});

describe('PricesProvider', () => {
  it('asks nothing for guests, pending and suspended accounts', async () => {
    for (const auth of [
      { account: 'signed-out', profile: null },
      { account: 'loading', profile: null },
      { account: 'ready', profile: { ...APPROVED, status: 'pending' } },
      { account: 'ready', profile: { ...APPROVED, status: 'suspended' } },
    ]) {
      const client = fakeClient();
      mount(client, auth);
      expect(seen).toMatchObject({ status: 'off', prices: null });
      await expect(seen.refresh()).resolves.toEqual({ ok: true, prices: null, error: null });
      expect(client.rpc).not.toHaveBeenCalled();
    }
  });

  it('loads an approved buyer’s prices once, also under StrictMode', async () => {
    const client = fakeClient();
    mount(client, { strict: true });
    expect(seen).toMatchObject({ status: 'loading', prices: null });
    await waitFor(() => expect(seen.status).toBe('ready'));
    expect(seen.source).toBe('rpc');
    expect(priceFor(seen.prices, 1)).toEqual({ list: 10.10, unit: 9.60 });
    expect(client.calls).toBe(1);
  });

  it('loads again when the catalog loads again, keeping the prices on screen meanwhile', async () => {
    let unit = 9.60;
    const client = fakeClient(() => ({ data: payload(unit), error: null }));
    const view = mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    unit = 9.50;
    view.setCatalog({ lastLoadedAt: 2 });
    expect(priceFor(seen.prices, 1).unit).toBe(9.60);
    await waitFor(() => expect(priceFor(seen.prices, 1).unit).toBe(9.50));
    expect(seen.status).toBe('ready');
    expect(client.calls).toBe(2);
  });

  it('loads again for another account or tier, never showing the last one’s prices, and forgets them at sign-out', async () => {
    const client = fakeClient();
    const view = mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    view.setAuth({ profile: { ...APPROVED, pricing_tier: 'gold' } });
    expect(seen).toMatchObject({ status: 'loading', prices: null });
    await waitFor(() => expect(seen.status).toBe('ready'));
    expect(client.calls).toBe(2);
    // A profile refresh that changes nothing loads nothing.
    view.setAuth({ profile: { ...APPROVED, pricing_tier: 'gold', name: 'Renamed' } });
    view.setAuth({ account: 'signed-out', profile: null });
    expect(seen).toMatchObject({ status: 'off', prices: null });
    view.setAuth({ account: 'ready', profile: { ...APPROVED, status: 'suspended' } });
    expect(seen).toMatchObject({ status: 'off', prices: null });
    expect(client.calls).toBe(2);
  });

  it('drops a load that finishes after the account changed', async () => {
    let release;
    const client = fakeClient(() => new Promise((resolve) => { release = () => resolve({ data: payload(9.60), error: null }); }));
    const view = mount(client);
    await waitFor(() => expect(client.calls).toBe(1));
    view.setAuth({ account: 'signed-out', profile: null });
    await act(async () => { release(); });
    expect(seen).toMatchObject({ status: 'off', prices: null });
  });

  it('reports a failed load, keeps prices it had, and tries again when the connection returns', async () => {
    let fail = true;
    const error = { message: 'TypeError: Failed to fetch' };
    const client = fakeClient(() => (fail ? { data: null, error } : { data: payload(9.60), error: null }));
    mount(client);
    await waitFor(() => expect(seen.status).toBe('error'));
    expect(seen).toMatchObject({ prices: null, error });
    fail = false;
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(seen.status).toBe('ready'));
    fail = true;
    let result;
    await act(async () => { result = await seen.refresh(); });
    expect(result).toEqual({ ok: false, prices: null, error });
    expect(seen.status).toBe('error');
    expect(priceFor(seen.prices, 1).unit).toBe(9.60);
  });

  it('refresh() shares a running load and resolves to the new prices (checkout, AW-191)', async () => {
    const client = fakeClient();
    mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    let a;
    let b;
    await act(async () => { [a, b] = await Promise.all([seen.refresh(), seen.refresh()]); });
    expect(a).toBe(b);
    expect(a.ok).toBe(true);
    expect(priceFor(a.prices, 1).unit).toBe(9.60);
    expect(client.calls).toBe(2);
  });

  it('usePrices() needs the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // React reports the render error to window as well; keep it out of the log.
    const swallow = (e) => e.preventDefault();
    window.addEventListener('error', swallow);
    try {
      expect(() => render(<Spy />)).toThrow(/PricesProvider/);
    } finally {
      window.removeEventListener('error', swallow);
      vi.restoreAllMocks();
    }
  });
});
