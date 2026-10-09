// The admin table scroller (AW-266): a named, focusable region with the
// phone hint, which brings keyboard focus out from under its sticky cells.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableScroll } from './TableScroll.jsx';

const renderScroll = () => render(
  <TableScroll label="Accounts table">
    <table className="aw-table"><tbody><tr><td><button type="button">Approve</button></td></tr></tbody></table>
  </TableScroll>,
);

describe('TableScroll', () => {
  it('is a named region in the tab order, after the sideways hint', () => {
    renderScroll();
    const region = screen.getByRole('region', { name: 'Accounts table' });
    expect(region.tabIndex).toBe(0);
    expect(region.className).toBe('table-scroll');
    expect(region.previousElementSibling.textContent).toBe('Scroll sideways for more columns.');
    expect(region.previousElementSibling.className).toBe('result-note table-hint');
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
