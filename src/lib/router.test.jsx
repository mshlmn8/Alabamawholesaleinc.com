// History API router (AW-043, AW-327, AW-065): navigation, links, dialog
// history entries and the legacy '#/' redirect. One router instance serves
// the whole file, like the app.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushHistory, popstates } from '../test/history.js';
import { confirmLeave, holdOverlayEntry, Link, navigate, redirectLegacyHash, setNavigationGuard, useNavigationEffects, useRoute } from './router.js';

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

describe('leave guard (AW-118)', () => {
  // The browser's Back: the entry below becomes current, then popstate.
  const popTo = (path, state) => act(() => {
    window.history.replaceState(state, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  it('keeps the page when the guard says no, and lets the navigation go ahead when it says yes', () => {
    render(<ShowRoute />);
    act(() => navigate('/admin/products?q=kite'));
    const length = window.history.length;
    const guard = vi.fn(() => false);
    const release = setNavigationGuard(guard);
    act(() => navigate('/admin/orders'));
    expect(guard).toHaveBeenCalledWith('/admin/orders');
    expect(url()).toBe('/admin/products?q=kite');
    expect(window.history.length).toBe(length);
    expect(screen.getByTestId('route').textContent).toBe('admin /admin/products?q=kite');
    // The URL already shown is not a navigation.
    guard.mockClear();
    act(() => navigate('/admin/products?q=kite'));
    expect(guard).not.toHaveBeenCalled();
    // force skips the guard.
    act(() => navigate('/admin/products?q=swisher', { replace: true, force: true }));
    expect(url()).toBe('/admin/products?q=swisher');
    guard.mockReturnValue(true);
    act(() => navigate('/admin/accounts'));
    expect(url()).toBe('/admin/accounts');
    expect(screen.getByTestId('route').textContent).toBe('admin /admin/accounts');
    release();
  });

  it('confirmLeave asks the newest guard for a page change without a link (signing out)', () => {
    expect(confirmLeave('/')).toBe(true);
    const guard = vi.fn(() => false);
    const release = setNavigationGuard(guard);
    expect(confirmLeave('/')).toBe(false);
    expect(guard).toHaveBeenCalledWith('/');
    guard.mockReturnValue(true);
    expect(confirmLeave('/')).toBe(true);
    release();
    expect(confirmLeave('/')).toBe(true);
    expect(guard).toHaveBeenCalledTimes(2);
  });

  it('asks only the newest guard, and none once released', () => {
    const older = vi.fn(() => false);
    const newer = vi.fn(() => true);
    const releaseOlder = setNavigationGuard(older);
    const releaseNewer = setNavigationGuard(newer);
    act(() => navigate('/terms'));
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
    expect(url()).toBe('/terms');
    releaseNewer();
    act(() => navigate('/privacy'));
    expect(url()).toBe('/terms');
    releaseOlder();
    act(() => navigate('/privacy'));
    expect(url()).toBe('/privacy');
  });

  it('puts the page back when Back is refused', () => {
    render(<ShowRoute />);
    act(() => navigate('/admin/orders'));
    const below = window.history.state;
    act(() => navigate('/admin/products'));
    const here = window.history.state.awKey;
    const length = window.history.length;
    const release = setNavigationGuard(() => false);
    popTo('/admin/orders', below);
    expect(url()).toBe('/admin/products');
    expect(window.history.state.awKey).toBe(here);
    expect(window.history.length).toBe(length + 1);
    expect(screen.getByTestId('route').textContent).toBe('admin /admin/products');
    release();
    popTo('/admin/orders', below);
    expect(screen.getByTestId('route').textContent).toBe('admin /admin/orders');
  });

  it('leaves Back closing a dialog alone', async () => {
    act(() => navigate('/admin/products'));
    const guard = vi.fn(() => false);
    const release = setNavigationGuard(guard);
    const close = vi.fn();
    const releaseDialog = holdOverlayEntry(close);
    const state = { ...window.history.state };
    delete state.awOverlay;
    popTo('/admin/products', state);
    expect(close).toHaveBeenCalledTimes(1);
    expect(guard).not.toHaveBeenCalled();
    expect(url()).toBe('/admin/products');
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    releaseDialog();
    await Promise.resolve();
    release();
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

// Back/Forward put focus back where it was (NEW-007): the link (or cart
// line, or id) that had focus when the entry was left is stored beside its
// scroll position, and focused again, without scrolling, once it is back on
// screen; the h1 or <main> only when it isn't.
describe('focus after Back/Forward (NEW-007)', () => {
  const back = (state, path) => act(() => {
    window.history.replaceState(state, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  // jsdom has no layout: every element is "in view" unless listed.
  const offScreen = new Set();
  beforeEach(() => {
    offScreen.clear();
    // jsdom has no scrollIntoView either.
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      const top = offScreen.has(this) ? 5000 : 100;
      return { top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20, x: 0, y: top };
    });
  });

  afterEach(() => { delete Element.prototype.scrollIntoView; });

  function Cards() {
    useNavigationEffects();
    return (
      <main id="main" tabIndex={-1}>
        <h1>Candies</h1>
        <article><h3><a className="card-link" href="/product/5">Wrigley’s slim pack gum</a></h3></article>
        <a href="/terms?q=typed+text">Trade terms</a>
        <section id="dept-food-stuff"><h2>Food Stuff</h2></section>
        <a href="#dept-food-stuff">Jump to Food Stuff</a>
      </main>
    );
  }

  it('focuses the card link the visitor left from after Back, and stores no query string', () => {
    render(<Cards />);
    act(() => navigate('/category/candies'));
    const below = window.history.state;
    const card = screen.getByRole('link', { name: 'Wrigley’s slim pack gum' });
    card.focus();
    act(() => navigate('/product/5'));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    // Stored for a reload too, as a path only.
    window.dispatchEvent(new Event('pagehide'));
    const stored = JSON.parse(window.sessionStorage.getItem('aw-scroll'));
    expect(stored[below.awKey].focus).toEqual({ href: '/product/5' });
    back(below, '/category/candies');
    expect(document.activeElement).toBe(card);

    // A link with a query: only its path is kept.
    act(() => navigate('/category/candies?sort=name'));
    screen.getByRole('link', { name: 'Trade terms' }).focus();
    const here = window.history.state.awKey;
    act(() => navigate('/terms?q=typed+text'));
    window.dispatchEvent(new Event('pagehide'));
    expect(JSON.parse(window.sessionStorage.getItem('aw-scroll'))[here].focus).toEqual({ href: '/terms' });
    expect(window.sessionStorage.getItem('aw-scroll')).not.toMatch(/typed/);
  });

  it('falls back to the h1 when that link is gone or off screen, and Back from an anchor jump never leaves focus on an off-screen heading', () => {
    render(<Cards />);
    act(() => navigate('/catalog'));
    const top = window.history.state;
    const card = screen.getByRole('link', { name: 'Wrigley’s slim pack gum' });
    card.focus();
    act(() => navigate('/product/5'));
    offScreen.add(card);
    back(top, '/catalog');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));

    // An anchor jump on the same page, then Back at the top of the page.
    act(() => navigate('/catalog'));
    const before = window.history.state;
    act(() => navigate('/catalog#dept-food-stuff'));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Food Stuff' }));
    offScreen.add(screen.getByRole('heading', { name: 'Food Stuff' }));
    back(before, '/catalog');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('after Back from an anchor jump further down, focuses the jump link, or <main> when it is off screen', () => {
    const scrollY = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(800);
    render(<Cards />);
    act(() => navigate('/catalog'));
    const jump = screen.getByRole('link', { name: 'Jump to Food Stuff' });
    jump.focus();
    const before = window.history.state;
    act(() => navigate('/catalog#dept-food-stuff'));
    back(before, '/catalog');
    expect(document.activeElement).toBe(jump);

    act(() => navigate('/catalog#dept-food-stuff'));
    offScreen.add(jump);
    back(before, '/catalog');
    expect(document.activeElement).toBe(document.getElementById('main'));
    scrollY.mockRestore();
  });

  it('keeps only well-formed focus records from storage', async () => {
    vi.resetModules();
    window.sessionStorage.setItem('aw-scroll', JSON.stringify({
      good: { x: 0, y: 40, focus: { href: '/product/5' } },
      bad: { x: 0, y: 40, focus: { href: 'javascript:alert(1)' } },
      long: { x: 0, y: 40, focus: { id: `a${'b'.repeat(300)}` } },
    }));
    window.history.replaceState({ awKey: 'good' }, '', '/category/candies');
    const fresh = await import('./router.js');
    function Restore() {
      const { restore } = fresh.useLocation();
      return <p data-testid="restore">{JSON.stringify(restore)}</p>;
    }
    render(<Restore />);
    expect(JSON.parse(screen.getByTestId('restore').textContent)).toEqual({ x: 0, y: 40, focus: { href: '/product/5' } });
    for (const key of ['bad', 'long']) {
      act(() => {
        window.history.replaceState({ awKey: key }, '', `/${key}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(JSON.parse(screen.getByTestId('restore').textContent)).toEqual({ x: 0, y: 40 });
    }
    window.sessionStorage.removeItem('aw-scroll');
  });
});

// Forward onto a dialog's entry after Back closed the dialog (NEW-028).
// jsdom's Back and Forward land a few tasks later, and the router answers
// the Forward with a Back of its own: each step waits for its popstate
// events, not for a fixed time a busy machine can outrun (a 30ms sleep let
// the bounce land after the assertion).
describe('Forward onto a closed dialog’s entry (NEW-028)', () => {
  it('goes straight back to the page’s entry, so the next Back leaves the page', async () => {
    act(() => navigate('/category/tobacco'));
    act(() => navigate('/category/candies'));
    const close = vi.fn();
    const release = holdOverlayEntry(close);
    expect(window.history.state.awOverlay).toBe(true);
    const backed = popstates(1);
    window.history.back();
    await backed;
    expect(close).toHaveBeenCalledTimes(1);
    release();
    // Back already took the entry: releasing it starts no traversal.
    const back = vi.spyOn(window.history, 'back');
    await flushHistory();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
    expect(url()).toBe('/category/candies');
    // Forward onto the closed dialog's entry, then the router's Back off it.
    const bounced = popstates(2);
    window.history.forward();
    await bounced;
    // Bounced back off the dialog's entry, which is never current again.
    expect(url()).toBe('/category/candies');
    expect(window.history.state.awOverlay).toBeUndefined();
    await flushHistory();
    expect(window.history.state.awOverlay).toBeUndefined();
    const left = popstates(1);
    window.history.back();
    await left;
    expect(url()).toBe('/category/tobacco');
  });
});
