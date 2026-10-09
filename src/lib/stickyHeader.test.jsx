// The sticky header publishes its height for the sticky sidebar, toolbar,
// policy nav and scroll-padding (AW-153, AW-312).
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STICKY_HEADER_QUERY, stickyHeaderVars, useStickyHeader } from './stickyHeader.js';

const rootVar = (name) => document.documentElement.style.getPropertyValue(name);

describe('stickyHeaderVars', () => {
  it('publishes what stays on screen: the header minus the trade bar that scrolls away', () => {
    expect(stickyHeaderVars({ headerHeight: 160, barHeight: 36, sticky: true })).toEqual({ '--trade-bar-h': '36px', '--header-h': '124px' });
  });

  it('is 0px where the header does not stick (compact layout, short windows); the bar is still measured', () => {
    expect(stickyHeaderVars({ headerHeight: 210, barHeight: 88, sticky: false })).toEqual({ '--trade-bar-h': '88px', '--header-h': '0px' });
  });

  it('keeps fractions to two places and never goes negative', () => {
    expect(stickyHeaderVars({ headerHeight: 165.594, barHeight: 41.5937, sticky: true })).toEqual({ '--trade-bar-h': '41.59px', '--header-h': '124px' });
    expect(stickyHeaderVars({ headerHeight: 0, barHeight: 36, sticky: true })['--header-h']).toBe('0px');
    expect(stickyHeaderVars({ headerHeight: undefined, barHeight: null, sticky: true })).toEqual({ '--trade-bar-h': '0px', '--header-h': '0px' });
  });

  it('starts just past the compact layout, in em, on windows at least 37.5em tall', () => {
    expect(STICKY_HEADER_QUERY).toBe('(min-width: 53.13em) and (min-height: 37.5em)');
  });
});

describe('useStickyHeader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function Frame() {
    const ref = useRef(null);
    useStickyHeader(ref);
    return <header className="site-header" ref={ref}><div className="trade-bar">Bar</div><div>Masthead</div></header>;
  }

  // Controllable ResizeObserver and matchMedia, which jsdom lacks.
  function stubBrowser() {
    const observers = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
      observe(el) { this.targets.push(el); }
      disconnect() { this.disconnected = true; }
    });
    const listeners = new Set();
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      media: query, matches: true,
      addEventListener: (_type, fn) => listeners.add(fn),
      removeEventListener: (_type, fn) => listeners.delete(fn),
    })));
    return { observers, listeners };
  }

  it('writes both properties before paint, follows size and query changes, and cleans up on unmount', () => {
    const { observers, listeners } = stubBrowser();
    const sizes = { header: 160, bar: 36, position: 'sticky' };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      const height = this.classList.contains('trade-bar') ? sizes.bar : sizes.header;
      return { top: 0, left: 0, right: 0, bottom: height, width: 0, height, x: 0, y: 0 };
    });
    const realStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => (el.classList?.contains('site-header') ? { position: sizes.position } : realStyle(el)));

    const { unmount } = render(<Frame />);
    expect(rootVar('--header-h')).toBe('124px');
    expect(rootVar('--trade-bar-h')).toBe('36px');
    // It watches the header and its trade bar, and the sticky query.
    expect(observers).toHaveLength(1);
    expect(observers[0].targets.map((el) => el.className)).toEqual(['site-header', 'trade-bar']);
    expect(window.matchMedia).toHaveBeenCalledWith(STICKY_HEADER_QUERY);
    expect(listeners.size).toBe(1);

    // Larger text: the header grows.
    sizes.header = 190; sizes.bar = 50;
    observers[0].callback([]);
    expect(rootVar('--header-h')).toBe('140px');
    expect(rootVar('--trade-bar-h')).toBe('50px');

    // The window got shorter than the query: the header no longer sticks.
    sizes.position = 'static';
    for (const fn of listeners) fn({ matches: false });
    expect(rootVar('--header-h')).toBe('0px');

    unmount();
    expect(observers[0].disconnected).toBe(true);
    expect(listeners.size).toBe(0);
    expect(rootVar('--header-h')).toBe('');
    expect(rootVar('--trade-bar-h')).toBe('');
  });

  it('measures once in a browser without ResizeObserver or matchMedia (jsdom)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('matchMedia', undefined);
    const { unmount } = render(<Frame />);
    // jsdom lays nothing out and the header is static: 0px.
    expect(rootVar('--header-h')).toBe('0px');
    expect(rootVar('--trade-bar-h')).toBe('0px');
    unmount();
    expect(rootVar('--header-h')).toBe('');
  });
});
