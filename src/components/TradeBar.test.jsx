// The trade bar (AW-167, AW-315, AW-153): every message in one list with the
// trade notice first, one shown at a time; rotation that pauses with the
// toggle, on hover, with focus inside and in a hidden tab, and never starts
// by itself with reduced motion; Apply before Call.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCEMENTS, COMPANY } from '../data/content.js';
import { MESSAGES, ROTATE_MS, TRADE_NOTICE, TradeBar } from './TradeBar.jsx';

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

    const apply = screen.getByRole('button', { name: 'Apply for a trade account' });
    act(() => apply.focus());
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

  it('puts Apply before Call, in the order they are shown, and Apply opens the application', () => {
    const onApplyClick = vi.fn();
    render(<TradeBar onApplyClick={onApplyClick} />);
    const apply = screen.getByRole('button', { name: 'Apply for a trade account' });
    const call = screen.getByRole('link', { name: `Call ${COMPANY.phone}` });
    expect(call.getAttribute('href')).toBe(`tel:${COMPANY.phoneRaw}`);
    expect(apply.compareDocumentPosition(call) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The toggle comes first, then the messages, Apply and Call.
    const order = [...document.querySelectorAll('.trade-bar button, .trade-bar a')];
    expect(order).toEqual([toggle(), apply, call]);
    fireEvent.click(apply);
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });
});
