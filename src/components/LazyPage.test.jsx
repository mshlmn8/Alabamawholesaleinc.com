// Pages and dialogs whose code loads when first opened (AW-179): the loading
// views, focus once a page's code arrives, and the dialog that says it
// didn't open.
import { Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../lib/router.js';
import { LazyDialog, PageLoading, lazyPage } from './LazyPage.jsx';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const Heading = ({ title }) => <h1>{title}</h1>;
const shell = (children) => (
  <main id="main" tabIndex={-1}>
    <Suspense fallback={<PageLoading />}>{children}</Suspense>
  </main>
);

// React's development build re-dispatches render errors as window errors,
// which jsdom would print; the boundaries are what handle them here.
const swallow = (e) => e.preventDefault();
beforeEach(() => {
  window.addEventListener('error', swallow);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => window.removeEventListener('error', swallow));

describe('PageLoading', () => {
  it('is a page head with a Loading… status and no heading, so the router focuses <main>', () => {
    render(<PageLoading />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(document.querySelector('.page-head.page-loading')).toBeTruthy();
    expect(document.querySelector('h1, h2')).toBeNull();
  });
});

describe('lazyPage', () => {
  it('leaves focus alone on a page opened directly (no navigation yet)', async () => {
    // A fresh router: its first location is the page load.
    vi.resetModules();
    const fresh = await import('./LazyPage.jsx');
    const load = deferred();
    const Page = fresh.lazyPage(() => load.promise);
    render(<main id="main" tabIndex={-1}><Suspense fallback={<fresh.PageLoading />}><Page title="Contact" /></Suspense></main>);
    await act(async () => { load.resolve({ default: Heading }); await load.promise; });
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });

  it('shows the loading view, then the page, whose h1 takes focus from <main> after a navigation', async () => {
    act(() => navigate('/contact'));
    const load = deferred();
    const Page = lazyPage(() => load.promise);
    render(shell(<Page title="Contact" />));
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    expect(screen.queryByRole('heading')).toBeNull();
    // What the router does meanwhile: no h1, so <main> takes focus.
    document.getElementById('main').focus();
    await act(async () => { load.resolve({ default: Heading }); await load.promise; });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Contact' }));
  });

  it('clears the one-reload flag once a page’s code has loaded and it rendered (NEW-006)', async () => {
    window.sessionStorage.setItem('aw-chunk-reload', '/contact');
    const load = deferred();
    const Page = lazyPage(() => load.promise);
    render(shell(<Page title="Contact" />));
    expect(window.sessionStorage.getItem('aw-chunk-reload')).toBe('/contact');
    await act(async () => { load.resolve({ default: Heading }); await load.promise; });
    expect(window.sessionStorage.getItem('aw-chunk-reload')).toBeNull();
  });

  it('leaves focus where the visitor moved it while the page loaded', async () => {
    act(() => navigate('/delivery'));
    const load = deferred();
    const Page = lazyPage(() => load.promise);
    render(
      <main id="main" tabIndex={-1}>
        <input aria-label="Search" />
        <Suspense fallback={<PageLoading />}><Page title="Delivery" /></Suspense>
      </main>
    );
    screen.getByRole('textbox', { name: 'Search' }).focus();
    await act(async () => { load.resolve({ default: Heading }); await load.promise; });
    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
  });
});

describe('LazyDialog', () => {
  it('shows a small Loading… dialog until the dialog’s code arrives, then the dialog', async () => {
    const load = deferred();
    const Dialog = lazyPage(() => load.promise);
    const onClose = vi.fn();
    render(<LazyDialog eyebrow="TRADE ACCOUNTS" onClose={onClose}><Dialog title="Sign in" /></LazyDialog>);
    const loading = screen.getByRole('dialog', { name: 'Loading' });
    expect(loading.textContent).toContain('TRADE ACCOUNTS');
    expect(screen.getByRole('status').textContent).toBe('Loading…');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { load.resolve({ default: Heading }); await load.promise; });
    expect(screen.queryByRole('dialog', { name: 'Loading' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });

  it('says the dialog didn’t open, with Reload, when its code can’t be fetched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = deferred();
    const Dialog = lazyPage(() => load.promise);
    const onClose = vi.fn();
    render(<LazyDialog eyebrow="TRADE ACCOUNTS" onClose={onClose}><Dialog title="Sign in" /></LazyDialog>);
    await act(async () => {
      load.reject(new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/AuthModal-abc.js'));
      await load.promise.catch(() => {});
    });
    const failed = screen.getByRole('alertdialog', { name: 'This didn’t open' });
    expect(failed.getAttribute('aria-describedby')).toBe('lazy-dialog-failed-text');
    expect(document.getElementById('lazy-dialog-failed-text').textContent).toBe('The site may have been updated, or the connection dropped. Reload to try again.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('blames an update or the connection only when the code didn’t download (NEW-019)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // What an older browser throws while the dialog's code runs: the file
    // arrived, so a reload alone won't fix it.
    const load = deferred();
    const Dialog = lazyPage(() => load.promise);
    render(<LazyDialog eyebrow="TRADE ACCOUNTS" onClose={() => {}}><Dialog title="Sign in" /></LazyDialog>);
    await act(async () => {
      load.reject(new TypeError('Qe.at is not a function'));
      await load.promise.catch(() => {});
    });
    expect(screen.getByRole('alertdialog', { name: 'This didn’t open' })).toBeTruthy();
    expect(document.getElementById('lazy-dialog-failed-text').textContent).toBe('Something went wrong opening this. Reload to try again.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });
});
