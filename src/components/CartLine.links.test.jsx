// Cart lines link back to their product (AW-239): the name is the line's one
// link, the thumbnail is the same link out of the tab order, and following
// either runs onChoose (the drawer closes itself). A line whose product left
// the catalog keeps plain text. Prices are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CartLine } from './CartLine.jsx';

const item = { lineKey: '14', productId: 14, variant: null, needsVariant: false, name: 'Kite', sku: 'AW-KITE', qty: 40, img: null, price: 12.34 };
const renderLine = (props) => render(<ul><CartLine onSetQty={vi.fn()} onRemove={vi.fn()} {...props} /></ul>);

describe('CartLine links (AW-239)', () => {
  for (const layout of ['drawer', 'checkout']) {
    it(`${layout}: the name links to the product page, and the thumbnail is the same link out of the tab order`, () => {
      const onChoose = vi.fn();
      renderLine({ item, layout, showPrice: true, onChoose });
      const name = screen.getByRole('link', { name: 'Kite' });
      expect(name.getAttribute('href')).toBe('/product/14');
      expect(name.className).toBe('line-name');
      // The thumbnail: hidden from screen readers and the tab order, so the line is one tab stop.
      const thumb = document.querySelector('a.thumb');
      expect(thumb.getAttribute('href')).toBe('/product/14');
      expect(thumb.getAttribute('tabindex')).toBe('-1');
      expect(thumb.getAttribute('aria-hidden')).toBe('true');
      expect(screen.getAllByRole('link')).toEqual([name]);
      fireEvent.click(name);
      fireEvent.click(thumb);
      expect(onChoose).toHaveBeenCalledTimes(2);
    });
  }

  it('links a line that needs a variant, next to its "Choose variant" link', () => {
    renderLine({ item: { ...item, needsVariant: true, qty: 2 }, layout: 'drawer' });
    expect(screen.getByRole('link', { name: 'Kite' }).getAttribute('href')).toBe('/product/14');
    expect(screen.getByRole('link', { name: 'Choose variant' }).getAttribute('href')).toBe('/product/14');
  });

  it('links a line whose variant went away: the product is still there', () => {
    renderLine({ item: { ...item, name: 'Kite — Menthol', unavailable: 'variant', price: null }, layout: 'checkout' });
    expect(screen.getByRole('link', { name: 'Kite — Menthol' }).getAttribute('href')).toBe('/product/14');
  });

  it('keeps plain text for a product that left the catalog, with or without what is known of it', () => {
    const view = renderLine({ item: { ...item, unavailable: 'product', price: null }, layout: 'drawer' });
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('.info b').textContent).toBe('Kite');
    expect(document.querySelector('span.thumb')).toBeTruthy();
    view.rerender(<ul><CartLine item={{ ...item, name: 'Product #999', productId: 999, sku: '', img: null, unavailable: 'product', price: null }} layout="checkout" onRemove={vi.fn()} /></ul>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('span.thumb').childNodes).toHaveLength(0);
  });

  it('works without onChoose (checkout)', () => {
    renderLine({ item, layout: 'checkout' });
    expect(() => fireEvent.click(screen.getByRole('link', { name: 'Kite' }))).not.toThrow();
  });
});

// The checkout line's padding (AW-081) and the name link's look.
describe('cart line styles (AW-081, AW-239)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\n)\\s*${escaped} \\{([^}]*)\\}`).exec(css)?.[2]?.trim() ?? null;
  };

  it('gives checkout lines 16px inside their border with a rule that outranks .drawer-line', () => {
    // One rule, which also sets the checkout line's grid areas (AW-306).
    expect(rule('.drawer-line.checkout-line')).toMatch(/border: 1px solid var\(--line\); padding: 12px 16px;$/);
    expect(rule('.checkout-line')).toBeNull();
  });

  it('keeps the name’s look, underlined on focus, and on hover only with a mouse', () => {
    expect(rule('.drawer-line .line-name')).toBe('display: block; font-size: var(--text-sm); font-weight: 700; color: var(--ink); line-height: 1.4; text-decoration: none;');
    expect(rule('.drawer-line .line-name:focus-visible')).toBe('text-decoration: underline; text-underline-offset: var(--link-offset);');
    expect(css).toMatch(/@media \(hover: hover\) \{\s*\.drawer-line \.line-name:hover \{ text-decoration: underline; text-underline-offset: var\(--link-offset\); \}\s*\}/);
  });
});
