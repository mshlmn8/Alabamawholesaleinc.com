// Which catalog notices show, and what they say (AW-204).
import { describe, expect, it, vi } from 'vitest';
import { catalogNotices, loadedAtText } from './catalogNotices.js';

const at = new Date(2026, 8, 28, 14, 5).getTime();
const base = { status: 'ready', source: 'live', slow: false, error: null, refreshing: false, lastLoadedAt: at };

describe('catalogNotices', () => {
  it('shows nothing for a loaded catalog, a static-only site or a quick first load', () => {
    expect(catalogNotices(base)).toEqual([]);
    expect(catalogNotices({ ...base, status: 'static', source: 'static', lastLoadedAt: null })).toEqual([]);
    expect(catalogNotices({ ...base, status: 'loading', source: 'static', lastLoadedAt: null })).toEqual([]);
  });

  it('says a slow first load is still running, without a dismiss button', () => {
    const [notice] = catalogNotices({ ...base, status: 'loading', source: 'static', slow: true, lastLoadedAt: null });
    expect(notice).toMatchObject({ id: 'catalog-loading', title: 'Loading the latest catalog…' });
    expect(notice.onDismiss).toBeUndefined();
  });

  it('labels the bundled copy when the live catalog did not load, with a retry', () => {
    const retry = vi.fn();
    const dismiss = vi.fn();
    const error = { kind: 'network', at: at + 1 };
    const [notice] = catalogNotices({ ...base, status: 'error', source: 'static', error, lastLoadedAt: null }, {}, { retry, dismiss });
    expect(notice).toMatchObject({ id: 'catalog-error', tone: 'warn', title: 'We couldn’t load the latest catalog' });
    expect(notice.text).toMatch(/may be out of date/);
    expect(notice.actions).toEqual([{ id: 'retry', label: 'Try again', onClick: retry, disabled: false }]);
    expect(notice.onDismiss).toBe(dismiss);
    expect(catalogNotices({ ...base, status: 'error', source: 'static', error }, { dismissed: true })).toEqual([]);
  });

  it('dates the live catalog when a refresh failed', () => {
    const [notice] = catalogNotices({ ...base, status: 'error', error: { kind: 'failed', at: at + 60000 }, refreshing: true }, { now: at });
    expect(notice).toMatchObject({ id: 'catalog-stale', title: 'We couldn’t check the catalog for changes' });
    expect(notice.text).toMatch(/^Products and prices shown are from 2:05 PM and may have changed since\./);
    expect(notice.actions[0]).toMatchObject({ label: 'Trying again…', disabled: true });
  });

  it('leaves it to a page that explains the problem itself', () => {
    expect(catalogNotices({ ...base, status: 'error', source: 'static', error: { at } }, { pageExplains: true })).toEqual([]);
    expect(catalogNotices({ ...base, status: 'loading', slow: true }, { pageExplains: true })).toEqual([]);
  });
});

describe('loadedAtText', () => {
  it('gives the time, and the date for another day', () => {
    expect(loadedAtText(at, at + 1000)).toBe('2:05 PM');
    expect(loadedAtText(at, at + 24 * 60 * 60 * 1000)).toBe('Sep 28, 2:05 PM');
  });
});
