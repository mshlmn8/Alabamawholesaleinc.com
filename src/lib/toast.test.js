// The toast store (AW-072, AW-042): one toast at a time, plain data only, and
// each toast spoken once through the shared live region.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from './announce.js';
import { TOAST_MS, dismissToast, getToast, showToast, subscribeToast } from './toast.js';

vi.mock('./announce.js', () => ({ announce: vi.fn() }));

afterEach(() => {
  dismissToast();
  vi.mocked(announce).mockClear();
});

describe('toast store', () => {
  it('holds the text and the action as plain data, and speaks the text once', () => {
    const id = showToast({ text: 'Added Kite cigarette tobacco to your quote.', action: { id: 'open-cart', label: 'View quote' } });
    expect(getToast()).toEqual({ id, text: 'Added Kite cigarette tobacco to your quote.', action: { id: 'open-cart', label: 'View quote' } });
    // No callbacks: it survives a round trip through JSON.
    expect(JSON.parse(JSON.stringify(getToast()))).toEqual(getToast());
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Added Kite cigarette tobacco to your quote.');
  });

  it('speaks each toast once, a repeat included, and the new one replaces the last', () => {
    const first = showToast({ text: 'Added 1 × Kite cigarette tobacco to your quote.' });
    const second = showToast({ text: 'Added 1 × Kite cigarette tobacco to your quote.' });
    expect(second).not.toBe(first);
    expect(getToast()).toMatchObject({ id: second, action: null });
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('tells subscribers about every change, until they unsubscribe', () => {
    const listener = vi.fn();
    const stop = subscribeToast(listener);
    const id = showToast({ text: 'One' });
    dismissToast(id);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    showToast({ text: 'Two' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('dismisses only the toast it is asked to, or whichever is on show', () => {
    const old = showToast({ text: 'Old' });
    const current = showToast({ text: 'New' });
    // A timer that outlived its toast leaves the newer one alone.
    dismissToast(old);
    expect(getToast()?.id).toBe(current);
    dismissToast();
    expect(getToast()).toBeNull();
    // Nothing on show: nothing happens.
    dismissToast();
    expect(getToast()).toBeNull();
  });

  it('stays on screen for six seconds', () => {
    expect(TOAST_MS).toBe(6000);
  });
});
