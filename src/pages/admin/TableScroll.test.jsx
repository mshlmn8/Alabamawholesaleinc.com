// The admin table scroller (AW-266): a named, focusable region that says
// when its table scrolls sideways (NEW-075), and brings keyboard focus out
// from under its sticky cells.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVERFLOW_SLACK_PX, PIN_GAP, TableScroll, isOverflowing } from './TableScroll.jsx';

const renderScroll = () => render(
  <TableScroll label="Accounts table">
    <table className="aw-table"><tbody><tr><td><button type="button">Approve</button></td></tr></tbody></table>
  </TableScroll>,
);

// jsdom has no layout: a box's widths, and a ResizeObserver to call by hand.
const widths = (el, scrollWidth, clientWidth) => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth });
};
let observed;
const stubResizeObserver = () => {
  observed = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { this.callback = callback; }
    observe(el) { observed.push({ el, run: () => this.callback([]) }); }
    disconnect() {}
  });
};
afterEach(() => { vi.unstubAllGlobals(); });

describe('TableScroll', () => {
  it('is a named region in the tab order', () => {
    renderScroll();
    const region = screen.getByRole('region', { name: 'Accounts table' });
    expect(region.tabIndex).toBe(0);
    expect(region.className).toBe('table-scroll');
  });

  it('says the table scrolls sideways whenever it is wider than the box, at any width, and only then (NEW-075)', () => {
    stubResizeObserver();
    renderScroll();
    const region = screen.getByRole('region', { name: 'Accounts table' });
    // jsdom lays out nothing: no overflow, no hint.
    expect(screen.queryByText('Scroll sideways for more columns.')).toBeNull();
    // It watches the box and its table.
    expect(observed.map((o) => o.el)).toEqual([region, region.firstElementChild]);
    widths(region, 1127, 734);
    act(() => observed[0].run());
    expect(region.className).toBe('table-scroll is-overflowing');
    expect(region.previousElementSibling.textContent).toBe('Scroll sideways for more columns.');
    expect(region.previousElementSibling.className).toBe('result-note table-hint');
    // Wide enough again (a pixel of rounding allowed): the hint goes.
    widths(region, 1279, 1278);
    act(() => observed[1].run());
    expect(region.className).toBe('table-scroll');
    expect(screen.queryByText('Scroll sideways for more columns.')).toBeNull();
    expect(isOverflowing(null)).toBe(false);
  });

  // The Accounts table at 1024px was 961px in a 958px box: the hint showed,
  // though nothing but its last cell's padding was out of view.
  it('says nothing for an overflow of a few pixels, less than a cell’s padding', () => {
    stubResizeObserver();
    renderScroll();
    const region = screen.getByRole('region', { name: 'Accounts table' });
    const hint = () => screen.queryByText('Scroll sideways for more columns.');
    expect(OVERFLOW_SLACK_PX).toBe(4);
    for (const [scrollWidth, overflowing] of [[961, false], [962, false], [963, true], [1127, true], [958, false]]) {
      widths(region, scrollWidth, 958);
      act(() => observed[0].run());
      expect(isOverflowing(region), `${scrollWidth}px in 958px`).toBe(overflowing);
      expect(region.classList.contains('is-overflowing')).toBe(overflowing);
      expect(!!hint()).toBe(overflowing);
    }
  });

  it('keeps focus clear of a pinned last column, and doesn’t scroll for a control inside it (NEW-075)', () => {
    stubResizeObserver();
    render(
      <TableScroll label="Products table" pinEnd>
        <table className="aw-table admin-products">
          <thead><tr><th><button type="button">Updated</button></th><th>Actions</th></tr></thead>
          <tbody><tr><td>Oct 1</td><td><a href="/admin/products/1">Edit</a></td></tr></tbody>
        </table>
      </TableScroll>,
    );
    const region = screen.getByRole('region', { name: 'Products table' });
    widths(region, 1127, 734);
    act(() => observed[0].run());
    expect(region.className).toBe('table-scroll pin-end is-overflowing');
    const sort = screen.getByRole('button', { name: 'Updated' });
    const edit = screen.getByRole('link', { name: 'Edit' });
    const pin = region.querySelector('thead th:last-child');
    for (const el of [sort, edit]) {
      el.matches = (selector) => selector === ':focus-visible';
      el.scrollIntoView = vi.fn();
    }
    pin.getBoundingClientRect = () => ({ left: 566, right: 734 });
    sort.getBoundingClientRect = () => ({ left: 520, right: 600 });
    region.scrollLeft = 100;
    fireEvent.focus(sort);
    expect(sort.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(region.scrollLeft).toBe(100 + 34 + PIN_GAP);
    fireEvent.focus(edit);
    expect(edit.scrollIntoView).not.toHaveBeenCalled();
    expect(region.scrollLeft).toBe(100 + 34 + PIN_GAP);
  });

  it('scrolls a control that takes the keyboard focus out from under the sticky cells, and nothing else', () => {
    renderScroll();
    const region = screen.getByRole('region', { name: 'Accounts table' });
    const button = screen.getByRole('button', { name: 'Approve' });
    button.scrollIntoView = vi.fn();
    region.scrollIntoView = vi.fn();
    // A mouse click's focus (not :focus-visible) is left where it is.
    button.matches = () => false;
    fireEvent.focus(button);
    expect(button.scrollIntoView).not.toHaveBeenCalled();
    button.matches = (selector) => selector === ':focus-visible';
    fireEvent.focus(button);
    expect(button.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    // The region itself taking the focus scrolls nothing.
    fireEvent.focus(region);
    expect(region.scrollIntoView).not.toHaveBeenCalled();
  });

  it('goes back to the top of the table when its resetKey changes, and only then', () => {
    const table = <table className="aw-table"><tbody><tr><td>Row</td></tr></tbody></table>;
    const view = render(<TableScroll label="Products table" resetKey="page-1">{table}</TableScroll>);
    const region = screen.getByRole('region', { name: 'Products table' });
    let top = 0;
    Object.defineProperty(region, 'scrollTop', { configurable: true, get: () => top, set: (value) => { top = value; } });
    top = 400;
    view.rerender(<TableScroll label="Products table" resetKey="page-1">{table}</TableScroll>);
    expect(top).toBe(400);
    view.rerender(<TableScroll label="Products table" resetKey="page-2">{table}</TableScroll>);
    expect(top).toBe(0);
  });
});
