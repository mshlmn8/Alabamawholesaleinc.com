// The trade bar (AW-167, AW-315, AW-153, LEFT-2): every message in one list
// with the trade notice first, one shown at a time; rotation that pauses with
// the toggle, on hover, with focus inside and in a hidden tab, and never
// starts by itself with reduced motion; a message too long for the compact
// row scrolls once and the rotation waits for it; no Apply, then Call.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCEMENTS, COMPANY } from '../data/content.js';
import { MARQUEE_HOLD_MS, MARQUEE_REST_MS, MARQUEE_SPEED, MESSAGES, ROTATE_MS, TRADE_NOTICE, TradeBar, marqueeTiming } from './TradeBar.jsx';

const items = () => [...document.querySelectorAll('.announcement-list li')];
const current = () => items().filter((li) => li.classList.contains('is-current')).map((li) => li.textContent);
const toggle = () => screen.getByRole('button', { name: 'Pause announcements' });
const tick = (times = 1) => act(() => { vi.advanceTimersByTime(ROTATE_MS * times); });

// jsdom has no matchMedia; this one matches reduced motion when asked to.
const mockReducedMotion = (reduce) => {
  window.matchMedia = (query) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
};

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  mockReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  delete window.matchMedia;
  delete document.hidden;
});

describe('TradeBar', () => {
  it('lists the trade notice and every announcement, each the only child of its item, and shows the notice first', () => {
    render(<TradeBar onApplyClick={() => {}} />);
    expect(MESSAGES[0]).toBe(TRADE_NOTICE);
    expect(TRADE_NOTICE).toBe('WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+');
    expect(items().map((li) => li.textContent)).toEqual([TRADE_NOTICE, ...ANNOUNCEMENTS.map((a) => a.replace(/^★ /, ''))]);
    for (const li of items()) expect(li.childNodes).toHaveLength(1);
    expect(screen.getByRole('list', { name: 'Announcements' })).toBeTruthy();
    expect(current()).toEqual([TRADE_NOTICE]);
    // Not a live region: a change is never read out.
    expect(document.querySelector('.trade-bar [aria-live]')).toBeNull();
  });

  it('shows the next message every ROTATE_MS, wrapping round', () => {
    render(<TradeBar onApplyClick={() => {}} />);
    tick();
    expect(current()).toEqual([MESSAGES[1]]);
    tick(MESSAGES.length - 1);
    expect(current()).toEqual([MESSAGES[0]]);
  });

  it('stops and starts again with the toggle', () => {
    render(<TradeBar onApplyClick={() => {}} />);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    tick(3);
    expect(current()).toEqual([TRADE_NOTICE]);
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    tick();
    expect(current()).toEqual([MESSAGES[1]]);
  });

  it('waits while the pointer is over the bar, while focus is inside it and while the tab is hidden', () => {
    render(<TradeBar onApplyClick={() => {}} />);
    const bar = document.querySelector('.trade-bar');
    fireEvent.mouseEnter(bar);
    tick(2);
    expect(current()).toEqual([TRADE_NOTICE]);
    fireEvent.mouseLeave(bar);
    tick();
    expect(current()).toEqual([MESSAGES[1]]);

    act(() => toggle().focus());
    tick(2);
    expect(current()).toEqual([MESSAGES[1]]);
    // Focus moving within the bar keeps it waiting.
    act(() => screen.getByRole('link', { name: `Call ${COMPANY.phone}` }).focus());
    tick();
    expect(current()).toEqual([MESSAGES[1]]);
    act(() => document.activeElement.blur());
    tick();
    expect(current()).toEqual([MESSAGES[2]]);

    hidden = true;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    tick(2);
    expect(current()).toEqual([MESSAGES[2]]);
    hidden = false;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    tick();
    expect(current()).toEqual([MESSAGES[3]]);
  });

  it('with reduced motion starts paused on the notice and sets no timer until Play is pressed', () => {
    mockReducedMotion(true);
    const setInterval = vi.spyOn(window, 'setInterval');
    render(<TradeBar onApplyClick={() => {}} />);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    tick(5);
    expect(current()).toEqual([TRADE_NOTICE]);
    expect(setInterval).not.toHaveBeenCalled();
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    tick();
    expect(current()).toEqual([MESSAGES[1]]);
  });

  it('has no Apply (the header has the one, LEFT-2): the toggle, the messages, then Call, named with the number it shows beside the word', () => {
    render(<TradeBar />);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    const call = screen.getByRole('link', { name: `Call ${COMPANY.phone}` });
    expect(call.getAttribute('href')).toBe(`tel:${COMPANY.phoneRaw}`);
    // The visible words: 'Call', then the number, which the compact layout
    // hides; the name keeps the visible word (WCAG 2.5.3).
    expect(call.textContent).toBe(`Call ${COMPANY.phone}`);
    expect(call.querySelector('.trade-call-number').textContent).toBe(` ${COMPANY.phone}`);
    expect(call.getAttribute('aria-label').startsWith('Call')).toBe(true);
    const order = [...document.querySelectorAll('.trade-bar button, .trade-bar a')];
    expect(order).toEqual([toggle(), call]);
  });

  it('marks the bar still while it is paused, hovered or focused, so a scrolling message stops too', () => {
    render(<TradeBar />);
    const bar = document.querySelector('.trade-bar');
    expect(bar.classList.contains('is-still')).toBe(false);
    fireEvent.mouseEnter(bar);
    expect(bar.classList.contains('is-still')).toBe(true);
    fireEvent.mouseLeave(bar);
    act(() => toggle().focus());
    expect(bar.classList.contains('is-still')).toBe(true);
    act(() => toggle().blur());
    expect(bar.classList.contains('is-still')).toBe(false);
    fireEvent.click(toggle());
    expect(bar.classList.contains('is-still')).toBe(true);
  });
});

