// Code that loads on demand (AW-179): telling a failed download apart, the
// idle-time fetch into the browser's cache, waiting for the connection, and
// the one reload that recovers a file that didn't download (NEW-006).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RELOAD_KEY, IDLE_FALLBACK_MS, chunkUrls, clearChunkReload, installChunkRecovery, isChunkLoadError, isWarm, loadDialog, loadPage,
  prefetchChunks, reloadForChunkError, setChunkUrlsForTests, setReloadForTests, whenIdle, whenOnline,
} from './chunks.js';

const MAP = {
  quote: ['/assets/QuotePage-a1.js', '/assets/Field-b2.js'],
  contact: ['/assets/ContactPage-c3.js'],
  account: ['/assets/AccountPage-d4.js', '/assets/Field-b2.js'],
};
const NOT_LOADED = 'Failed to fetch dynamically imported module: http://localhost/assets/ContactPage-c3.js';
const online = (value) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
const goOnline = () => {
  online(true);
  window.dispatchEvent(new Event('online'));
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
// The state of a promise after pending callbacks ran.
const settled = async (promise) => {
  let state = 'pending';
  promise.then(() => { state = 'resolved'; }, () => { state = 'rejected'; });
  await flush();
  return state;
};
const okResponse = () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });

let reload;
beforeEach(() => {
  reload = vi.fn();
  setReloadForTests(reload);
  setChunkUrlsForTests(null);
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setReloadForTests(null);
  setChunkUrlsForTests(null);
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

describe('prefetchChunks (NEW-006)', () => {
  it('fetches every file of the named pages once, with fetch() and same-origin credentials, never import()', async () => {
    setChunkUrlsForTests(MAP);
    online(true);
    const fetch = vi.fn(okResponse);
    vi.stubGlobal('fetch', fetch);
    prefetchChunks(['quote', 'contact', 'account', 'nope']);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/assets/QuotePage-a1.js', '/assets/Field-b2.js', '/assets/ContactPage-c3.js', '/assets/AccountPage-d4.js']);
    for (const [, options] of fetch.mock.calls) expect(options).toEqual({ credentials: 'same-origin' });
    expect(document.querySelector('link[rel=modulepreload], link[rel=prefetch]')).toBeNull();
    await flush();
    expect(isWarm('quote')).toBe(true);
    // Fetched once per visit.
    prefetchChunks(['quote']);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('skips offline and on a data-saving connection, and keeps quiet about failures', async () => {
    setChunkUrlsForTests(MAP);
    const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', fetch);
    online(false);
    prefetchChunks(['quote']);
    expect(fetch).not.toHaveBeenCalled();
    online(true);
    vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
    prefetchChunks(['quote']);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetch);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    prefetchChunks(['contact']);
    await flush();
    process.off('unhandledRejection', unhandled);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    // A failed or refused fetch leaves the page unwarmed.
    expect(isWarm('contact')).toBe(false);
    fetch.mockImplementation(() => Promise.resolve({ ok: false }));
    prefetchChunks(['contact']);
    await flush();
    expect(isWarm('contact')).toBe(false);
  });

  it('does nothing without the build’s list of files (development, tests)', () => {
    const fetch = vi.fn(okResponse);
    vi.stubGlobal('fetch', fetch);
    expect(chunkUrls('quote')).toEqual([]);
    prefetchChunks(['quote', 'contact']);
    expect(fetch).not.toHaveBeenCalled();
    expect(isWarm('quote')).toBe(false);
  });
});

describe('whenOnline (NEW-006)', () => {
  it('resolves at once online', async () => {
    online(true);
    expect(await settled(whenOnline())).toBe('resolved');
  });

  it('waits offline until the connection is back', async () => {
    online(false);
    const back = whenOnline();
    expect(await settled(back)).toBe('pending');
    goOnline();
    expect(await settled(back)).toBe('resolved');
  });
});

describe('the reload that recovers a file that didn’t download (NEW-006)', () => {
  // What the reload brings: a fresh document with the flag still set.
  const reloaded = () => setReloadForTests(reload);

  it('reloads once per address, and again once a page has rendered', () => {
    online(true);
    window.history.replaceState(null, '', '/contact?x=1');
    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('/contact?x=1');
    // A second failure before the reload happens waits for it.
    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    // The reloaded page failed too: no second reload, the page says so.
    reloaded();
    expect(reloadForChunkError()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // Another address may reload once.
    window.history.replaceState(null, '', '/quote');
    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
    reloaded();
    clearChunkReload();
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
    expect(reloadForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it('never reloads offline, or without sessionStorage to stop a loop', () => {
    online(false);
    expect(reloadForChunkError()).toBe(false);
    online(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(reloadForChunkError()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('loadPage and loadDialog (NEW-006)', () => {
  const module = { Page: 'page' };

  it('loads at once online', async () => {
    online(true);
    const load = vi.fn(() => Promise.resolve(module));
    expect(await loadPage('contact', load)).toBe(module);
    expect(await loadDialog('auth', load)).toBe(module);
  });

  it('offline, waits for the connection unless the files were fetched ahead', async () => {
    setChunkUrlsForTests(MAP);
    online(true);
    vi.stubGlobal('fetch', vi.fn(okResponse));
    prefetchChunks(['contact']);
    await flush();
    online(false);
    const warm = vi.fn(() => Promise.resolve(module));
    expect(await loadPage('contact', warm)).toBe(module);
    const cold = vi.fn(() => Promise.resolve(module));
    const page = loadPage('quote', cold);
    const dialog = loadDialog('quote', cold);
    expect(await settled(page)).toBe('pending');
    expect(cold).not.toHaveBeenCalled();
    goOnline();
    expect(await page).toBe(module);
    expect(await dialog).toBe(module);
    expect(cold).toHaveBeenCalledTimes(2);
  });

  it('reloads a page once when its file didn’t download, and fails only after that reload', async () => {
    online(true);
    window.history.replaceState(null, '', '/contact');
    const failing = () => Promise.reject(new TypeError(NOT_LOADED));
    const first = loadPage('contact', failing);
    expect(await settled(first)).toBe('pending');
    expect(reload).toHaveBeenCalledTimes(1);
    // Another failure meanwhile waits for that reload too.
    expect(await settled(loadPage('contact', failing))).toBe('pending');
    // After the reload the flag is set: the error reaches the page's boundary.
    setReloadForTests(reload);
    await expect(loadPage('contact', failing)).rejects.toThrow(NOT_LOADED);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits for the connection before that reload when the file failed offline', async () => {
    online(false);
    window.history.replaceState(null, '', '/delivery');
    const failing = vi.fn(() => Promise.reject(new TypeError(NOT_LOADED)));
    setChunkUrlsForTests({ delivery: ['/assets/DeliveryPage-e5.js'] });
    online(true);
    vi.stubGlobal('fetch', vi.fn(okResponse));
    prefetchChunks(['delivery']);
    await flush();
    online(false);
    const page = loadPage('delivery', failing);
    expect(await settled(page)).toBe('pending');
    expect(failing).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    goOnline();
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await settled(page)).toBe('pending');
  });

  it('lets any other error through, and never reloads for a dialog', async () => {
    online(true);
    await expect(loadPage('contact', () => Promise.reject(new TypeError('x.at is not a function')))).rejects.toThrow('x.at is not a function');
    await expect(loadDialog('auth', () => Promise.reject(new TypeError(NOT_LOADED)))).rejects.toThrow(NOT_LOADED);
    expect(reload).not.toHaveBeenCalled();
  });

  it('waits for the reload Vite’s preloadError started, instead of rendering without the module', async () => {
    online(true);
    expect(await settled(loadPage('contact', () => Promise.resolve(undefined)))).toBe('pending');
  });
});

describe('installChunkRecovery (NEW-006)', () => {
  const preloadError = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    event.payload = new TypeError(NOT_LOADED);
    window.dispatchEvent(event);
    return event;
  };

  it('reloads once for a page’s file and takes the error from Vite', () => {
    online(true);
    const remove = installChunkRecovery();
    window.history.replaceState(null, '', '/apply');
    expect(preloadError().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    // Already reloaded for this address: Vite throws, the page says so.
    setReloadForTests(reload);
    expect(preloadError().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    remove();
  });

  it('leaves a dialog’s file to the dialog', async () => {
    online(true);
    const remove = installChunkRecovery();
    let fail;
    const dialog = loadDialog('auth', () => new Promise((resolve, reject) => { fail = reject; }));
    await flush();
    expect(preloadError().defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    fail(new TypeError(NOT_LOADED));
    await expect(dialog).rejects.toThrow(NOT_LOADED);
    // With no dialog loading, a page's file reloads.
    expect(preloadError().defaultPrevented).toBe(true);
    remove();
  });
});
