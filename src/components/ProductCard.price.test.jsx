// An approved buyer's price on a product card (AW-107): the figure in its own
// element, larger than the name, with what it buys under it when the product
// has a sell unit, and the same caption over the cards on the department and
// home pages, from my_prices()' tier. Prices are test values.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { CategoryPage } from '../pages/CategoryPage.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { ProductCard } from './ProductCard.jsx';

const BOX = { id: 37, name: 'Airheads bars 36-count', brand: 'Airheads', cat: 'CANDIES', sub: 'Sweets & Gummies', sku: 'AW-AIRHEADS-36CT', sellUnit: '36-count box' };
const KITE = { id: 14, name: 'Kite cigarette tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE' };
const APPROVED = { profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true, pricesStatus: 'ready' };
const card = (p, props = {}) => (
  <ProductCard p={p} profile={null} isApprovedBuyer={false} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} {...props} />
);
const priceBox = () => document.querySelector('.card-meta > .card-price');
const SILVER = { tier: 'silver', label: 'Silver (5% off)', discountPct: 5 };

describe('ProductCard price (AW-107)', () => {
  it('shows the price in its own element, and "per" the sell unit under it', () => {
    render(card(BOX, { ...APPROVED, priceOf: () => 20.34 }));
    const box = priceBox();
    expect(box.querySelector('b').textContent).toBe('$20.34');
    expect(box.querySelector('small').textContent).toBe('per 36-count box');
    expect(box.firstElementChild.tagName).toBe('B');
    expect(box.children).toHaveLength(2);
  });

  it('leaves the unit line off a product without a sell unit, and while there is no price to go with it', () => {
    const view = render(card(KITE, { ...APPROVED, priceOf: () => 13.4 }));
    expect(priceBox().textContent).toBe('$13.40');
    expect(priceBox().querySelector('small')).toBeNull();
    view.rerender(card(BOX, { ...APPROVED, priceOf: () => null, pricesStatus: 'loading' }));
    expect(priceBox().textContent).toBe('Loading price…');
    view.rerender(card(BOX, { ...APPROVED, priceOf: () => null }));
    expect(priceBox().textContent).toBe('Price on request');
  });

  // NEW-054: never a word in price type (AW-133's rule).
  it('says the price didn’t load in a sentence, in place of the price box', () => {
    const view = render(card(BOX, { ...APPROVED, priceOf: () => null, pricesStatus: 'error' }));
    expect(priceBox()).toBeNull();
    const note = document.querySelector('.card-meta > .card-price-failed');
    expect(note.tagName).toBe('SPAN');
    expect(note.textContent).toBe('Your price didn’t load.');
    expect(note.querySelector('b')).toBeNull();
    expect(document.querySelector('.card-meta b')).toBeNull();
    // The add button is still there.
    expect(document.querySelector('.card-add').textContent).toMatch(/^Add to order/);
    // A price kept from an earlier load is still the card's figure.
    view.rerender(card(BOX, { ...APPROVED, priceOf: () => 20.34, pricesStatus: 'error' }));
    expect(priceBox().querySelector('b').textContent).toBe('$20.34');
    expect(document.querySelector('.card-price-failed')).toBeNull();
  });

  it('shows "From" for variants priced differently', () => {
    const p = { ...BOX, variants: ['Blue', 'Cherry'] };
    render(card(p, { ...APPROVED, priceOf: (id, v) => (v === 'Blue' ? 21 : 20.34) }));
    expect(priceBox().textContent).toBe('From $20.34per 36-count box');
  });

  it('has no price box for guests or accounts awaiting approval', () => {
    const view = render(card(BOX, { priceOf: () => 20.34 }));
    expect(priceBox()).toBeNull();
    expect(document.querySelector('.card-meta').textContent).not.toMatch(/\$/);
    view.rerender(card(BOX, { profile: { id: 'p', status: 'pending' }, priceOf: () => 20.34 }));
    expect(priceBox()).toBeNull();
  });
});

describe('whose prices the cards show (AW-107)', () => {
  const departments = [{ key: 'CANDIES', label: 'Candies', subs: ['Sweets & Gummies'], count: 1 }];
  const category = (props) => (
    <CategoryPage category="CANDIES" products={[BOX]} departments={departments} cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} {...props} />
  );
  const intro = () => document.querySelector('.page-head h1 + p').textContent;

  it('names the tier and its discount in the department intro, from my_prices()', () => {
    const view = render(category({ ...APPROVED, priceOf: () => 20.34, priceTier: SILVER }));
    expect(intro()).toBe('Wholesale candies for licensed retail accounts: 1 product in 1 product line. Prices shown are your Silver tier prices, 5% off list.');
    view.rerender(category({ ...APPROVED, priceOf: () => 20.34, priceTier: { tier: 'standard', discountPct: 0 } }));
    expect(intro()).toBe('Wholesale candies for licensed retail accounts: 1 product in 1 product line. Prices shown are your Standard tier prices.');
    // Before the prices are in, no tier is named.
    view.rerender(category({ ...APPROVED, priceOf: () => null, pricesStatus: 'loading', priceTier: null }));
    expect(intro()).toBe('Wholesale candies for licensed retail accounts: 1 product in 1 product line. Prices shown are your account prices.');
  });

  it('captions the New arrivals and Bestsellers rails for an approved buyer only', () => {
    const home = (props) => (
      <HomePage products={PRODUCTS} departments={departmentsFor(PRODUCTS)} profile={null} isApprovedBuyer={false} cart={{}}
                addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} onApplyClick={() => {}} {...props} />
    );
    const notes = () => [...document.querySelectorAll('#new-arrivals .section-head .result-note, #bestsellers .section-head .result-note')].map((el) => el.textContent);
    const view = render(home({ ...APPROVED, priceOf: () => 10, priceTier: SILVER }));
    expect(notes()).toEqual(['Prices shown are your Silver tier prices, 5% off list.', 'Prices shown are your Silver tier prices, 5% off list.']);
    view.rerender(home({}));
    expect(notes()).toEqual([]);
    view.rerender(home({ profile: { id: 'p', status: 'pending' } }));
    expect(notes()).toEqual([]);
  });
});
