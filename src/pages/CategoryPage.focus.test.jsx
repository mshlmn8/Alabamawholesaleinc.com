// Keyboard focus on a department page: removing a filter chip or pressing
// Clear all never drops focus to <body> (NEW-005); the phone pill row keeps
// the current line centred once the fonts are in (AW-157) and brings a pill
// reached with Tab clear of its ends (NEW-084).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { CategoryPage, PILL_EDGE, revealedScrollLeft } from './CategoryPage.jsx';

const products = [
  { id: 1, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [], tag: 'NEW' },
  { id: 2, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Grape', 'Diamond'], tag: 'BESTSELLER' },
  { id: 3, name: 'Backwoods', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BW', variants: [], tag: null },
];
const departments = [{ key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 3 }];

// App's wiring, inside <main> as on the site.
function Harness() {
  const { raw } = useRoute();
  const route = resolveRoute(raw, { departments, products });
  if (route.page !== 'category') return <p>{route.page}</p>;
  return (
    <main id="main">
      <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                    products={products} departments={departments} profile={null} isApprovedBuyer={false}
                    cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />
    </main>
  );
}
const url = () => window.location.pathname + window.location.search;
const note = () => document.querySelector('.result-note');
const inMain = () => document.querySelector('main').contains(document.activeElement);
// Focus the button and press it, as a keyboard user does.
const press = (button) => {
  act(() => button.focus());
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
};
// The compact layout: MOBILE_QUERY matches.
const phone = () => vi.stubGlobal('matchMedia', vi.fn((media) => ({ media, matches: true, addEventListener() {}, removeEventListener() {} })));

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete document.fonts;
  delete Element.prototype.scrollIntoView;
});

describe('focus after a filter change (NEW-005)', () => {
  it('moves from a removed chip to the next one, else the one before, else the result note, all inside main', () => {
    act(() => navigate('/category/tobacco/cigars?tags=bestseller&variants=1', { replace: true }));
    render(<Harness />);
    const chip = (name) => screen.getByRole('button', { name: `Remove filter ${name}` });
    // Cigars, Bestsellers, Has variants: the first goes, the next takes focus.
    press(chip('Cigars'));
    expect(url()).toBe('/category/tobacco?tags=bestseller&variants=1');
    expect(document.activeElement).toBe(chip('Bestsellers'));
    // The last chip of two: the one before it.
    press(chip('Has variants'));
    expect(document.activeElement).toBe(chip('Bestsellers'));
    // The only chip: the row goes, and focus lands on the result note.
    press(chip('Bestsellers'));
    expect(url()).toBe('/category/tobacco');
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
    expect(document.activeElement).toBe(note());
    expect(note().getAttribute('tabindex')).toBe('-1');
    expect(inMain()).toBe(true);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('moves from the chip row’s Clear all and the sidebar’s Clear all to the result note', () => {
    act(() => navigate('/category/tobacco?tags=bestseller&q=swisher', { replace: true }));
    render(<Harness />);
    press(within(screen.getByRole('list', { name: 'Active filters' })).getByRole('button', { name: 'Clear all' }));
    expect(url()).toBe('/category/tobacco');
    expect(document.activeElement).toBe(note());

    act(() => navigate('/category/tobacco?tags=new', { replace: true }));
    press(screen.getByRole('button', { name: 'Clear all (1)' }));
    expect(url()).toBe('/category/tobacco');
    expect(document.activeElement).toBe(note());
    expect(note().textContent).toBe('Showing 3 of 3 products');
  });

  it('keeps focus in the phone drawer after its Clear all: on the drawer’s first control', () => {
    phone();
    act(() => navigate('/category/tobacco/cigars?tags=bestseller', { replace: true }));
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Filter & Sort/ }));
    const drawer = screen.getByRole('dialog', { name: 'Filter & Sort' });
    press(within(drawer).getByRole('button', { name: 'Clear all (2)' }));
    expect(url()).toBe('/category/tobacco');
    const first = within(screen.getByRole('dialog', { name: 'Filter & Sort' })).getByRole('radio', { name: 'All (3)' });
    expect(document.activeElement).toBe(first);
    expect(first.checked).toBe(true);
  });

  it('leaves focus alone when it wasn’t lost', () => {
    act(() => navigate('/category/tobacco?tags=bestseller&variants=1', { replace: true }));
    render(<Harness />);
    const box = screen.getByRole('searchbox', { name: 'Search in Tobacco' });
    act(() => box.focus());
    // A mouse click that didn't move focus (Safari doesn't focus buttons).
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Bestsellers' }));
    expect(url()).toBe('/category/tobacco?variants=1');
    expect(document.activeElement).toBe(box);
  });
});

