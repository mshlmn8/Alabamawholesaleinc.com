// Time limits and offline awareness (AW-194, AW-344), on Vitest's fake
// timers, and against the postgrest-js the site ships: what a timed-out
// call resolves to, and that it gives up within the limit.
import { PostgrestClient } from '@supabase/postgrest-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_REQUEST_TIMEOUT_MS, QUOTE_SUBMIT_TIMEOUT_MS, REQUEST_TIMEOUT_MS, isOffline, isTimeoutError, timeoutError, timeoutSignal, withTimeout,
} from './network.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('time limits', () => {
  it('are 25 s for a quote and 20 s for reads and auth', () => {
    expect([QUOTE_SUBMIT_TIMEOUT_MS, REQUEST_TIMEOUT_MS, AUTH_REQUEST_TIMEOUT_MS]).toEqual([25000, 20000, 20000]);
  });
});

describe('timeoutSignal', () => {
  it('aborts after the time limit with a TimeoutError, on fake timers', () => {
    vi.useFakeTimers();
    const t = timeoutSignal(1000);
    vi.advanceTimersByTime(999);
    expect(t.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(t.signal.aborted).toBe(true);
    expect(t.signal.reason.name).toBe('TimeoutError');
    expect(t.signal.reason.message).toBe('The request took too long.');
    expect(isTimeoutError(t.signal.reason)).toBe(true);
  });

  it('never fires once cleared', () => {
    vi.useFakeTimers();
    const t = timeoutSignal(1000);
    t.clear();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(t.signal.aborted).toBe(false);
  });

  it('aborts at once on abort(), with a plain AbortError', () => {
    vi.useFakeTimers();
    const t = timeoutSignal(1000);
    t.abort();
    expect(t.signal.aborted).toBe(true);
    expect(t.signal.reason.name).toBe('AbortError');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('withTimeout', () => {
  it('passes the answer through and clears its timer', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve({ error: null }), 1000)).resolves.toEqual({ error: null });
    expect(vi.getTimerCount()).toBe(0);
    const refused = new Error('Invalid login credentials');
    await expect(withTimeout(Promise.reject(refused), 1000)).rejects.toBe(refused);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with a code "timeout" error when the promise takes too long', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 20000);
    const caught = pending.catch((e) => e);
    await vi.advanceTimersByTimeAsync(20000);
    const err = await caught;
    expect(err).toMatchObject({ name: 'TimeoutError', code: 'timeout' });
    expect(isTimeoutError(err)).toBe(true);
    expect(timeoutError()).toMatchObject({ name: 'TimeoutError', code: 'timeout', message: 'The request took too long.' });
  });
});

describe('isTimeoutError', () => {
  it('knows every shape a timed-out request takes', () => {
    expect(isTimeoutError({ code: 'timeout' })).toBe(true);
    expect(isTimeoutError(new DOMException('The request took too long.', 'TimeoutError'))).toBe(true);
    expect(isTimeoutError(new DOMException('signal is aborted without reason', 'AbortError'))).toBe(true);
    // postgrest-js's error object for an aborted fetch.
    expect(isTimeoutError({ message: 'TimeoutError: The request took too long.', code: '', hint: '' })).toBe(true);
    expect(isTimeoutError({ message: 'AbortError: signal is aborted without reason', code: '', hint: 'Request was aborted (timeout or manual cancellation)' })).toBe(true);
  });

  it('and nothing else', () => {
    expect(isTimeoutError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isTimeoutError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(false);
    expect(isTimeoutError({ code: 'P0001', message: 'Too many items', hint: 'too_many_items' })).toBe(false);
    expect(isTimeoutError({ message: 'upstream timeout' })).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});

describe('isOffline', () => {
  it('is true only when the browser says it is offline', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get');
    onLine.mockReturnValue(false);
    expect(isOffline()).toBe(true);
    onLine.mockReturnValue(true);
    expect(isOffline()).toBe(false);
  });
});

// A fetch that never answers, but gives up when its signal is aborted, as a
// browser's does (rejecting with the signal's reason).
function stalledFetch() {
  const calls = [];
  const fetch = (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return new Promise((_resolve, reject) => {
      const { signal } = init;
      if (signal?.aborted) { reject(signal.reason); return; }
      signal?.addEventListener('abort', () => reject(signal.reason));
    });
  };
  return { fetch, calls };
}

describe('postgrest-js with timeoutSignal', () => {
  const client = (fetch) => new PostgrestClient('https://example.test/rest/v1', { fetch });

  it('resolves a timed-out rpc to a "TimeoutError: …" error, sent once (a POST is never retried)', async () => {
    vi.useFakeTimers();
    const stalled = stalledFetch();
    const t = timeoutSignal(QUOTE_SUBMIT_TIMEOUT_MS);
    const pending = client(stalled.fetch).rpc('submit_quote', { p_business: 'x' }).abortSignal(t.signal);
    await vi.advanceTimersByTimeAsync(QUOTE_SUBMIT_TIMEOUT_MS);
    const { data, error } = await pending;
    expect(data).toBeNull();
    expect(error.message).toBe('TimeoutError: The request took too long.');
    expect(error.code).toBe('');
    expect(isTimeoutError(error)).toBe(true);
    expect(stalled.calls).toHaveLength(1);
    expect(stalled.calls[0].method).toBe('POST');
  });

  it('gives up on a stalled GET within the limit: its retries end at once', async () => {
    vi.useFakeTimers();
    const stalled = stalledFetch();
    const t = timeoutSignal(REQUEST_TIMEOUT_MS);
    let settled = null;
    client(stalled.fetch).from('orders').select('id').eq('user_id', 'u1').abortSignal(t.signal).then((r) => { settled = r; });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(settled).not.toBeNull();
    expect(isTimeoutError(settled.error)).toBe(true);
    // postgrest-js retries a failed GET, but every retry after the abort
    // fails at once, before a request is made, and without waiting.
    expect(stalled.calls.every((c) => c.method === 'GET')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
