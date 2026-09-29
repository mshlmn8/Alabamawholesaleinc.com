// The product card's detail line counts variants by their axis only when
// there is a choice (AW-233, AW-332, AW-128) and says what quantity 1 means
// (AW-031); its price follows the variants (AW-030). Prices are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductCard } from './ProductCard.jsx';

const base = { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS' };
const card = (p, props = {}) => (
  <ProductCard p={p} profile={null} isApprovedBuyer={false} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} {...props} />
);
const detail = () => document.querySelector('.card-detail').textContent;
const price = () => document.querySelector('.card-meta > span:first-child').textContent;
const APPROVED = { profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true, pricesStatus: 'ready' };

describe('ProductCard', () => {
  it('counts variants by their axis, only when there is more than one', () => {
    const view = render(card({ ...base, variants: ['Red', 'Grape', 'Diamond'], variantAxis: 'Flavor' }));
    expect(detail()).toBe('Swisher Sweets · 3 flavors · AW-SS');
    view.rerender(card({ ...base, variants: ['S', 'M'], variantAxis: 'Size' }));
    expect(detail()).toBe('Swisher Sweets · 2 sizes · AW-SS');
    view.rerender(card({ ...base, variants: ['S', 'M'] }));
    expect(detail()).toBe('Swisher Sweets · 2 variants · AW-SS');
    view.rerender(card({ ...base, variants: ['Green'] }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
    view.rerender(card({ ...base, variants: [] }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
    // An old row's stale count is not read.
    view.rerender(card({ ...base, variants: ['Green'], flavors: 5 }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
  });

  it('says what quantity 1 means (AW-031)', () => {
    render(card({ ...base, variants: [], sellUnit: '5-pack' }));
    expect(detail()).toBe('Swisher Sweets · Sold by the 5-pack · AW-SS');
  });

  it('shows "From" the lowest price when the variants are priced differently (AW-030)', () => {
    const p = { ...base, variants: ['Red', 'Grape'], variantAxis: 'Flavor' };
    const view = render(card(p, { ...APPROVED, priceOf: (id, v) => (v === 'Red' ? 9.5 : 12.25) }));
    expect(price()).toBe('From $9.50');
    view.rerender(card(p, { ...APPROVED, priceOf: () => 12.25 }));
    expect(price()).toBe('$12.25');
    // A variant that can't be ordered doesn't set the "From" price.
    view.rerender(card({ ...p, unavailableVariants: ['Red'] }, { ...APPROVED, priceOf: (id, v) => (v === 'Red' ? 9.5 : 12.25) }));
    expect(price()).toBe('$12.25');
    view.rerender(card({ ...base, variants: ['Green'] }, { ...APPROVED, priceOf: (id, v) => (v === 'Green' ? 7.1 : null) }));
    expect(price()).toBe('$7.10');
  });

  it('can’t add a product whose only variant is marked not available (AW-030)', () => {
    const addLine = vi.fn();
    const view = render(card({ ...base, variants: ['Green'], unavailableVariants: ['Green'] }, { addLine }));
    const button = screen.getByRole('button', { name: 'Not available' });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(addLine).not.toHaveBeenCalled();
    view.rerender(card({ ...base, variants: ['Green'] }, { addLine }));
    fireEvent.click(screen.getByRole('button', { name: 'QUOTE +' }));
    expect(addLine).toHaveBeenCalledWith(1, 'Green');
  });
});
