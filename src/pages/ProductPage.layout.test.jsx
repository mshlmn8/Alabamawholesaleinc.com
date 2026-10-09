// The product page's purchase column (AW-163): the FDA statement, brand and
// name, then the variant, price, quantity and add, and only then the
// description and the SKU fine print, so the add button is on the first
// screen of a laptop. Kept apart from ProductPage.test.jsx.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPage } from './ProductPage.jsx';

const SWISHER = { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'], variantAxis: 'Flavor' };
const TUBES = { id: 2, sku: 'AW-TUBES', name: 'Gambler tubes', brand: 'Gambler', cat: 'TOBACCO', sub: 'Tubes & Filters', variants: ['Gold'], sellUnit: 'box of 200' };
const page = (p, props = {}) => (
  <ProductPage productId={p.id} products={[p]} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} onApplyClick={vi.fn()}
               profile={null} isApprovedBuyer={false} {...props} />
);
// The column's children, each by its first class (or tag).
const column = () => [...document.querySelector('.pd-info').children].map((el) => (el.classList.length ? [...el.classList].join('.') : el.tagName.toLowerCase()));

describe('ProductPage purchase column (AW-163)', () => {
  it('runs warning, name, variants, notes, price, quantity and add, then the description and fine print', () => {
    render(page(SWISHER, { savedQty: 3 }));
    expect(column()).toEqual([
      'nicotine-warning', 'pd-brand', 'h1', 'variant-chips', 'in-cart-note', 'in-cart-note', 'pd-saved',
      'pd-price', 'qty-row', 'dialog-actions.compact-actions', 'pd-desc', 'pd-desc.pd-fine',
    ]);
  });

  it('puts the sell unit right above the quantity it explains, and the single variant under the name', () => {
    render(page(TUBES, { profile: { id: 'p', status: 'pending' }, cart: { '2::gold': 4 } }));
    expect(column()).toEqual([
      'pd-brand', 'h1', 'pd-desc', 'pd-price', 'pd-unit', 'qty-row', 'in-cart-note',
      'dialog-actions.compact-actions', 'pd-desc', 'pd-desc.pd-fine',
    ]);
    expect(document.querySelector('.pd-info > .pd-desc').textContent).toBe('Variety: Gold');
  });
});
