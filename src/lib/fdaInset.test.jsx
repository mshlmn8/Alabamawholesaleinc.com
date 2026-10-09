// The toasts ride above the footer's FDA warning (NEW-080): --fda-visible-h
// is how far up from the window's bottom the warning reaches while it shows.
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FDA_INSET_VAR, fdaInset, useFdaInset } from './fdaInset.js';

const rootVar = () => document.documentElement.style.getPropertyValue(FDA_INSET_VAR);

describe('fdaInset', () => {
  it('is 0 while the warning is off screen, and its height on screen when it ends at the window’s bottom', () => {
    expect(fdaInset(undefined, 900)).toBe(0);
    expect(fdaInset({ top: 950, bottom: 1010, height: 60 }, 900)).toBe(0);
    expect(fdaInset({ top: -80, bottom: -20, height: 60 }, 900)).toBe(0);
    // Scrolling into view: the part that shows.
    expect(fdaInset({ top: 880, bottom: 940, height: 60 }, 900)).toBe(20);
    // The end of the page: the band flush with the window's bottom.
    expect(fdaInset({ top: 840, bottom: 900, height: 60 }, 900)).toBe(60);
  });

  it('on a page shorter than the window, reaches up to the warning’s top, so a toast at the bottom stays clear of it', () => {
    expect(fdaInset({ top: 700, bottom: 760, height: 60 }, 900)).toBe(200);
    // Never more than the window.
    expect(fdaInset({ top: -10, bottom: 50, height: 60 }, 40)).toBe(40);
  });
});

describe('useFdaInset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function App() {
    useFdaInset();
    return <footer><div className="fda-note">WARNING</div></footer>;
  }

  it('writes the property at once, follows scrolling a frame at a time, and removes it on unmount', () => {
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', (fn) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('ResizeObserver', undefined);
    let top = 1200;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top, bottom: top + 60, height: 60, left: 0, right: 0, width: 0, x: 0, y: top }));
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    const { unmount } = render(<App />);
    expect(rootVar()).toBe('0px');
    top = 840;
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    // One check per frame, however many scroll events.
    expect(frames).toHaveLength(1);
    frames.shift()();
    expect(rootVar()).toBe('60px');
    unmount();
    expect(rootVar()).toBe('');
  });
});
