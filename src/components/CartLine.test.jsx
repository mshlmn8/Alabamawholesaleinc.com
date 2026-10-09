// The shared cart line (AW-331). Prices are test values.
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartLine } from './CartLine.jsx';

const item = { lineKey: '14', productId: 14, variant: null, needsVariant: false, name: 'Kite', sku: 'AW-KITE', qty: 40, img: null, price: 12.34 };
const handlers = () => ({ onSetQty: vi.fn(), onRemove: vi.fn(), onChoose: vi.fn(), onChooseVariant: vi.fn() });
const renderLine = (props) => render(<ul><CartLine {...props} /></ul>);
// The SKU line is in parts that wrap between them (TextParts, AW-304): the
// small that reads as this text.
const detailLine = (text) => screen.getByText((_, el) => el.matches('.info > small') && el.textContent === text);

afterEach(() => vi.useRealTimers());

describe('CartLine', () => {
  it('drawer layout: "each" price after the SKU and a line total (AW-103)', () => {
    const h = handlers();
    renderLine({ item, layout: 'drawer', showPrice: true, ...h });
    expect(detailLine('AW-KITE · $12.34 each')).toBeTruthy();
    const total = document.querySelector('.line-total');
    expect(total.tagName).toBe('B');
    expect(total.textContent).toBe('$493.60');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kite' }));
    expect(h.onSetQty.mock.calls).toEqual([[41], [39]]);
    expect(h.onRemove).toHaveBeenCalledTimes(1);
  });

  it('takes a typed quantity, stops − at 1 and leaves removing to Remove (AW-013)', () => {
    const h = handlers();
    const view = renderLine({ item, layout: 'checkout', showPrice: false, ...h });
    const input = screen.getByRole('textbox', { name: 'Quantity of Kite' });
    expect(input.value).toBe('40');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    expect(h.onSetQty).toHaveBeenCalledWith(48);
    view.rerender(<ul><CartLine item={{ ...item, qty: 1 }} layout="checkout" {...h} /></ul>);
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove Kite' })).toBeTruthy();
  });

  it('uses the shared stepper with drawn icons, and a worded Remove that can’t pass for a close × (AW-143, AW-293, AW-306)', () => {
    renderLine({ item, layout: 'drawer', showPrice: false, ...handlers() });
    const group = screen.getByRole('group', { name: 'Kite quantity' });
    expect(group.className).toBe('stepper qty');
    expect(group.querySelectorAll('button > svg.icon')).toHaveLength(2);
    // A text button: its name starts with the word on screen, then says which line.
    const remove = screen.getByRole('button', { name: 'Remove Kite' });
    expect(remove.className).toBe('text-link drawer-remove');
    expect(remove.getAttribute('type')).toBe('button');
    expect(remove.textContent).toBe('Remove');
    expect(remove.querySelector('svg')).toBeNull();
  });

  it('checkout layout: "each" price and a line total', () => {
    renderLine({ item, layout: 'checkout', showPrice: true, ...handlers() });
    expect(detailLine('AW-KITE · $12.34 each')).toBeTruthy();
    expect(screen.getByText('$493.60')).toBeTruthy();
  });

  it('gives a line still waiting for its variant no line total, in either layout (AW-103)', () => {
    const bare = { ...item, needsVariant: true, qty: 8, variants: [{ label: 'Red', available: true }] };
    const view = renderLine({ item: bare, layout: 'drawer', showPrice: true, ...handlers() });
    expect(detailLine('AW-KITE · $12.34 each')).toBeTruthy();
    expect(document.querySelector('.line-total')).toBeNull();
    view.rerender(<ul><CartLine item={bare} layout="checkout" showPrice {...handlers()} /></ul>);
    expect(document.querySelector('.line-total')).toBeNull();
  });

  it('the line total is each x quantity to the cent (AW-077)', () => {
    // 0.10 x 3 is 0.30000000000000004 in floats.
    renderLine({ item: { ...item, price: 0.1, qty: 3 }, layout: 'checkout', showPrice: true, ...handlers() });
    expect(detailLine('AW-KITE · $0.10 each')).toBeTruthy();
    expect(document.querySelector('.line-total').textContent).toBe('$0.30');
  });

  it('says why an approved buyer’s line has no price', () => {
    const view = renderLine({ item: { ...item, price: null }, layout: 'checkout', showPrice: true, pricesStatus: 'loading', ...handlers() });
    expect(detailLine('AW-KITE · Loading price…')).toBeTruthy();
    expect(document.querySelector('.line-total')).toBeNull();
    view.rerender(<ul><CartLine item={{ ...item, price: null }} layout="drawer" showPrice pricesStatus="ready" {...handlers()} /></ul>);
    expect(detailLine('AW-KITE · Price on request')).toBeTruthy();
  });

  it('hides prices when showPrice is off', () => {
    renderLine({ item, layout: 'checkout', showPrice: false, ...handlers() });
    expect(screen.getByText('AW-KITE')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('without variants to offer, links to the product to choose one', () => {
    const h = handlers();
    const bare = { ...item, needsVariant: true, qty: 1 };
    renderLine({ item: bare, layout: 'drawer', showPrice: false, ...h });
    expect(screen.getByText('AW-KITE')).toBeTruthy();
    expect(screen.getByText('1 unit · choose a variant')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    const choose = screen.getByRole('link', { name: 'Choose variant' });
    expect(choose.getAttribute('href')).toBe('/product/14');
    fireEvent.click(choose);
    expect(h.onChoose).toHaveBeenCalledTimes(1);
  });

  it('keeps an unavailable line’s quantity on show, without a stepper or price (AW-083)', () => {
    const h = handlers();
    const gone = { ...item, unavailable: 'product', price: null, qty: 3 };
    renderLine({ item: gone, layout: 'drawer', showPrice: true, ...h });
    expect(detailLine('AW-KITE · Quantity 3 · No longer available')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kite' }));
    expect(h.onRemove).toHaveBeenCalledTimes(1);
  });

  it('says what quantity 1 means in both layouts (AW-031)', () => {
    const boxed = { ...item, sku: 'AW-TUBES', name: 'Tubes', sellUnit: 'box of 200' };
    const view = renderLine({ item: boxed, layout: 'drawer', showPrice: true, ...handlers() });
    expect(detailLine('AW-TUBES · Sold by the box of 200 · $12.34 each')).toBeTruthy();
    view.rerender(<ul><CartLine item={boxed} layout="checkout" showPrice {...handlers()} /></ul>);
    expect(detailLine('AW-TUBES · Sold by the box of 200 · $12.34 each')).toBeTruthy();
    view.rerender(<ul><CartLine item={boxed} layout="checkout" showPrice={false} {...handlers()} /></ul>);
    expect(detailLine('AW-TUBES · Sold by the box of 200')).toBeTruthy();
    view.rerender(<ul><CartLine item={{ ...boxed, sellUnit: '' }} layout="drawer" showPrice={false} {...handlers()} /></ul>);
    expect(screen.getByText('AW-TUBES')).toBeTruthy();
  });

  it('offers another variant when only the variant went away (AW-083)', () => {
    const gone = { ...item, name: 'Kite — Menthol', unavailable: 'variant', price: null, qty: 2 };
    renderLine({ item: gone, layout: 'checkout', showPrice: true, ...handlers() });
    expect(detailLine('AW-KITE · Quantity 2')).toBeTruthy();
    expect(screen.getByText('No longer available. Remove it to continue.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Choose variant' }).getAttribute('href')).toBe('/product/14');
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});

// A bare line chooses its variant in the cart and keeps its quantity (AW-011).
const FLAVORS = { label: 'Flavor', noun: 'flavor', plural: 'flavors' };
const bareLine = {
  lineKey: '1', productId: 1, variant: null, needsVariant: true, unavailable: null, name: 'Swisher Sweets cigarillos', productName: 'Swisher Sweets cigarillos',
  sku: 'AW-SS', qty: 12, img: null, price: null, axis: FLAVORS,
  variants: [{ label: 'Diamond', available: true }, { label: 'Red', available: true }, { label: 'Grape', available: false }],
};

describe('CartLine and a bare line (AW-011)', () => {
  it('says how many and what to choose, in both layouts', () => {
    const view = renderLine({ item: bareLine, layout: 'drawer', ...handlers() });
    expect(screen.getByText('12 units · choose a flavor')).toBeTruthy();
    view.rerender(<ul><CartLine item={bareLine} layout="checkout" {...handlers()} /></ul>);
    expect(screen.getByText('12 units · choose a flavor')).toBeTruthy();
    expect(screen.queryByText(/before submitting/)).toBeNull();
  });

  it('offers the variants in a labelled select, the ones not available disabled, and no "Choose variant" link', () => {
    renderLine({ item: bareLine, layout: 'drawer', ...handlers() });
    const select = screen.getByRole('combobox', { name: 'Choose a flavor for Swisher Sweets cigarillos' });
    expect([...select.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['Choose a flavor…', true], ['Diamond', false], ['Red', false], ['Grape (not available)', true],
    ]);
    expect(select.value).toBe('');
    expect(screen.getByRole('button', { name: 'Set flavor' }).disabled).toBe(true);
    expect(screen.queryByRole('link', { name: 'Choose variant' })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('changes nothing until Set is pressed, then moves the line, announces it and focuses its quantity', () => {
    vi.useFakeTimers();
    const h = handlers();
    // A drawer list that re-keys the line the way the cart does.
    function List() {
      const [line, setLine] = useState(bareLine);
      const onChooseVariant = (key, label) => {
        h.onChooseVariant(key, label);
        const moved = { ...bareLine, lineKey: '1::red', variant: label, needsVariant: false, name: `Swisher Sweets cigarillos — ${label}`, variants: undefined };
        setLine(moved);
        return { key: '1::red', qty: 12 };
      };
      return <ul><CartLine key={line.lineKey} item={line} layout="drawer" onSetQty={h.onSetQty} onRemove={h.onRemove} onChooseVariant={onChooseVariant} /></ul>;
    }
    render(<List />);
    const select = screen.getByRole('combobox', { name: 'Choose a flavor for Swisher Sweets cigarillos' });
    fireEvent.change(select, { target: { value: 'Red' } });
    expect(h.onChooseVariant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set flavor' }));
    expect(h.onChooseVariant).toHaveBeenCalledWith('1', 'Red');
    act(() => vi.advanceTimersByTime(200));
    const input = screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos — Red' });
    expect(input.value).toBe('12');
    expect(document.activeElement).toBe(input);
    expect(document.getElementById('aw-announcer').textContent).toBe('Swisher Sweets cigarillos — Red: quantity 12.');
  });

  it('offers another variant to a line whose variant went away, under the product’s own name', () => {
    const gone = { ...bareLine, lineKey: '1::purple', needsVariant: false, unavailable: 'variant', name: 'Swisher Sweets cigarillos — Purple', qty: 3 };
    renderLine({ item: gone, layout: 'checkout', ...handlers() });
    expect(screen.getByRole('combobox', { name: 'Choose a flavor for Swisher Sweets cigarillos' })).toBeTruthy();
    expect(screen.queryByText(/choose a flavor$/)).toBeNull();
    expect(screen.getByText('No longer available. Remove it to continue.')).toBeTruthy();
  });

  it('falls back to the link when no variant can be ordered', () => {
    const none = { ...bareLine, variants: bareLine.variants.map((v) => ({ ...v, available: false })) };
    renderLine({ item: none, layout: 'drawer', ...handlers() });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('link', { name: 'Choose variant' }).getAttribute('href')).toBe('/product/1');
  });
});