describe('the phone pill row (AW-157, NEW-084)', () => {
  // Pill positions in the scrolling row, their offsetParent; the row is 200px wide.
  const layout = { 'All (3)': [16, 80], 'Cigarettes (1)': [104, 120], 'Cigars (2)': [232, 100] };
  const stubLayout = () => {
    const pillBox = (el) => (el.classList.contains('sub-pill') ? layout[el.textContent] : null);
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function left() { return pillBox(this)?.[0] ?? 0; });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function width() { return pillBox(this)?.[1] ?? 0; });
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function parent() { return pillBox(this) ? this.parentElement : null; });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function client() { return this.classList.contains('sub-pills') ? 200 : 0; });
    const row = { left: 0, writes: [] };
    // Rendered boxes on screen: a pill moves left as the row scrolls.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      const box = pillBox(this);
      const left = box ? box[0] - row.left : 0;
      const width = box ? box[1] : 0;
      return { left, width, right: left + width, x: left, top: 0, y: 0, bottom: 0, height: 0 };
    });
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockImplementation(function get() { return this.classList.contains('sub-pills') ? row.left : 0; });
    vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(function set(value) {
      if (!this.classList.contains('sub-pills')) return;
      row.left = value;
      row.writes.push(value);
    });
    return row;
  };

  it('centres the current line again once the web fonts are in, and when the row or the pill resizes (AW-157)', async () => {
    phone();
    const row = stubLayout();
    let fontsIn;
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise((resolve) => { fontsIn = resolve; }) } });
    const observers = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { this.callback = callback; this.targets = []; this.live = true; observers.push(this); }
      observe(el) { this.targets.push(el); }
      disconnect() { this.live = false; }
    });
    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    render(<Harness />);
    expect(row.writes).toEqual([182]);
    // (The Filter & Sort row's height has an observer of its own, NEW-081.)
    const rowObservers = () => observers.filter((o) => o.targets[0]?.classList.contains('sub-pills'));
    const [observer] = rowObservers();
    expect(observer.targets.map((el) => el.className)).toEqual(['sub-pills', 'sub-pill active']);
    // The visitor scrolls the row; then the fonts arrive, wider: centred again.
    row.left = 0;
    layout['Cigars (2)'] = [250, 120];
    await act(async () => { fontsIn(); await Promise.resolve(); });
    expect(row.writes).toEqual([182, 210]);
    // The row resizes (the phone turned): centred again.
    layout['Cigars (2)'] = [232, 100];
    act(() => observer.callback([]));
    expect(row.writes).toEqual([182, 210, 182]);
    // Another line: the old observer is gone, a new one watches the new pill.
    fireEvent.click(screen.getByRole('link', { name: 'Cigarettes (1)' }));
    expect(observer.live).toBe(false);
    expect(rowObservers()).toHaveLength(2);
    expect(rowObservers()[1].targets[1].textContent).toBe('Cigarettes (1)');
  });

  it('brings a pill that takes focus at least 20px inside the row, moving the row only (NEW-084)', () => {
    phone();
    const row = stubLayout();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    act(() => navigate('/category/tobacco', { replace: true }));
    render(<Harness />);
    // All is current and at the start: the row stays at 0.
    expect(row.writes).toEqual([0]);
    // Cigars (232..332) in a 200px row: its end comes 20px in from the right.
    act(() => screen.getByRole('link', { name: 'Cigars (2)' }).focus());
    expect(row.left).toBe(332 + PILL_EDGE - 200);
    // Back to All (16..96): 20px in from the left is past the start, so 0.
    act(() => screen.getByRole('link', { name: 'All (3)' }).focus());
    expect(row.left).toBe(0);
    // A pill already clear of both ends moves nothing.
    row.left = 60;
    const writes = row.writes.length;
    act(() => screen.getByRole('link', { name: 'Cigarettes (1)' }).focus());
    expect(row.writes).toHaveLength(writes);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('leaves the row alone on focus in the desktop layout', () => {
    const row = stubLayout();
    render(<Harness />);
    act(() => screen.getByRole('link', { name: 'Cigars (2)' }).focus());
    expect(row.writes).toEqual([]);
  });
});

describe('revealedScrollLeft (NEW-084)', () => {
  const row = (scrollLeft) => ({ clientWidth: 390, scrollLeft });

  it('moves the row as little as it can to bring the pill 20px inside either end', () => {
    // The finding's 'Papers & Cones (7)' at 292..442 in a 0..390 row.
    expect(revealedScrollLeft({ left: 292, width: 150 }, row(0))).toBe(442 + 20 - 390);
    // Partly past the start: 20px in from the left.
    expect(revealedScrollLeft({ left: 310, width: 100 }, row(300))).toBe(290);
    // Clear of both ends: unchanged.
    expect(revealedScrollLeft({ left: 200, width: 100 }, row(100))).toBe(100);
    // Near the start of the content: never below 0.
    expect(revealedScrollLeft({ left: 16, width: 80 }, row(30))).toBe(0);
    // Fractions round away from the edge: never a pixel short.
    expect(revealedScrollLeft({ left: 292.4, width: 150.3 }, row(0))).toBe(73);
    expect(revealedScrollLeft({ left: 310.6, width: 100 }, row(300))).toBe(290);
  });

  it('shows the start of a pill wider than the row', () => {
    expect(revealedScrollLeft({ left: 500, width: 400 }, row(0))).toBe(480);
  });
});