describe('the marquee in the compact row (AW-153)', () => {
  // A row 270px wide; each message as wide as `widths` says (jsdom lays
  // nothing out). The observer reports when the test says so.
  let observers;
  let widths;
  beforeEach(() => {
    observers = [];
    widths = {};
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() { this.gone = true; }
    });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function width() {
      return this.tagName === 'LI' ? (widths[this.textContent] ?? 200) : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function width() {
      return this.tagName === 'LI' ? 270 : 0;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const report = () => act(() => { for (const o of observers.filter((x) => !x.gone)) o.callback([]); });
  const list = () => document.querySelector('.announcement-list');

  it('times a scroll by its length: a moment at the start, a steady speed, a rest at the end, and never less than ROTATE_MS', () => {
    expect(marqueeTiming(0)).toEqual({ travel: 0, shown: ROTATE_MS });
    expect(marqueeTiming(MARQUEE_SPEED * 6)).toEqual({ travel: 6000, shown: MARQUEE_HOLD_MS + 6000 + MARQUEE_REST_MS });
    expect(marqueeTiming(MARQUEE_SPEED)).toEqual({ travel: 1000, shown: ROTATE_MS });
  });

  it('scrolls a message that runs past the row by what overflows, and waits for it before the next one', () => {
    widths[TRADE_NOTICE] = 270 + MARQUEE_SPEED * 6;
    render(<TradeBar />);
    // Not measured yet: nothing moves.
    expect(document.querySelector('.is-current').className).toBe('is-current');
    report();
    expect(document.querySelector('.is-current').className).toBe('is-current is-marquee');
    expect(list().style.getPropertyValue('--marquee-shift')).toBe(`${-MARQUEE_SPEED * 6}px`);
    expect(list().style.getPropertyValue('--marquee-ms')).toBe('6000ms');
    expect(list().style.getPropertyValue('--marquee-hold')).toBe(`${MARQUEE_HOLD_MS}ms`);
    // Shown for the hold, the scroll and the rest, longer than ROTATE_MS.
    tick();
    expect(current()).toEqual([TRADE_NOTICE]);
    act(() => { vi.advanceTimersByTime(MARQUEE_HOLD_MS + 6000 + MARQUEE_REST_MS - ROTATE_MS); });
    expect(current()).toEqual([MESSAGES[1]]);
    // The next one fits: no marquee, and the usual ROTATE_MS.
    report();
    expect(document.querySelector('.is-current').className).toBe('is-current');
    expect(list().style.getPropertyValue('--marquee-shift')).toBe('0px');
    tick();
    expect(current()).toEqual([MESSAGES[2]]);
  });

  it('measures again when the row changes size, and only for the message shown', () => {
    render(<TradeBar />);
    report();
    expect(document.querySelector('.is-marquee')).toBeNull();
    // Larger text, or a narrower window: now it runs past the row.
    widths[TRADE_NOTICE] = 400;
    report();
    expect(document.querySelector('.is-current').classList.contains('is-marquee')).toBe(true);
    expect(list().style.getPropertyValue('--marquee-shift')).toBe('-130px');
  });
});
