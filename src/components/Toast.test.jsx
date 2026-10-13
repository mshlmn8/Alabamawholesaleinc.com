// The toast (AW-072, AW-042, NEW-042): outside #root, a named region while
// it shows, never a live region, never taking focus, hidden after six
// seconds unless hovered or focused, and its action handed to App.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { TOAST_MS, dismissToast, getToast, showToast } from '../lib/toast.js';
import { Toast } from './Toast.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const ADDED = { text: 'Added Kite cigarette tobacco to your quote.', action: { id: 'open-cart', label: 'View quote' } };
const host = () => document.getElementById('aw-toasts');
const toastText = () => host()?.querySelector('.toast-text')?.textContent ?? null;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => dismissToast());
  vi.useRealTimers();
  vi.mocked(announce).mockClear();
});

describe('Toast', () => {
  it('renders nothing until there is a toast, then the text, the action and Dismiss in a body-level host', () => {
    const { container } = render(<div id="root"><Toast onAction={vi.fn()} /></div>);
    expect(host()?.childElementCount ?? 0).toBe(0);
    act(() => { showToast(ADDED); });
    expect(toastText()).toBe(ADDED.text);
    expect(host().parentElement).toBe(document.body);
    expect(container.contains(host())).toBe(false);
    expect(host().closest('#aw-layers')).toBeNull();
    const toast = host().querySelector('.toast');
    expect(screen.getByRole('button', { name: 'View quote' }).className).toBe('button on-dark sm toast-action');
    expect(screen.getByRole('button', { name: 'Dismiss' }).querySelector('svg.icon')).toBeTruthy();
    // The text is the only child of its paragraph (AW-039).
    expect(toast.querySelector('.toast-text').childNodes).toHaveLength(1);
  });

  it('is not a live region: showToast speaks the text once through announce()', () => {
    render(<Toast onAction={vi.fn()} />);
    act(() => { showToast(ADDED); });
    expect(host().querySelector('[aria-live], [role="status"], [role="alert"], [role="log"]')).toBeNull();
    expect(host().querySelector('.toast').getAttribute('aria-live')).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  // axe 'region' (NEW-042): the host is outside main, the header and the
  // footer, so the toast is a landmark of its own, named, and only while it
  // shows; it is still not a live region (above).
  it('is a region named Notifications while it shows, and leaves no empty landmark when it goes', () => {
    render(<Toast onAction={vi.fn()} />);
    act(() => { showToast(ADDED); });
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.className).toBe('toast-root');
    expect(region.parentElement).toBe(host());
    expect(region.contains(host().querySelector('.toast-text'))).toBe(true);
    expect(region.contains(screen.getByRole('button', { name: 'View quote' }))).toBe(true);
    expect(region.getAttribute('aria-live')).toBeNull();
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('region')).toBeNull();
    expect(host().querySelector('[role="region"]')).toBeNull();
  });

  it('never takes focus', () => {
    render(<><button type="button">Add to quote</button><Toast onAction={vi.fn()} /></>);
    const add = screen.getByRole('button', { name: 'Add to quote' });
    add.focus();
    act(() => { showToast(ADDED); });
    expect(document.activeElement).toBe(add);
  });

  it('hides itself after six seconds, and a new toast gets its full time', () => {
    render(<Toast onAction={vi.fn()} />);
    act(() => { showToast(ADDED); });
    act(() => vi.advanceTimersByTime(TOAST_MS - 100));
    expect(toastText()).toBe(ADDED.text);
    act(() => { showToast({ ...ADDED, text: 'Added Snickers bars to your quote.' }); });
    act(() => vi.advanceTimersByTime(TOAST_MS - 100));
    expect(toastText()).toBe('Added Snickers bars to your quote.');
    act(() => vi.advanceTimersByTime(200));
    expect(toastText()).toBeNull();
    expect(getToast()).toBeNull();
  });

  it('waits while the pointer is over it or focus is in it', () => {
    render(<Toast onAction={vi.fn()} />);
    act(() => { showToast(ADDED); });
    const toast = host().querySelector('.toast');
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(TOAST_MS * 2));
    expect(toastText()).toBe(ADDED.text);
    fireEvent.mouseLeave(toast);
    fireEvent.focus(screen.getByRole('button', { name: 'View quote' }));
    act(() => vi.advanceTimersByTime(TOAST_MS * 2));
    expect(toastText()).toBe(ADDED.text);
    fireEvent.blur(screen.getByRole('button', { name: 'View quote' }));
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(toastText()).toBeNull();
  });

  it('hands its action to App and goes, with focus back where it came from', () => {
    const onAction = vi.fn();
    render(<div id="root"><button type="button">Add to quote</button><Toast onAction={onAction} /></div>);
    const add = screen.getByRole('button', { name: 'Add to quote' });
    add.focus();
    act(() => { showToast(ADDED); });
    const view = screen.getByRole('button', { name: 'View quote' });
    view.focus();
    fireEvent.click(view);
    expect(onAction).toHaveBeenCalledWith('open-cart');
    expect(getToast()).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('goes on Dismiss, without its action, and focus doesn’t drop to <body>', () => {
    const onAction = vi.fn();
    render(<div id="root"><main id="main"><h1>Candies</h1><button type="button">Add to quote</button></main><Toast onAction={onAction} /></div>);
    const add = screen.getByRole('button', { name: 'Add to quote' });
    add.focus();
    act(() => { showToast(ADDED); });
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    dismiss.focus();
    fireEvent.click(dismiss);
    expect(onAction).not.toHaveBeenCalled();
    expect(toastText()).toBeNull();
    expect(document.activeElement).toBe(add);
  });
});

// Where the toast sits among the layers, and when it moves (src/index.css).
describe('toast styles', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const zIndex = (selector) => Number(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')} \\{[^}]*z-index: (\\d+)`).exec(css)?.[1]);

  it('sits over the header, mega menu and search results, and under dialogs and the age gate', () => {
    const toast = zIndex('.toast-root');
    expect(toast).toBe(50);
    for (const below of ['.aw-header', '.aw-mega-menu', '.aw-search-results']) expect(zIndex(below), below).toBeLessThan(toast);
    for (const above of ['.aw-layer', '.aw-layer.age-gate-layer']) expect(zIndex(above), above).toBeGreaterThan(toast);
    expect(css).toMatch(/\.toast-root \{[^}]*position: fixed;[^}]*pointer-events: none;/);
    expect(css).toMatch(/\.toast-root \{[^}]*max\(16px, env\(safe-area-inset-bottom\)\)/);
  });

  it('stops moving under prefers-reduced-motion, hovers only with a mouse, and is not printed', () => {
    // The site-wide block stops every animation, the toast's and the badge's included.
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\) \{(\s*[^{}]+\{[^{}]*\})*?\s*\*, \*::before, \*::after \{ transition: none !important; animation: none !important; \}/);
    expect(css).toMatch(/\.toast \{[^}]*animation: toast-in /);
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.toast \.icon-btn:not\(:disabled\):hover/);
    expect(css).toMatch(/@media print \{\s*\.toast-root \{ display: none; \}/);
  });
});
