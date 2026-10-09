// A price load gives up on a stalled network (AW-194): checkout's re-check
// (refresh()) resolves to a failure after REQUEST_TIMEOUT_MS instead of
// leaving "Checking the catalog…" on screen with the form locked. Amounts
// are test values.
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './auth.jsx';
import { CatalogContext } from './catalog.jsx';
import { PricesProvider, usePrices } from './prices.jsx';
import { REQUEST_TIMEOUT_MS, isTimeoutError } from './network.js';

const APPROVED = { id: 'u1', status: 'approved', pricing_tier: 'silver' };
const payload = { tier: 'silver', tier_label: 'Test silver', discount_pct: 5, products: { 1: { list: 10.10, unit: 9.60, variants: {} } } };

// rpc() answers the first call; later calls never answer, and settle like
// postgrest-js does once their signal aborts: { error: 'TimeoutError: …' }.
function stallingClient() {
  const client = {
    calls: 0,
    signals: [],
    rpc: vi.fn(() => {
      let signal = null;
      const b = {
        abortSignal(s) { signal = s; client.signals.push(s); return b; },
        then(resolve, reject) {
          client.calls += 1;
          if (client.calls === 1) return Promise.resolve({ data: payload, error: null }).then(resolve, reject);
          return new Promise((done) => {
            signal?.addEventListener('abort', () => done({ data: null, error: { message: `${signal.reason?.name || 'AbortError'}: ${signal.reason?.message || ''}`, code: '' } }));
          }).then(resolve, reject);
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

afterEach(() => {
  vi.useRealTimers();
  seen = null;
});

describe('PricesProvider time limit (AW-194)', () => {
  it('a stalled re-check gives up after REQUEST_TIMEOUT_MS, keeps the prices on screen, and says it timed out', async () => {
    vi.useFakeTimers();
    const client = stallingClient();
    render(
      <AuthContext.Provider value={{ account: 'ready', profile: APPROVED }}>
        <CatalogContext.Provider value={{ lastLoadedAt: 1 }}>
          <PricesProvider client={client}><Spy /></PricesProvider>
        </CatalogContext.Provider>
      </AuthContext.Provider>,
    );
    await act(async () => {});
    expect(seen.status).toBe('ready');
    expect(client.signals[0]).toBeInstanceOf(AbortSignal);

    let result = null;
    let refresh;
    await act(async () => { refresh = seen.refresh().then((r) => { result = r; }); });
    await act(async () => { vi.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1); });
    expect(result).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1); await refresh; });
    expect(result.ok).toBe(false);
    expect(isTimeoutError(result.error)).toBe(true);
    expect(seen.status).toBe('error');
    expect(seen.prices).not.toBeNull();
  });
});
