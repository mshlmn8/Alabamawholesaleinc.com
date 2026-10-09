// The notice for an approved buyer whose prices didn't load (NEW-054).
import { describe, expect, it, vi } from 'vitest';
import { pricesNotices } from './pricesNotices.js';

const KEPT = { tier: 'silver', tierLabel: 'Silver', discountPct: 5, byId: {} };
const failed = (extra) => ({ status: 'error', prices: null, refreshing: false, error: { message: 'boom' }, ...extra });

describe('pricesNotices', () => {
  it('shows nothing while prices load, once they are in, or for an account without prices', () => {
    expect(pricesNotices({ status: 'off', prices: null })).toEqual([]);
    expect(pricesNotices({ status: 'loading', prices: null, refreshing: true })).toEqual([]);
    expect(pricesNotices({ status: 'ready', prices: KEPT })).toEqual([]);
    expect(pricesNotices(null)).toEqual([]);
  });

  it('says the prices didn’t load, with Try again, when none were kept', () => {
    const retry = vi.fn();
    const [notice, ...rest] = pricesNotices(failed(), { routePage: 'category' }, { retry });
    expect(rest).toEqual([]);
    expect(notice).toMatchObject({ id: 'prices-error', tone: 'warn', title: 'We couldn’t load your prices' });
    expect(notice.text).toBe('Products show without your account prices until they load. Try again, or check your connection.');
    expect(notice.actions).toEqual([{ id: 'retry', label: 'Try again', onClick: retry, disabled: false }]);
    // Not dismissible: every price on the site waits on it.
    expect(notice.onDismiss).toBeUndefined();
  });

  it('says it is trying again while a load runs', () => {
    const [notice] = pricesNotices(failed({ refreshing: true }), {}, { retry: vi.fn() });
    expect(notice.actions[0]).toMatchObject({ label: 'Trying again…', disabled: true });
  });

  it('stays away when a failed refresh kept the prices on screen, and on admin pages', () => {
    expect(pricesNotices(failed({ prices: KEPT }))).toEqual([]);
    expect(pricesNotices(failed(), { routePage: 'admin' })).toEqual([]);
  });
});
