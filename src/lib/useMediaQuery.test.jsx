import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery.js';

// A controllable window.matchMedia for jsdom, which has none.
function mockMatchMedia(initial) {
  let matches = initial;
  const listeners = new Set();
  const mql = (query) => ({
    media: query,
    get matches() { return matches; },
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  });
  vi.stubGlobal('matchMedia', vi.fn(mql));
  return {
    set(next) {
      matches = next;
      for (const fn of [...listeners]) fn({ matches: next });
    },
    listenerCount: () => listeners.size,
  };
}

function Probe({ query }) {
  return <p>{useMediaQuery(query) ? 'mobile' : 'desktop'}</p>;
}

afterEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('renders the current match on the first render', () => {
    mockMatchMedia(true);
    render(<Probe query={MOBILE_QUERY} />);
    expect(screen.getByText('mobile')).toBeTruthy();
    expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_QUERY);
  });

  it('follows media query changes and unsubscribes on unmount', () => {
    const mq = mockMatchMedia(false);
    const { unmount } = render(<Probe query={MOBILE_QUERY} />);
    expect(screen.getByText('desktop')).toBeTruthy();
    act(() => mq.set(true));
    expect(screen.getByText('mobile')).toBeTruthy();
    expect(mq.listenerCount()).toBe(1);
    unmount();
    expect(mq.listenerCount()).toBe(0);
  });

  // AW-162, AW-151: an em width (so larger text gets the compact layout
  // sooner) or a short touch screen, such as a large phone in landscape.
  it('treats narrow windows and short touch screens as the compact layout', () => {
    expect(MOBILE_QUERY.split(', ')).toEqual([
      '(max-width: 53.125em)',
      '(hover: none) and (pointer: coarse) and (max-height: 31.25em)',
    ]);
    expect(MOBILE_QUERY).not.toMatch(/px/);
  });
});
