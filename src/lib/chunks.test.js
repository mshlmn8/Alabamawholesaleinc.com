// Code that loads on demand (AW-179): telling a failed download apart, and
// the idle-time prefetch.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_FALLBACK_MS, isChunkLoadError, prefetch, whenIdle } from './chunks.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('isChunkLoadError', () => {
  it('knows each browser’s failed import() and Vite’s failed preload', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://alabamawholesaleinc.com/assets/AdminPage-abc123.js',
      'Importing a module script failed.',
      'error loading dynamically imported module: https://alabamawholesaleinc.com/assets/QuotePage-x.js',
      'Unable to preload CSS for /assets/AdminPage-abc.css',
    ]) {
      expect([message, isChunkLoadError(new TypeError(message))]).toEqual([message, true]);
    }
    const named = new Error('Loading chunk 3 failed.');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
  });

  it('leaves other errors, and nothing, alone', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
    expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('whenIdle', () => {
  const readyState = (value) => vi.spyOn(document, 'readyState', 'get').mockReturnValue(value);

  it('waits for the load event, then for an idle moment', () => {
    readyState('loading');
    const idle = [];
    vi.stubGlobal('requestIdleCallback', vi.fn((cb, options) => { idle.push({ cb, options }); return 7; }));
    const callback = vi.fn();
    whenIdle(callback);
    expect(window.requestIdleCallback).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    expect(idle).toHaveLength(1);
    expect(idle[0].options.timeout).toBeGreaterThan(0);
    expect(callback).not.toHaveBeenCalled();
    idle[0].cb();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('uses a timer where there is no requestIdleCallback (Safari)', () => {
    readyState('complete');
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();
    whenIdle(callback);
    vi.advanceTimersByTime(IDLE_FALLBACK_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does nothing once cancelled, before or after the load event', () => {
    readyState('loading');
    vi.stubGlobal('requestIdleCallback', vi.fn(() => 3));
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    const early = vi.fn();
    whenIdle(early)();
    window.dispatchEvent(new Event('load'));
    expect(window.requestIdleCallback).not.toHaveBeenCalled();

    const late = vi.fn();
    const cancel = whenIdle(late);
    window.dispatchEvent(new Event('load'));
    cancel();
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(3);
    window.requestIdleCallback.mock.calls[0][0]();
    expect(late).not.toHaveBeenCalled();
  });
});

describe('prefetch', () => {
  it('starts every loader and keeps quiet about failures', async () => {
    const ok = vi.fn(() => Promise.resolve({}));
    const failed = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')));
    const throws = vi.fn(() => { throw new Error('nope'); });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    prefetch([failed, throws, ok]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(throws).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
