// Header search combobox (AW-171, AW-165, AW-222, AW-307), with the real
// router and history like src/lib/router.test.jsx.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { navigate } from '../lib/router.js';
import { catLabel } from '../lib/format.js';
import { searchProducts } from '../lib/search.js';
import { HeaderSearch, SEARCH_PREVIEW, STATUS_DELAY_MS, headerStuck } from './HeaderSearch.jsx';

const url = () => window.location.pathname + window.location.search;
const box = () => screen.getByRole('combobox', { name: 'Search products' });
const type = (text) => fireEvent.change(box(), { target: { value: text } });
const key = (name) => fireEvent.keyDown(box(), { key: name });
const options = () => screen.queryAllByRole('option');
const active = () => box().getAttribute('aria-activedescendant');
const activeOption = () => document.getElementById(active());
const heading = () => document.querySelector('.aw-search-heading p')?.textContent ?? null;
const liveStatus = () => screen.getByRole('status');

function renderSearch(props = {}) {
  return render(
    <div>
      <HeaderSearch products={PRODUCTS} {...props} />
      <button type="button">Outside</button>
    </div>,
  );
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});
afterEach(() => vi.useRealTimers());

describe('combobox semantics (AW-171)', () => {
  it('is a combobox that controls a listbox of option links only while it is open', () => {
    renderSearch();
    expect(box().getAttribute('type')).toBe('search');
    expect(box().getAttribute('aria-autocomplete')).toBe('list');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(box().hasAttribute('aria-controls')).toBe(false);
    expect(screen.queryByRole('listbox')).toBeNull();

    type('geek bar');
    const { total, items } = searchProducts(PRODUCTS, 'geek bar');
    const list = screen.getByRole('listbox', { name: 'Products' });
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(box().getAttribute('aria-controls')).toBe(list.id);
    expect(box().hasAttribute('aria-activedescendant')).toBe(false);
    // The products, then "See all" (AW-007): real links, none a Tab stop.
    const opts = options();
    expect(opts).toHaveLength(Math.min(total, SEARCH_PREVIEW) + 1);
    expect(opts[0].getAttribute('href')).toBe(`/product/${items[0].id}`);
    expect(opts.at(-1).textContent).toBe(`See all ${total} results for “geek bar”`);
    expect(opts.at(-1).getAttribute('href')).toBe('/search?q=geek+bar');
    for (const option of opts) {
      expect(option.tagName).toBe('A');
      expect(option.getAttribute('tabindex')).toBe('-1');
      expect(option.getAttribute('aria-selected')).toBe('false');
    }
  });

  it('gives each result its department, line and SKU as parts that wrap between them, the SKU kept whole (AW-304)', () => {
    renderSearch();
    type('mental health');
    const { items } = searchProducts(PRODUCTS, 'mental health');
    const first = options()[0];
    const parts = [...first.querySelectorAll('small > .text-parts > span')];
    expect(parts.map((span) => span.textContent.replace(/\u00a0/g, ' ').trim())).toEqual([`${catLabel(items[0].cat)} ·`, `${items[0].sub} ·`, items[0].sku]);
    const code = first.querySelector('.sku-part');
    expect(code).toBe(parts[2]);
    expect(code.getAttribute('title')).toBe(items[0].sku);
  });

  it('shows no listbox when nothing matches, and says so', () => {
    renderSearch();
    type('marlboro');
    expect(heading()).toBe('No matches');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(box().hasAttribute('aria-controls')).toBe(false);
  });

  it('moves the active option with ArrowDown/ArrowUp (wrapping) and Home/End', () => {
    renderSearch();
    type('cigar');
    const count = options().length;
    expect(count).toBe(SEARCH_PREVIEW + 1);
    key('ArrowDown');
    expect(active()).toBe(options()[0].id);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    expect(active()).toBe(options()[1].id);
    expect(options()[0].getAttribute('aria-selected')).toBe('false');
    key('ArrowUp');
    key('ArrowUp');
    expect(active()).toBe(options()[count - 1].id);
    key('ArrowDown');
    expect(active()).toBe(options()[0].id);
    key('End');
    expect(active()).toBe(options()[count - 1].id);
    key('Home');
    expect(active()).toBe(options()[0].id);
    // Focus never leaves the box.
    expect(document.activeElement === box() || document.activeElement === document.body).toBe(true);
  });

  it('leaves Home and End to the caret while no option is active', () => {
    renderSearch();
    type('cigar');
    // fireEvent returns false when the handler called preventDefault().
    expect(fireEvent.keyDown(box(), { key: 'Home' })).toBe(true);
    expect(fireEvent.keyDown(box(), { key: 'End' })).toBe(true);
    expect(active()).toBeNull();
    expect(fireEvent.keyDown(box(), { key: 'ArrowDown' })).toBe(false);
    expect(fireEvent.keyDown(box(), { key: 'End' })).toBe(false);
  });

  it('starts over after typing, and the pointer never makes an option active', () => {
    renderSearch();
    type('cigar');
    key('ArrowDown');
    key('ArrowDown');
    type('cigars');
    expect(active()).toBeNull();
    // A list that opens or scrolls under a resting pointer must not arm
    // Enter: hovering leaves the active option alone.
    fireEvent.mouseEnter(options()[3]);
    fireEvent.mouseMove(options()[3]);
    expect(active()).toBeNull();
    fireEvent.submit(box().closest('form'));
    expect(url()).toBe('/search?q=cigars');
    type('cigar');
    key('ArrowDown');
    fireEvent.mouseEnter(options()[3]);
    expect(active()).toBe(options()[0].id);
  });

  it('opens with ArrowDown after Escape closed it, only for a query of 2+ characters', () => {
    renderSearch();
    type('wraps');
    key('Escape');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    key('ArrowDown');
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(active()).toBeNull();
    type('w');
    key('ArrowDown');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(heading()).toBeNull();
  });
});

