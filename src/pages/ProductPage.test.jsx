// The product page takes the quantity saved from an older cart (AW-354),
// shows the signed-in buyer's price from priceOf (AW-003, AW-030), and labels
// variants by their axis (AW-233, AW-128). Products carry no prices; the
// amounts are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { dismissToast, getToast } from '../lib/toast.js';
import { ProductPage } from './ProductPage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const P = [{ id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] }];
const page = (props) => <ProductPage productId={1} products={P} cart={{}} addLine={vi.fn()} decLine={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />;
const qty = () => screen.getByRole('group', { name: 'Quantity to add' }).querySelector('input').value;

const pd = () => document.querySelector('.pd-price').textContent;
const APPROVED = { id: 'a', status: 'approved' };

describe('ProductPage prices', () => {
  it('shows "From" the lowest variant price, then the chosen variant’s own price (AW-030)', () => {
    const priceOf = (id, variant) => (variant === 'Red' ? 13.5 : 12.25);
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf, pricesStatus: 'ready' }));
    expect(pd()).toBe('From $12.25Wholesale unit price · AW-SS');
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(pd()).toBe('$13.50Wholesale unit price · AW-SS-RED');
    fireEvent.click(screen.getByRole('button', { name: 'Diamond' }));
    expect(pd()).toBe('$12.25Wholesale unit price · AW-SS-DIAMOND');
  });

  it('shows one price when every variant costs the same', () => {
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => 12.25, pricesStatus: 'ready' }));
    expect(pd()).toBe('$12.25Wholesale unit price · AW-SS');
  });

  it('says "Price on request" for a product without a price, and "Loading price…" while prices load', () => {
    const view = render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => null, pricesStatus: 'ready' }));
    expect(pd()).toBe('Price on requestWholesale unit price · AW-SS');
    view.rerender(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => null, pricesStatus: 'loading' }));
    expect(pd()).toBe('Loading price…Wholesale unit price · AW-SS');
  });

  it('shows no price to guests and accounts awaiting approval, whatever priceOf says', () => {
    const priceOf = () => 12.25;
    const view = render(page({ priceOf }));
    expect(pd()).toBe('Sign inWholesale pricing is visible to approved trade accounts');
    view.rerender(page({ profile: { id: 'p', status: 'pending' }, priceOf }));
    expect(pd()).toBe('PendingPricing unlocks after your account is approved');
  });
});

