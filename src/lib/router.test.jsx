// History API router (AW-043, AW-327, AW-065): navigation, links, dialog
// history entries and the legacy '#/' redirect. One router instance serves
// the whole file, like the app.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdOverlayEntry, Link, navigate, redirectLegacyHash, useNavigationEffects, useRoute } from './router.js';

const url = () => window.location.pathname + window.location.search + window.location.hash;

beforeEach(() => {
  // jsdom has no layout or scrolling.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

function ShowRoute() {
  const { raw, location } = useRoute();
  return <p data-testid="route">{`${raw.page} ${location.pathname}${location.search}`}</p>;
}

function Effects() {
  useNavigationEffects();
  return <main><h1>Page</h1></main>;
}

describe('navigate', () => {
  it('pushes path URLs, and replace rewrites the current entry', () => {
    const start = window.history.length;
    act(() => navigate({ page: 'category', category: 'DRINKS & BAGS', sub: 'Energy Drinks' }));
    expect(url()).toBe('/category/drinks-and-bags/energy-drinks');
    expect(window.history.length).toBe(start + 1);
    act(() => navigate('/category/drinks-and-bags?tags=new', { replace: true, scroll: false }));
    expect(url()).toBe('/category/drinks-and-bags?tags=new');
    expect(window.history.length).toBe(start + 1);
  });

  it('adds no history entry for the URL already shown (AW-327)', () => {
    act(() => navigate('/contact'));
    const length = window.history.length;
    act(() => navigate('/contact'));
    act(() => navigate({ page: 'contact' }));
    expect(window.history.length).toBe(length);
  });

  it('updates useRoute subscribers, also on Back/Forward', () => {
    render(<ShowRoute />);
    act(() => navigate('/product/12'));
    expect(screen.getByTestId('route').textContent).toBe('product /product/12');
    act(() => {
      window.history.replaceState(window.history.state, '', '/privacy');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByTestId('route').textContent).toBe('privacy /privacy');
  });

  it('redirects an old #/ link pasted while the site is open', () => {
    render(<ShowRoute />);
    act(() => {
      window.history.pushState(null, '', '/#/product/7');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(url()).toBe('/product/7');
    expect(screen.getByTestId('route').textContent).toBe('product /product/7');
  });
});

describe('page changes (AW-037, AW-041)', () => {
  it('scrolls a new page to the top at once and focuses its heading', () => {
    render(<Effects />);
    window.scrollTo.mockClear();
    act(() => navigate('/terms'));
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    expect(document.activeElement.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the scroll position and focus when only filters change', () => {
    render(<Effects />);
    act(() => navigate('/category/tobacco'));
    const button = document.body.appendChild(document.createElement('button'));
    button.focus();
    window.scrollTo.mockClear();
    act(() => navigate('/category/tobacco?q=kite', { replace: true, scroll: false }));
    act(() => navigate('/category/tobacco/cigarettes?q=kite', { scroll: false }));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('announces the new page title in the shared live region', () => {
    vi.useFakeTimers();
    render(<Effects />);
    document.title = 'Trade terms · Alabama Wholesale Inc';
    act(() => navigate('/terms'));
    act(() => vi.advanceTimersByTime(500));
    const region = document.getElementById('aw-announcer');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('Trade terms · Alabama Wholesale Inc');
    vi.useRealTimers();
  });
});

describe('Link', () => {
  it('renders a real href from a route object', () => {
    render(<Link to={{ page: 'category', category: 'TOBACCO', sub: 'Cigarettes' }}>Cigarettes</Link>);
    expect(screen.getByRole('link', { name: 'Cigarettes' }).getAttribute('href')).toBe('/category/tobacco/cigarettes');
  });

  it('navigates inside the app on a plain click', () => {
    const onClick = vi.fn();
    render(<Link to="/catalog" onClick={onClick}>All products</Link>);
    const notPrevented = fireEvent.click(screen.getByRole('link'));
    expect(notPrevented).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(url()).toBe('/catalog');
  });

  it('leaves modified clicks, other buttons and new-tab targets to the browser', () => {
    render(<><Link to="/terms">Terms</Link><Link to="/privacy" target="_blank">Privacy</Link></>);
    const terms = screen.getByRole('link', { name: 'Terms' });
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(fireEvent.click(terms, init)).toBe(true);
    }
    expect(fireEvent.click(screen.getByRole('link', { name: 'Privacy' }))).toBe(true);
    expect(url()).toBe('/');
  });
});

describe('dialog history entries (AW-065)', () => {
  it('Back closes the open dialog through its close handler and keeps the page', async () => {
    act(() => navigate('/category/tobacco'));
    const length = window.history.length;
    const close = vi.fn();
    const release = holdOverlayEntry(close);
    expect(window.history.length).toBe(length + 1);
    expect(window.history.state.awOverlay).toBe(true);
    // The browser's Back lands on the entry below: same URL, no dialog flag.
    act(() => {
      const state = { ...window.history.state };
      delete state.awOverlay;
      window.history.replaceState(state, '');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(url()).toBe('/category/tobacco');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    release();
    await Promise.resolve();
    expect(back).not.toHaveBeenCalled();
  });

  it('closing with × drops the entry again', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const release = holdOverlayEntry(() => {});
    expect(window.history.state.awOverlay).toBe(true);
    release();
    await Promise.resolve();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('a dialog that replaces another shares its entry', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const length = window.history.length;
    const releaseCart = holdOverlayEntry(() => {});
    releaseCart();
    const releaseSignIn = holdOverlayEntry(() => {});
    await Promise.resolve();
    expect(back).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length + 1);
    releaseSignIn();
    await Promise.resolve();
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('a link followed inside a dialog takes over its entry', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    act(() => navigate('/category/candies'));
    const length = window.history.length;
    const release = holdOverlayEntry(() => {});
    act(() => navigate('/quote'));
    release();
    await Promise.resolve();
    expect(url()).toBe('/quote');
    expect(window.history.length).toBe(length + 1);
    expect(window.history.state.awOverlay).toBeUndefined();
    expect(back).not.toHaveBeenCalled();
  });
});

describe('redirectLegacyHash', () => {
  it('turns an old #/ link into its path', () => {
    window.history.replaceState(null, '', '/#/category/TOBACCO/Cigarettes');
    expect(redirectLegacyHash()).toBe(true);
    expect(url()).toBe('/category/TOBACCO/Cigarettes');
  });

  it('leaves Supabase auth fragments for the auth layer', () => {
    window.history.replaceState(null, '', '/#access_token=abc&type=recovery');
    expect(redirectLegacyHash()).toBe(false);
    expect(url()).toBe('/#access_token=abc&type=recovery');
    window.history.replaceState(null, '', '/#error=access_denied&error_description=expired');
    expect(redirectLegacyHash()).toBe(false);
    expect(window.location.hash).toBe('#error=access_denied&error_description=expired');
  });
});
