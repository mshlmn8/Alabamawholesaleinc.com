// The product page's purchase column (AW-163, AW-150): the FDA statement,
// brand and name, then the variant chips under their 'Choose a …' label
// (AW-235) and the note about adding each one; then, on a desktop, the price,
// the sell unit, quantity and add, and in the compact layout (tablets and
// phones, MOBILE_QUERY) the sell unit, quantity and add first and the price
// after them, in the DOM so Tab follows the eye; and only then the SKU line
// (AW-234), the description, the flavor note and the fine print. No sign-in
// links under the add button (AW-133). With nothing that can be ordered
// (NEW-052), one sentence in place of the price and the add row. Kept apart
// from ProductPage.test.jsx.
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { ProductPage } from './ProductPage.jsx';

const SWISHER = { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'], variantAxis: 'Flavor' };
const TUBES = { id: 2, sku: 'AW-TUBES', name: 'Gambler tubes', brand: 'Gambler', cat: 'TOBACCO', sub: 'Tubes & Filters', variants: ['Gold'], sellUnit: 'box of 200' };
const page = (p, props = {}) => (
  <ProductPage productId={p.id} products={[p]} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} onApplyClick={vi.fn()}
               profile={null} isApprovedBuyer={false} {...props} />
);
// The column's children, each by its classes (or tag).
const column = () => [...document.querySelector('.pd-info').children].map((el) => (el.classList.length ? [...el.classList].join('.') : el.tagName.toLowerCase()));
// The compact layout: matchMedia answers yes to MOBILE_QUERY only.
const compactLayout = () => vi.stubGlobal('matchMedia', vi.fn((media) => ({ media, matches: media === MOBILE_QUERY, addEventListener() {}, removeEventListener() {} })));
const APPROVED = { profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true, pricesStatus: 'ready', priceOf: () => 14.35 };

afterEach(() => vi.unstubAllGlobals());

describe('ProductPage purchase column on a desktop (AW-163)', () => {
  it('runs warning, name, variants and the note, price, quantity and add, then the SKU, description, flavor note and fine print', () => {
    render(page(SWISHER, { savedQty: 3 }));
    expect(column()).toEqual([
      'nicotine-warning', 'pd-brand', 'h1', 'pd-variant-label', 'variant-chips', 'in-cart-note', 'pd-saved',
      'pd-price.is-locked', 'qty-row', 'pd-sku', 'pd-desc', 'in-cart-note.pd-flavor-note', 'pd-desc.pd-fine',
    ]);
  });

  it('puts the sell unit right above the quantity it explains, and the single variant under the name', () => {
    render(page(TUBES, { profile: { id: 'p', status: 'pending' }, cart: { '2::gold': 4 } }));
    expect(column()).toEqual([
      'pd-brand', 'h1', 'pd-desc', 'pd-price.is-locked', 'pd-unit', 'qty-row', 'in-cart-note',
      'pd-sku', 'pd-desc', 'pd-desc.pd-fine',
    ]);
    expect(document.querySelector('.pd-info > .pd-desc').textContent).toBe('Variety: Gold');
  });

  it('follows the price with the line total and "Already in" for an approved buyer', () => {
    render(page(TUBES, { ...APPROVED, cart: { '2::gold': 4 } }));
    expect(column()).toEqual([
      'pd-brand', 'h1', 'pd-desc', 'pd-price', 'pd-unit', 'qty-row', 'in-cart-note.pd-line-total', 'in-cart-note',
      'pd-sku', 'pd-desc', 'pd-desc.pd-fine',
    ]);
  });
});

describe('ProductPage purchase column in the compact layout (AW-150)', () => {
  it('puts quantity and add straight after the chips and their note, and the price after them', () => {
    compactLayout();
    render(page(SWISHER, { savedQty: 3 }));
    expect(column()).toEqual([
      'nicotine-warning', 'pd-brand', 'h1', 'pd-variant-label', 'variant-chips', 'in-cart-note', 'pd-saved',
      'qty-row', 'pd-price.is-locked', 'pd-sku', 'pd-desc', 'in-cart-note.pd-flavor-note', 'pd-desc.pd-fine',
    ]);
    // In the DOM, so the add button comes before the sign-in button in Tab order.
    const add = document.querySelector('.qty-row .button');
    const signIn = document.querySelector('.pd-price button');
    expect(add.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the sell unit above the quantity, and the line total and "Already in" under it', () => {
    compactLayout();
    render(page(TUBES, { ...APPROVED, cart: { '2::gold': 4 } }));
    expect(column()).toEqual([
      'pd-brand', 'h1', 'pd-desc', 'pd-unit', 'qty-row', 'in-cart-note.pd-line-total', 'in-cart-note', 'pd-price',
      'pd-sku', 'pd-desc', 'pd-desc.pd-fine',
    ]);
  });

  it('keeps the typed quantity when the layout changes', () => {
    let matches = false;
    const listeners = new Set();
    vi.stubGlobal('matchMedia', vi.fn((media) => ({
      media, get matches() { return matches; }, addEventListener: (_t, fn) => listeners.add(fn), removeEventListener: (_t, fn) => listeners.delete(fn),
    })));
    const view = render(page(TUBES, { savedQty: 7 }));
    const input = document.querySelector('.qty-row input');
    expect(input.value).toBe('7');
    matches = true;
    for (const fn of [...listeners]) fn({ matches });
    view.rerender(page(TUBES, { savedQty: 7 }));
    expect(column().indexOf('qty-row')).toBeLessThan(column().indexOf('pd-price.is-locked'));
    // The same element, moved rather than made again.
    expect(document.querySelector('.qty-row input')).toBe(input);
  });
});

describe('ProductPage purchase column when nothing can be ordered (NEW-052)', () => {
  for (const [layout, setUp] of [['desktop', () => {}], ['compact', compactLayout]]) {
    it(`has one sentence in place of the price and the add row (${layout})`, () => {
      setUp();
      render(page({ ...SWISHER, unavailableVariants: ['Diamond', 'Red'] }, { savedQty: 3 }));
      expect(column()).toEqual([
        'nicotine-warning', 'pd-brand', 'h1', 'pd-variant-label', 'variant-chips',
        'pd-price.is-locked.pd-cant-order', 'pd-sku', 'pd-desc', 'pd-desc.pd-fine',
      ]);
    });
  }

  it('leaves out the price, sell unit and line total of a product whose only variant can’t be ordered', () => {
    render(page({ ...TUBES, unavailableVariants: ['Gold'] }, { ...APPROVED, cart: { '2::gold': 4 } }));
    expect(column()).toEqual([
      'pd-brand', 'h1', 'pd-desc', 'pd-price.is-locked.pd-cant-order', 'in-cart-note', 'pd-sku', 'pd-desc', 'pd-desc.pd-fine',
    ]);
  });
});
