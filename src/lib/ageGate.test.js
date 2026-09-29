import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE } from '../data/content.js';
import {
  AGE_CONFIRMATION_MAX_AGE_MS, CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT, ageGateState, ageRecord, clearAgeConfirmation,
  confirmAge, declineAge, endAgeConfirmationOnSignOut, parseAgeRecord, reconsiderAge, useAgeGate,
} from './ageGate.js';

const NOW = Date.UTC(2026, 8, 28, 12);
const DAY = 24 * 60 * 60 * 1000;
const stored = () => window.localStorage.getItem(STORAGE.age);

// Another tab writing the key: jsdom does not fire 'storage' for this tab's
// own writes, so the event is dispatched by hand, as the browser would.
function otherTabWrites(value) {
  if (value === null) window.localStorage.removeItem(STORAGE.age);
  else window.localStorage.setItem(STORAGE.age, value);
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE.age, newValue: value }));
}

beforeEach(() => {
  clearAgeConfirmation();
  reconsiderAge();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('parseAgeRecord', () => {
  it('accepts a record from within the period', () => {
    expect(parseAgeRecord(ageRecord(NOW), NOW)).toEqual({ confirmed: true, legacy: false });
    expect(parseAgeRecord(ageRecord(NOW - AGE_CONFIRMATION_MAX_AGE_MS + 1), NOW).confirmed).toBe(true);
  });

  it('rejects expired, far-future, damaged and missing values', () => {
    expect(parseAgeRecord(ageRecord(NOW - AGE_CONFIRMATION_MAX_AGE_MS), NOW).confirmed).toBe(false);
    expect(parseAgeRecord(ageRecord(NOW + 2 * DAY), NOW).confirmed).toBe(false);
    for (const raw of [null, undefined, '', 'no', 'true', '{', '{}', 'null', JSON.stringify({ ok: false, at: NOW }),
      JSON.stringify({ ok: true, at: String(NOW) }), JSON.stringify({ ok: true })]) {
      expect(parseAgeRecord(raw, NOW)).toEqual({ confirmed: false, legacy: false });
    }
  });

  it('treats the old undated "yes" as a confirmation to migrate', () => {
    expect(parseAgeRecord('yes', NOW)).toEqual({ confirmed: true, legacy: true });
  });

  it('defaults to a 30-day period (owner to confirm, AW-340)', () => {
    expect(AGE_CONFIRMATION_MAX_AGE_MS).toBe(30 * DAY);
    expect(CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT).toBe(true);
  });
});

describe('age gate state', () => {
  it('starts unconfirmed in a fresh browser', () => {
    expect(ageGateState()).toEqual({ confirmed: false, declined: false });
  });

  it('stores a dated record when confirmed', () => {
    vi.useFakeTimers({ now: NOW });
    confirmAge();
    expect(JSON.parse(stored())).toEqual({ ok: true, at: NOW });
    expect(ageGateState().confirmed).toBe(true);
  });

  it('migrates the old "yes" to a record dated now, which then expires', () => {
    vi.useFakeTimers({ now: NOW });
    window.localStorage.setItem(STORAGE.age, 'yes');
    expect(ageGateState().confirmed).toBe(true);
    expect(JSON.parse(stored())).toEqual({ ok: true, at: NOW });
    vi.setSystemTime(NOW + AGE_CONFIRMATION_MAX_AGE_MS);
    expect(ageGateState().confirmed).toBe(false);
    expect(stored()).toBeNull();
  });

  it('removes an expired or damaged value', () => {
    window.localStorage.setItem(STORAGE.age, ageRecord(Date.now() - AGE_CONFIRMATION_MAX_AGE_MS - DAY));
    expect(ageGateState().confirmed).toBe(false);
    expect(stored()).toBeNull();
    window.localStorage.setItem(STORAGE.age, '{broken');
    expect(ageGateState().confirmed).toBe(false);
    expect(stored()).toBeNull();
  });

  it('remembers "No, exit" for the session until the visitor goes back', () => {
    declineAge();
    expect(window.sessionStorage.getItem(STORAGE.ageDeclined)).toBe('1');
    expect(window.localStorage.getItem(STORAGE.ageDeclined)).toBeNull();
    expect(ageGateState()).toEqual({ confirmed: false, declined: true });
    reconsiderAge();
    expect(ageGateState()).toEqual({ confirmed: false, declined: false });
    declineAge();
    confirmAge();
    expect(ageGateState()).toEqual({ confirmed: true, declined: false });
    expect(window.sessionStorage.getItem(STORAGE.ageDeclined)).toBeNull();
  });

  it('forgets the confirmation on sign-out', () => {
    confirmAge();
    endAgeConfirmationOnSignOut();
    expect(stored()).toBeNull();
    expect(ageGateState().confirmed).toBe(false);
  });

  it('works for this page view when storage is blocked', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(ageGateState().confirmed).toBe(false);
    declineAge();
    expect(ageGateState().declined).toBe(true);
    reconsiderAge();
    confirmAge();
    expect(local).toHaveBeenCalled();
    expect(ageGateState()).toEqual({ confirmed: true, declined: false });
    clearAgeConfirmation();
    expect(ageGateState().confirmed).toBe(false);
  });
});

describe('useAgeGate', () => {
  it('follows a confirmation, and a sign-out, made in another tab (AW-339)', () => {
    const { result } = renderHook(() => useAgeGate());
    expect(result.current.confirmed).toBe(false);
    act(() => otherTabWrites(ageRecord(Date.now())));
    expect(result.current.confirmed).toBe(true);
    act(() => otherTabWrites(null));
    expect(result.current.confirmed).toBe(false);
  });

  it('follows another tab clearing all site storage', () => {
    confirmAge();
    const { result } = renderHook(() => useAgeGate());
    expect(result.current.confirmed).toBe(true);
    act(() => {
      window.localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(result.current.confirmed).toBe(false);
  });

  it('ignores other keys', () => {
    const { result } = renderHook(() => useAgeGate());
    const first = result.current;
    act(() => {
      window.localStorage.setItem(STORAGE.cart, '{}');
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE.cart, newValue: '{}' }));
    });
    expect(result.current).toBe(first);
  });

  it('asks again when a tab comes back after the period ran out', () => {
    vi.useFakeTimers({ now: NOW });
    confirmAge();
    const { result } = renderHook(() => useAgeGate());
    expect(result.current.confirmed).toBe(true);
    vi.setSystemTime(NOW + AGE_CONFIRMATION_MAX_AGE_MS + 1);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.confirmed).toBe(false);
  });

  it('updates the tab that answers', () => {
    const { result } = renderHook(() => useAgeGate());
    act(() => declineAge());
    expect(result.current).toEqual({ confirmed: false, declined: true });
    act(() => reconsiderAge());
    act(() => confirmAge());
    expect(result.current).toEqual({ confirmed: true, declined: false });
  });
});
