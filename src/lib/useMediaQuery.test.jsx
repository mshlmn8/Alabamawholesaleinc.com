import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery.js';

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
    render(<Probe query="(max-width: 850px)" />);
    expect(screen.getByText('mobile')).toBeTruthy();
  });

  it('follows media query changes and unsubscribes on unmount', () => {
    const mq = mockMatchMedia(false);
    const { unmount } = render(<Probe query="(max-width: 850px)" />);
    expect(screen.getByText('desktop')).toBeTruthy();
    act(() => mq.set(true));
    expect(screen.getByText('mobile')).toBeTruthy();
    expect(mq.listenerCount()).toBe(1);
    unmount();
    expect(mq.listenerCount()).toBe(0);
  });
});
