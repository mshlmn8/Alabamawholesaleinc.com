// The sticky header publishes its height for the sticky sidebar, toolbar,
// policy nav and scroll-padding (AW-153, AW-312), shows itself whole while
// focus is in its trade bar (NEW-017) and scrolls a field the browser left
// under it into view (NEW-018).
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_FRAMES, REVEALED_CLASS, SETTLED_FRAMES, STICKY_HEADER_QUERY, revealFocused, stickyHeaderVars, useStickyHeader } from './stickyHeader.js';

const rootVar = (name) => document.documentElement.style.getPropertyValue(name);

describe('stickyHeaderVars', () => {
  it('publishes what stays on screen: the header minus the trade bar that scrolls away', () => {
    expect(stickyHeaderVars({ headerHeight: 160, barHeight: 36, sticky: true })).toEqual({ '--trade-bar-h': '36px', '--header-h': '124px', '--site-header-h': '160px' });
  });

  it('is 0px where the header does not stick (compact layout, short windows); the bar is still measured', () => {
    expect(stickyHeaderVars({ headerHeight: 210, barHeight: 88, sticky: false })).toEqual({ '--trade-bar-h': '88px', '--header-h': '0px', '--site-header-h': '210px' });
  });

  it('keeps fractions to two places and never goes negative', () => {
    expect(stickyHeaderVars({ headerHeight: 165.594, barHeight: 41.5937, sticky: true })).toEqual({ '--trade-bar-h': '41.59px', '--header-h': '124px', '--site-header-h': '165.59px' });
    expect(stickyHeaderVars({ headerHeight: 0, barHeight: 36, sticky: true })['--header-h']).toBe('0px');
    expect(stickyHeaderVars({ headerHeight: undefined, barHeight: null, sticky: true })).toEqual({ '--trade-bar-h': '0px', '--header-h': '0px', '--site-header-h': '0px' });
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

describe('keyboard focus and the stuck header (NEW-017, NEW-018)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function Page() {
    const ref = useRef(null);
    useStickyHeader(ref);
    return (
      <>
        <header className="site-header" ref={ref}>
          <div className="trade-bar"><button type="button">Pause</button><a href="tel:1">Call</a></div>
          <div><a href="/">Home</a></div>
        </header>
        <main>
          <textarea aria-label="Notes" />
          <h1 tabIndex={-1}>Heading</h1>
          <div role="dialog"><input aria-label="In a dialog" /></div>
        </main>
      </>
    );
  }

  // The header sticks with its bottom edge at 124px; the page's elements
  // sit where `tops` says.
  function layout({ position = 'sticky', tops = {} } = {}) {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('matchMedia', undefined);
    const realStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => (el.classList?.contains('site-header') ? { position } : realStyle(el)));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      if (this.classList.contains('site-header')) return { top: -36, bottom: 124, height: 160, left: 0, right: 0, width: 0, x: 0, y: -36 };
      const top = tops[this.getAttribute('aria-label') || this.textContent] ?? 300;
      return { top, bottom: top + 100, height: 100, left: 0, right: 0, width: 0, x: 0, y: top };
    });
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;
    // Frames run when the test says so.
    const frames = new Map();
    let next = 1;
    vi.stubGlobal('requestAnimationFrame', (fn) => { frames.set(next, fn); return next++; });
    vi.stubGlobal('cancelAnimationFrame', (id) => frames.delete(id));
    const runFrames = (n) => {
      for (let i = 0; i < n; i++) {
        const pending = [...frames.entries()];
        frames.clear();
        for (const [, fn] of pending) fn(performance.now());
      }
    };
    return { scrolled, runFrames, frames };
  }

  it('reveals the whole header while focus is anywhere in the trade bar, and only then', () => {
    layout();
    render(<Page />);
    const header = document.querySelector('.site-header');
    const [pause, call] = document.querySelectorAll('.trade-bar button, .trade-bar a');
    act(() => pause.focus());
    expect(header.classList.contains(REVEALED_CLASS)).toBe(true);
    // Moving within the bar keeps it.
    act(() => call.focus());
    expect(header.classList.contains(REVEALED_CLASS)).toBe(true);
    // On to the masthead: the bar scrolls away again.
    act(() => document.querySelector('a[href="/"]').focus());
    expect(header.classList.contains(REVEALED_CLASS)).toBe(false);
    act(() => pause.focus());
    act(() => pause.blur());
    expect(header.classList.contains(REVEALED_CLASS)).toBe(false);
  });

  it('scrolls a field left under the stuck header into view once the page holds still', () => {
    const { scrolled, runFrames } = layout({ tops: { Notes: -11 } });
    render(<Page />);
    act(() => document.querySelector('textarea').focus());
    runFrames(SETTLED_FRAMES - 1);
    expect(scrolled).not.toHaveBeenCalled();
    runFrames(1);
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scrolled.mock.contexts[0]).toBe(document.querySelector('textarea'));
  });

  it('waits while the browser is still scrolling to the field, but not for ever', () => {
    const { scrolled, runFrames } = layout({ tops: { Notes: 60 } });
    render(<Page />);
    let y = 0;
    const own = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
    act(() => document.querySelector('textarea').focus());
    for (let i = 0; i < 10; i++) { y += 40; runFrames(1); }
    expect(scrolled).not.toHaveBeenCalled();
    runFrames(SETTLED_FRAMES);
    expect(scrolled).toHaveBeenCalledTimes(1);
    // A page that never stops moving still gets the check, after MAX_FRAMES.
    scrolled.mockClear();
    act(() => document.querySelector('a[href="/"]').focus());
    act(() => document.querySelector('textarea').focus());
    for (let i = 0; i < MAX_FRAMES; i++) { y += 40; runFrames(1); }
    expect(scrolled).toHaveBeenCalledTimes(1);
    if (own) Object.defineProperty(window, 'scrollY', own);
    else delete window.scrollY;
  });

  it('leaves alone a field in view, the header itself, dialogs, script-focused headings, a field that lost focus, and a header that does not stick', () => {
    const header = () => document.querySelector('.site-header');
    let { scrolled, runFrames } = layout({ tops: { Notes: 140, Heading: -40, 'In a dialog': -40 } });
    const { unmount } = render(<Page />);
    act(() => document.querySelector('textarea').focus());
    runFrames(SETTLED_FRAMES);
    act(() => document.querySelector('h1').focus());
    runFrames(SETTLED_FRAMES);
    act(() => document.querySelector('[role=dialog] input').focus());
    runFrames(SETTLED_FRAMES);
    act(() => document.querySelector('.trade-bar button').focus());
    runFrames(SETTLED_FRAMES);
    expect(scrolled).not.toHaveBeenCalled();
    expect(revealFocused(header(), document.querySelector('textarea'))).toBe(false);
    unmount();
    vi.restoreAllMocks();

    // Focus moved on before the page settled: only the new target counts.
    ({ scrolled, runFrames } = layout({ tops: { Notes: -11, Heading: -40 } }));
    const second = render(<Page />);
    act(() => document.querySelector('textarea').focus());
    runFrames(1);
    act(() => document.querySelector('h1').focus());
    runFrames(SETTLED_FRAMES);
    expect(scrolled).not.toHaveBeenCalled();
    second.unmount();
    vi.restoreAllMocks();

    ({ scrolled, runFrames } = layout({ position: 'static', tops: { Notes: -40 } }));
    render(<Page />);
    act(() => document.querySelector('textarea').focus());
    runFrames(SETTLED_FRAMES);
    expect(scrolled).not.toHaveBeenCalled();
  });
});
