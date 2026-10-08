// The product card's detail line counts variants by their axis only when
// there is a choice (AW-233, AW-332, AW-128) and says what quantity 1 means
// (AW-031); its price follows the variants (AW-030). Prices are test values.
import { act, fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote' }));
    expect(addLine).toHaveBeenCalledWith(1, 'Green');
  });

  // Cursor's PR #13 (AW-057, AW-029, AW-136, AW-286).
  it('says "Select options", "Add to quote" or "Add to order", and "Added" after an add (AW-057)', () => {
    vi.useFakeTimers();
    const addLine = vi.fn();
    const view = render(card({ ...base, variants: ['Red', 'Grape'] }, { addLine }));
    expect(screen.getByRole('link', { name: 'Select options' }).getAttribute('href')).toBe('/product/1');
    view.rerender(card({ ...base, variants: ['Red', 'Grape'] }, { addLine, cart: { '1::red': 2 } }));
    expect(screen.getByRole('link', { name: 'Select options · 2' })).toBeTruthy();
    view.rerender(card({ ...base, variants: [] }, { addLine }));
    const note = () => document.querySelector('.added-note').textContent;
    expect(note()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote' }));
    expect(addLine).toHaveBeenCalledWith(1, null);
    expect(note()).toBe('Added');
    act(() => vi.advanceTimersByTime(2100));
    expect(note()).toBe('');
    view.rerender(card({ ...base, variants: [] }, { addLine, ...APPROVED }));
    expect(screen.getByRole('button', { name: 'Add to order' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows "Photo coming soon" without a photo, and badges a shared photo with the sell unit (AW-029, AW-136)', () => {
    const view = render(card({ ...base, variants: [], picture: null }));
    expect(document.querySelector('.card-block .photo-soon-label').textContent).toBe('Photo coming soon');
    expect(document.querySelector('.card-block .photo-soon-name').textContent).toBe(base.name);
    expect(document.querySelector('.card-initials')).toBeNull();
    const picture = { src: '/x.jpg', srcSet: '', webpSrcSet: '', width: 320, height: 320 };
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: true, sellUnit: '5-pack' }));
    expect(document.querySelector('.pack-badge').textContent).toBe('5-pack');
    // Not shared, or no sell unit: no badge.
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: false, sellUnit: '5-pack' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: true, sellUnit: '' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
  });

  it('doesn’t print the placeholder brand "Assorted" (AW-286)', () => {
    render(card({ ...base, brand: 'Assorted', variants: ['S', 'M'], variantAxis: 'Size' }));
    expect(detail()).toBe('2 sizes · AW-SS');
  });
});
