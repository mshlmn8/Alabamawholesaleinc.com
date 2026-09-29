// The shared cart line (AW-331). Prices are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartLine } from './CartLine.jsx';

const item = { lineKey: '14', productId: 14, variant: null, needsVariant: false, name: 'Kite', sku: 'AW-KITE', qty: 40, img: null, price: 41.1635 };
const handlers = () => ({ onInc: vi.fn(), onDec: vi.fn(), onRemove: vi.fn(), onChoose: vi.fn() });
const renderLine = (props) => render(<ul><CartLine {...props} /></ul>);

describe('CartLine', () => {
  it('drawer layout: unit price after the SKU, no line total', () => {
    const h = handlers();
    renderLine({ item, layout: 'drawer', showPrice: true, ...h });
    expect(screen.getByText('AW-KITE · $41.16')).toBeTruthy();
    expect(screen.queryByText('$1,646.54')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kite' }));
    expect(h.onInc).toHaveBeenCalledTimes(1);
    expect(h.onDec).toHaveBeenCalledTimes(1);
    expect(h.onRemove).toHaveBeenCalledTimes(1);
  });

  it('checkout layout: "each" price and a line total', () => {
    renderLine({ item, layout: 'checkout', showPrice: true, ...handlers() });
    expect(screen.getByText('AW-KITE · $41.16 each')).toBeTruthy();
    expect(screen.getByText('$1,646.54')).toBeTruthy();
  });

  it('hides prices when showPrice is off', () => {
    renderLine({ item, layout: 'checkout', showPrice: false, ...handlers() });
    expect(screen.getByText('AW-KITE')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('asks for a variant instead of showing the stepper', () => {
    const h = handlers();
    const bare = { ...item, needsVariant: true, qty: 1 };
    renderLine({ item: bare, layout: 'drawer', showPrice: false, ...h });
    expect(screen.getByText('AW-KITE · Choose a variant')).toBeTruthy();
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
    expect(screen.getByText('AW-KITE · Quantity 3 · No longer available')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kite' }));
    expect(h.onRemove).toHaveBeenCalledTimes(1);
  });

  it('offers another variant when only the variant went away (AW-083)', () => {
    const gone = { ...item, name: 'Kite — Menthol', unavailable: 'variant', price: null, qty: 2 };
    renderLine({ item: gone, layout: 'checkout', showPrice: true, ...handlers() });
    expect(screen.getByText('AW-KITE · Quantity 2')).toBeTruthy();
    expect(screen.getByText('No longer available. Remove it to continue.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Choose variant' }).getAttribute('href')).toBe('/product/14');
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});
