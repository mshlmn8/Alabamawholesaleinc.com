// The product page takes the quantity saved from an older cart (AW-354), and
// shows the signed-in buyer's price from priceOf (AW-003). Products carry no
// prices; the amounts are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPage } from './ProductPage.jsx';

const P = [{ id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] }];
const page = (props) => <ProductPage productId={1} products={P} cart={{}} addLine={vi.fn()} decLine={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />;
const qty = () => screen.getByRole('group', { name: 'Quantity to add' }).querySelector('b').textContent;

const pd = () => document.querySelector('.pd-price').textContent;
const APPROVED = { id: 'a', status: 'approved' };

describe('ProductPage prices', () => {
  it('shows the buyer’s price, and a variant’s own price once it is chosen', () => {
    const priceOf = (id, variant) => (variant === 'Red' ? 13.5 : 12.25);
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf, pricesStatus: 'ready' }));
    expect(pd()).toBe('$12.25Wholesale unit price · AW-SS');
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(pd()).toBe('$13.50Wholesale unit price · AW-SS-RED');
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
