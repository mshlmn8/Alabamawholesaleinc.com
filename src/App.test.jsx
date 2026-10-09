// The page frame (AW-314, AW-166): one banner landmark holding the skip link,
// the trade bar and the header, with the skip link first in the tab order
// and moving focus to <main> without changing the address. The browser
// checks (keyboard, landmarks with axe) are in the Playwright smoke test.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No backend: the bundled catalog, a signed-out visitor, nothing on the network.
vi.mock('./lib/supabase.js', () => ({ supabase: null, isBackendConfigured: false, AUTH_STORAGE_KEY: 'aw-auth' }));

const { default: App } = await import('./App.jsx');
const { AuthProvider } = await import('./lib/auth.jsx');
const { CatalogProvider } = await import('./lib/catalog.jsx');
const { PricesProvider } = await import('./lib/prices.jsx');
const { navigate } = await import('./lib/router.js');
const { confirmAge } = await import('./lib/ageGate.js');

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let root;
const renderApp = () => render(
  <AuthProvider client={null}>
    <CatalogProvider client={null}>
      <PricesProvider client={null}>
        <App />
      </PricesProvider>
    </CatalogProvider>
  </AuthProvider>,
  { container: root },
);

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.localStorage.clear();
  confirmAge();
  root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  act(() => navigate('/terms', { replace: true }));
});
afterEach(() => {
  root.remove();
  window.localStorage.clear();
});

describe('page frame', () => {
  it('has one banner, holding the skip link, the trade bar and the header', () => {
    renderApp();
    expect(root.hasAttribute('inert')).toBe(false); // past the age gate
    const banners = screen.getAllByRole('banner');
    expect(banners).toHaveLength(1);
    const [banner] = banners;
    expect(banner.classList.contains('site-header')).toBe(true);
    expect(banner.firstElementChild.matches('a.skip-link')).toBe(true);
    for (const part of ['.trade-bar', '.aw-header']) expect(banner.querySelector(part), part).toBeTruthy();
    expect(banner.querySelector('.aw-header').tagName).toBe('DIV');
    // The policy page's own nav and the footer's are told apart.
    const policyNavs = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));
    expect(policyNavs).toContain('Customer policies');
    expect(policyNavs).toContain('Policies');
    expect(new Set(policyNavs).size).toBe(policyNavs.length);
  });

  it('starts the tab order with the skip link, which focuses <main> and leaves the address alone', () => {
    renderApp();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(root.querySelector(FOCUSABLE)).toBe(skip);
    expect(skip.getAttribute('href')).toBe('#main');
    const main = document.getElementById('main');
    main.scrollIntoView = vi.fn();
    const followed = fireEvent.click(skip);
    expect(followed).toBe(false); // the default (adding '#main' to the address) is prevented
    expect(document.activeElement).toBe(main);
    expect(main.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(window.location.pathname + window.location.hash).toBe('/terms');
  });
});