describe('ProductPage variants (AW-233, AW-128, AW-030)', () => {
  const product = (extra) => ({ ...P[0], ...extra });
  const note = (text) => screen.queryByText(text);
  const FLAVOR_NOTE = 'Flavors and availability change often. The trade desk confirms what is in stock.';

  it('names the choice by the product’s axis, and shows the flavor note only for flavors', () => {
    const view = render(page({ products: [product({ variantAxis: 'Flavor' })] }));
    expect(screen.getByRole('group', { name: 'Choose a flavor' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeTruthy();
    expect(note('Pick a flavor to add it. Add each flavor you want separately.')).toBeTruthy();
    expect(note(/Choose one variant/)).toBeNull();
    view.rerender(page({ products: [product({ variantAxis: 'Size' })] }));
    expect(screen.getByRole('group', { name: 'Choose a size' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
    expect(note('Pick a size to add it. Add each size you want separately.')).toBeTruthy();
    view.rerender(page({ products: [product({ variantAxis: undefined })] }));
    expect(screen.getByRole('group', { name: 'Choose a variant' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
  });

  it('shows no chips for a single variant, and its label as text when the name doesn’t say it', () => {
    const view = render(page({ products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'] })] }));
    expect(screen.queryByRole('group', { name: /Choose/ })).toBeNull();
    expect(document.querySelector('.variant-chips')).toBeNull();
    expect(screen.getByText('Variety: Green')).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
    expect(note(/Pick a/)).toBeNull();
    view.rerender(page({ products: [product({ name: 'RAW tips', variants: ['Tips'] })] }));
    expect(screen.queryByText(/Variety:/)).toBeNull();
    expect(document.querySelector('.variant-chips')).toBeNull();
    view.rerender(page({ products: [product({ variants: [] })] }));
    expect(document.querySelector('.variant-chips')).toBeNull();
    expect(screen.queryByText(/Variety:/)).toBeNull();
  });

  it('adds a single-variant product with its variant, without a choice', () => {
    const addLine = vi.fn();
    render(page({ addLine, products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'] })] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Green', 1);
  });

  it('disables a variant marked not available, says so, and leaves it out of the "From" price', () => {
    const addLine = vi.fn();
    const priceOf = (id, variant) => (variant === 'Red' ? 9.5 : 12.25);
    render(page({
      addLine, profile: APPROVED, isApprovedBuyer: true, priceOf, pricesStatus: 'ready',
      products: [product({ variantAxis: 'Flavor', unavailableVariants: ['Red'] })],
    }));
    const red = screen.getByRole('button', { name: 'Red (not available)' });
    expect(red.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Diamond' }).disabled).toBe(false);
    expect(pd()).toBe('$12.25Wholesale unit price · AW-SS');
    fireEvent.click(red);
    expect(screen.getByRole('button', { name: /Add to order/ }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Diamond' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Diamond', 1);
  });

  it('says so, and adds nothing, when a single variant is marked not available', () => {
    const addLine = vi.fn();
    render(page({ addLine, products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'], unavailableVariants: ['Green'] })] }));
    expect(screen.getByText('Variety: Green (not available)')).toBeTruthy();
    const add = screen.getByRole('button', { name: /Add to quote/ });
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(addLine).not.toHaveBeenCalled();
  });

  it('says what quantity 1 means when the product has a sell unit (AW-031)', () => {
    const view = render(page({ products: [product({ sellUnit: 'box of 200' })] }));
    expect(screen.getByText('Sold by the box of 200 — quantity 1 is one box of 200.')).toBeTruthy();
    view.rerender(page({ products: [product({ sellUnit: '' })] }));
    expect(document.querySelector('.pd-unit')).toBeNull();
  });
});

describe('ProductPage and a saved quantity', () => {
  it('fills in the saved quantity, then what is left of it after an add', () => {
    const addLine = vi.fn();
    const view = render(page({ savedQty: 3, addLine }));
    expect(qty()).toBe('3');
    expect(screen.getByText('From your last visit: quantity 3. Choose a variant, then add it.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Red', 2);
    view.rerender(page({ savedQty: 1, addLine }));
    expect(qty()).toBe('1');
    view.rerender(page({ savedQty: 0, addLine }));
    expect(screen.queryByText(/From your last visit/)).toBeNull();
  });

  it('starts at 1 without a saved quantity', () => {
    render(page({}));
    expect(qty()).toBe('1');
    expect(screen.queryByText(/From your last visit/)).toBeNull();
  });
});

describe('ProductPage quantity (AW-013) and a bare cart line (AW-011)', () => {
  it('can’t go below 1, and takes a typed quantity', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 48, capped: false }));
    render(page({ addLine }));
    const group = screen.getByRole('group', { name: 'Quantity to add' });
    expect(group.className).toBe('stepper');
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(true);
    const input = screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos to add' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    fireEvent.blur(input);
    expect(qty()).toBe('48');
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Red', 48);
    expect(qty()).toBe('1');
  });

  it('doesn’t show a bare line’s quantity as already in the quote, only the chosen variant’s', () => {
    const view = render(page({ cart: { 1: 12 } }));
    expect(screen.queryByText(/Already in/)).toBeNull();
    view.rerender(page({ cart: { 1: 12, '1::red': 3 } }));
    expect(screen.queryByText(/Already in/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect([...document.querySelectorAll('.in-cart-note')].map((n) => n.textContent)).toContain('Already in quote: 3 · Red');
  });
});

// The add is confirmed by the toast, with the quantity and the variant, and
// focus stays on the button (AW-072, AW-042).
describe('ProductPage add feedback', () => {
  afterEach(() => {
    dismissToast();
    vi.mocked(announce).mockClear();
  });
  const typeQty = (n) => {
    const input = screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos to add' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: String(n) } });
    fireEvent.blur(input);
  };

  it('names the quantity, the product and its variant, spoken once, and keeps focus on the button', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 3, capped: false }));
    render(page({ addLine }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    typeQty(3);
    const add = screen.getByRole('button', { name: /Add to quote/ });
    add.focus();
    fireEvent.click(add);
    expect(getToast()).toMatchObject({ text: 'Added 3 × Swisher Sweets cigarillos — Red to your quote.', action: { id: 'open-cart', label: 'View quote' } });
    expect(vi.mocked(announce).mock.calls).toEqual([['Added 3 × Swisher Sweets cigarillos — Red to your quote.']]);
    expect(document.activeElement).toBe(add);
  });

  it('says "order" to an approved buyer, and leaves out a variant the product doesn’t have', () => {
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    render(page({ addLine, profile: APPROVED, isApprovedBuyer: true, products: [{ ...P[0], variants: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }));
    expect(getToast()).toMatchObject({ text: 'Added 1 × Swisher Sweets cigarillos to your order.', action: { label: 'View order' } });
  });

  it('says what fits when the line reaches the 100,000 limit (AW-013)', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 100000, capped: true }));
    const view = render(page({ addLine, cart: { '1::red': 99990 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    typeQty(48);
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast().text).toBe('Added 10 × Swisher Sweets cigarillos — Red to your quote. The most per line is 100,000.');
    view.rerender(page({ addLine, cart: { '1::red': 100000 } }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast().text).toBe('Your quote already has 100,000 × Swisher Sweets cigarillos — Red. The most per line is 100,000.');
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('shows nothing when nothing could be added', () => {
    render(page({ addLine: vi.fn(() => null), products: [{ ...P[0], variants: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast()).toBeNull();
  });

  it('keeps the "Already in" note plain text, not a live region', () => {
    render(page({ cart: { '1::red': 3 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    const note = [...document.querySelectorAll('.in-cart-note')].find((n) => /Already in/.test(n.textContent));
    expect(note.getAttribute('aria-live')).toBeNull();
    expect(note.getAttribute('role')).toBeNull();
  });
});