describe('Enter and Escape', () => {
  it('Enter follows the active product and clears the box', () => {
    renderSearch();
    type('geek bar');
    key('ArrowDown');
    key('ArrowDown');
    const href = activeOption().getAttribute('href');
    expect(href).toMatch(/^\/product\/\d+$/);
    key('Enter');
    expect(url()).toBe(href);
    expect(box().value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter on "See all" opens /search and keeps the text', () => {
    renderSearch();
    type('geek bar');
    key('ArrowUp');
    expect(activeOption().textContent).toMatch(/^See all/);
    key('Enter');
    expect(url()).toBe('/search?q=geek+bar');
    expect(box().value).toBe('geek bar');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter with no option active opens /search?q= (AW-007), and the box shows that query', () => {
    renderSearch();
    type(' cigar ');
    fireEvent.submit(box().closest('form'));
    expect(url()).toBe('/search?q=cigar');
    expect(box().value).toBe('cigar');
    expect(screen.queryByRole('listbox')).toBeNull();
    // Arriving at /search by other means shows its query too.
    act(() => navigate('/search?q=wraps'));
    expect(box().value).toBe('wraps');
    // Leaving it keeps the text.
    act(() => navigate('/contact'));
    expect(box().value).toBe('wraps');
  });

  it('a 1-character Enter says the query is too short, in the panel and the status', () => {
    vi.useFakeTimers();
    renderSearch();
    type('c');
    expect(heading()).toBeNull();
    fireEvent.submit(box().closest('form'));
    expect(heading()).toBe('Type at least 2 characters');
    expect(url()).toBe('/');
    act(() => vi.advanceTimersByTime(STATUS_DELAY_MS));
    expect(liveStatus().textContent).toBe('Type at least 2 characters');
  });

  it('Escape closes the list and keeps the text; a second Escape clears it', () => {
    renderSearch();
    type('wraps');
    expect(fireEvent.keyDown(box(), { key: 'Escape' })).toBe(false);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(heading()).toBeNull();
    expect(box().value).toBe('wraps');
    key('Escape');
    expect(box().value).toBe('');
  });

  it('the clear button empties the box, closes the list and keeps focus in the box (AW-222)', () => {
    renderSearch();
    box().focus();
    type('wraps');
    const clear = screen.getByRole('button', { name: 'Clear search' });
    expect(clear.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(clear);
    expect(box().value).toBe('');
    expect(heading()).toBeNull();
    expect(document.activeElement).toBe(box());
  });

  it('a click outside closes the list; a click inside does not', () => {
    renderSearch();
    type('wraps');
    fireEvent.click(document.querySelector('.aw-search-heading p'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().value).toBe('wraps');
  });
});

describe('focus leaving the search (AW-165)', () => {
  it('closes when focus moves to a control outside the form', () => {
    renderSearch();
    type('wraps');
    key('ArrowDown');
    fireEvent.blur(box(), { relatedTarget: screen.getByRole('button', { name: 'Search' }) });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.blur(screen.getByRole('button', { name: 'Search' }), { relatedTarget: screen.getByRole('button', { name: 'Outside' }) });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(box().value).toBe('wraps');
  });

  it('stays open on a blur with no relatedTarget (Safari clicking an option)', () => {
    renderSearch();
    type('wraps');
    fireEvent.blur(box(), { relatedTarget: null });
    expect(screen.getByRole('listbox')).toBeTruthy();
    // A mousedown on an option is cancelled, so focus stays in the box.
    expect(fireEvent.mouseDown(options()[0])).toBe(false);
  });

  it('reopens on focus when the box holds a query', () => {
    renderSearch();
    type('wraps');
    key('Escape');
    fireEvent.focus(box());
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('closes on a page change', () => {
    renderSearch();
    type('wraps');
    act(() => navigate('/contact'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box().value).toBe('wraps');
  });
});

describe('announcements', () => {
  it('keeps one status element in the page and fills it once typing pauses', () => {
    vi.useFakeTimers();
    renderSearch();
    const status = liveStatus();
    expect(status.textContent).toBe('');
    expect(status.className).toBe('sr-only');
    type('re');
    type('red');
    type('red bull');
    act(() => vi.advanceTimersByTime(STATUS_DELAY_MS - 50));
    expect(status.textContent).toBe('');
    act(() => vi.advanceTimersByTime(50));
    expect(status.textContent).toBe(heading());
    expect(status.textContent).toMatch(/^\d+ results?$/);
    // The visible heading is plain text, not a second live region.
    expect(screen.getAllByRole('status')).toEqual([status]);
    // Closing empties it at once, so reopening announces the count again.
    key('Escape');
    expect(liveStatus()).toBe(status);
    expect(status.textContent).toBe('');
    key('ArrowDown');
    expect(status.textContent).toBe('');
    act(() => vi.advanceTimersByTime(STATUS_DELAY_MS));
    expect(status.textContent).toBe(heading());
  });

  it('tells the header to close its other menus when the list opens', () => {
    const onOpen = vi.fn();
    renderSearch({ onOpen });
    type('w');
    type('wraps');
    expect(onOpen).toHaveBeenCalledTimes(1);
    key('Escape');
    key('ArrowDown');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});

describe('phones (AW-307)', () => {
  it('scrolls the search bar to the top on focus in the compact layout only', () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      const { unmount } = renderSearch({ isMobile: false });
      fireEvent.focus(box());
      expect(scroll).not.toHaveBeenCalled();
      unmount();
      renderSearch({ isMobile: true });
      fireEvent.focus(box());
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
      expect(scroll.mock.contexts[0]).toBe(box().closest('form'));
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('leaves the page where it is when the sticky masthead is stuck at the top already (AW-153)', () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    const at = { top: 0 };
    const realStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => (el.classList?.contains('site-header') ? { position: 'sticky' } : realStyle(el)));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      const height = this.classList.contains('trade-bar') ? 44 : 158;
      const top = this.classList.contains('site-header') ? at.top : 0;
      return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top };
    });
    try {
      const header = document.createElement('header');
      header.className = 'site-header';
      header.innerHTML = '<div class="trade-bar"></div>';
      document.body.append(header);
      render(<HeaderSearch products={PRODUCTS} isMobile />, { container: header.appendChild(document.createElement('div')) });
      // At the top of the page: the bar scrolls up.
      fireEvent.focus(box());
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(headerStuck(box())).toBe(false);
      // Stuck, the trade bar scrolled away: nothing to do.
      at.top = -44;
      fireEvent.blur(box());
      fireEvent.focus(box());
      expect(headerStuck(box())).toBe(true);
      expect(scroll).toHaveBeenCalledTimes(1);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
      vi.restoreAllMocks();
      document.querySelector('header.site-header')?.remove();
    }
  });
});
