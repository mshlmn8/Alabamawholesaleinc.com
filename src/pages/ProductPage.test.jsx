// The product page takes the quantity saved from an older cart (AW-354).
// Fixtures carry no prices.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductPage } from './ProductPage.jsx';

const P = [{ id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] }];
const page = (props) => <ProductPage productId={1} products={P} cart={{}} addLine={vi.fn()} decLine={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />;
const qty = () => screen.getByRole('group', { name: 'Quantity to add' }).querySelector('b').textContent;

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
