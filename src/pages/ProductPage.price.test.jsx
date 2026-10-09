// The product page's price block for an approved buyer (AW-265): the tier's
// price, the list price and the saving from my_prices(), the SKU once it is
// known, and quantity × price = line total under the quantity. Amounts are
// test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPage } from './ProductPage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const SNICKERS = { id: 162, sku: 'AW-SNICKERS', name: 'Snickers bars', brand: 'Snickers', cat: 'CANDIES', sub: 'Chocolate Bars', variants: ['Regular', 'King size'], variantAxis: 'Variety' };
const KITE = { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', variants: [] };
const SILVER = { tier: 'silver', label: 'Silver (5% off)', discountPct: 5 };
const approved = (props) => ({
  profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true, pricesStatus: 'ready', priceTier: SILVER,
  priceOf: () => 32.35, listOf: () => 34.05, ...props,
});
const page = (product, props) => (
  <ProductPage productId={product.id} products={[product]} cart={{}} addLine={vi.fn(() => ({ key: 'k', qty: 1 }))} decLine={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />
);
const lines = () => [...document.querySelector('.pd-price').children].map((el) => el.textContent);
// The SKU line, for everyone (AW-234); the price block has no SKU of its own.
const sku = () => document.querySelector('.pd-sku').textContent;
const qtyNote = () => document.querySelector('.qty-row + .pd-line-total')?.textContent ?? null;
const qtyInput = () => screen.getByRole('group', { name: 'Quantity to add' }).querySelector('input');

describe('ProductPage price context (AW-265)', () => {
  it('names the tier, strikes through the list price and says what is saved', () => {
    render(page(KITE, approved()));
    expect(lines()).toEqual(['$32.35', 'Silver price', 'list $34.05 · you save 5%']);
    expect(sku()).toBe('SKU AW-KITE');
    const save = document.querySelector('.pd-save');
    expect(save.querySelector('s').textContent).toBe('$34.05');
    expect(save.querySelector('strong').textContent).toBe('5%');
  });

  it('asks to "Choose a variety", and names the chosen variant’s SKU once there is one', () => {
    render(page(SNICKERS, approved()));
    expect(lines()).toEqual(['$32.35', 'Silver price', 'list $34.05 · you save 5%']);
    expect(document.querySelector('.pd-variant-label').textContent).toBe('Choose a variety');
    expect(sku()).toBe('SKU AW-SNICKERS');
    fireEvent.click(screen.getByRole('radio', { name: 'King size' }));
    expect(sku()).toBe('SKU AW-SNICKERS-KING-SIZE');
  });

  it('shows quantity × price = line total under the quantity, in cents', () => {
    render(page(KITE, approved()));
    expect(qtyNote()).toBe('1 × $32.35 = $32.35');
    fireEvent.change(qtyInput(), { target: { value: '6' } });
    fireEvent.blur(qtyInput());
    expect(qtyNote()).toBe('6 × $32.35 = $194.10');
  });

  it('works the line total in cents, so it is the cart’s line total', () => {
    // In floats 0.1 × 3 is 0.30000000000000004.
    render(page(KITE, approved({ priceOf: () => 0.1, listOf: () => 0.11 })));
    fireEvent.change(qtyInput(), { target: { value: '3' } });
    fireEvent.blur(qtyInput());
    expect(qtyNote()).toBe('3 × $0.10 = $0.30');
  });

  it('leaves out the saving and the line total where they would not be one figure', () => {
    // Variants priced differently: "From", no list price, no line total.
    const view = render(page(SNICKERS, approved({ priceOf: (id, v) => (v === 'King size' ? 40.5 : 32.35), listOf: (id, v) => (v === 'King size' ? 42.6 : 34.05) })));
    expect(lines()).toEqual(['From $32.35', 'Silver price']);
    expect(qtyNote()).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'King size' }));
    expect(lines()).toEqual(['$40.50', 'Silver price', 'list $42.60 · you save 5%']);
    expect(qtyNote()).toBe('1 × $40.50 = $40.50');
    // A tier without a discount: no saving to show.
    view.rerender(page(KITE, approved({ priceTier: { tier: 'standard', discountPct: 0 }, priceOf: () => 34.05 })));
    expect(lines()).toEqual(['$34.05', 'Standard price']);
    // Price on request, or prices still loading: no tier price, no line total.
    view.rerender(page(KITE, approved({ priceOf: () => null, listOf: () => null })));
    expect(lines()).toEqual(['Price on request', 'Wholesale unit price']);
    expect(qtyNote()).toBeNull();
    view.rerender(page(KITE, approved({ priceOf: () => null, listOf: () => null, pricesStatus: 'loading', priceTier: null })));
    expect(lines()).toEqual(['Loading price…', 'Wholesale unit price']);
  });

  // The locked slot's own wording is AW-133's (ProductPage.locked.test.jsx).
  it('shows guests and accounts awaiting approval none of it', () => {
    const view = render(page(KITE, { priceOf: () => 32.35, listOf: () => 34.05, priceTier: SILVER }));
    expect(lines()[0]).toBe('Wholesale prices show here for approved trade accounts.');
    expect(qtyNote()).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$3[24]\.|you save|Silver price/);
    view.rerender(page(KITE, { profile: { id: 'p', status: 'pending' }, priceOf: () => 32.35, listOf: () => 34.05, priceTier: SILVER }));
    expect(lines()[0]).toBe('Pricing unlocks when your account is approved.');
    expect(qtyNote()).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$3[24]\.|you save|Silver price/);
  });
});
