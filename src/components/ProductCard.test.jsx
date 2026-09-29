// The catalog card's add control (AW-143): one button style, sentence-case
// labels, and the card title as the button's description. Fixtures carry no
// prices.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductCard } from './ProductCard.jsx';

const KITE = { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes' };
const SWISHER = { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] };
const APPROVED = { status: 'approved', pricing_tier: 'standard' };
const PENDING = { status: 'pending', pricing_tier: 'standard' };

const card = (props) => render(
  <ProductCard p={KITE} profile={null} isApprovedBuyer={false} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} {...props} />,
);
const describedBy = (el) => document.getElementById(el.getAttribute('aria-describedby'));

describe('ProductCard add control', () => {
  it('says "Add to quote" to guests and pending accounts, and adds one', () => {
    const addLine = vi.fn();
    card({ addLine });
    const add = screen.getByRole('button', { name: 'Add to quote' });
    expect(add.className).toBe('button ghost sm card-add');
    fireEvent.click(add);
    expect(addLine).toHaveBeenCalledWith(14, null);

    card({ profile: PENDING });
    expect(screen.getAllByRole('button', { name: 'Add to quote' })).toHaveLength(2);
  });

  it('says "Add to order" to approved buyers', () => {
    card({ profile: APPROVED, isApprovedBuyer: true });
    expect(screen.getByRole('button', { name: 'Add to order' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /quote/i })).toBeNull();
  });

  it('asks for a variant with a link to the product, counting what is already in the cart', () => {
    const view = card({ p: SWISHER });
    const choose = screen.getByRole('link', { name: 'Choose variant' });
    expect(choose.getAttribute('href')).toBe('/product/1');
    expect(choose.className).toBe('button ghost sm card-add');

    view.rerender(<ProductCard p={SWISHER} profile={null} isApprovedBuyer={false} cart={{ '1::red': 2, '1::diamond': 1, 14: 5 }} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Choose variant · 3' })).toBeTruthy();
  });

  it('is described by the card title, so the button says which product without changing its name', () => {
    card();
    const add = screen.getByRole('button', { name: 'Add to quote' });
    expect(describedBy(add).tagName).toBe('H3');
    expect(describedBy(add).textContent).toBe('Kite cigarette tobacco');

    card({ p: SWISHER });
    const choose = screen.getByRole('link', { name: 'Choose variant' });
    expect(describedBy(choose).textContent).toBe('Swisher Sweets cigarillos');
    // Each card has its own title id.
    expect(choose.getAttribute('aria-describedby')).not.toBe(add.getAttribute('aria-describedby'));
  });

  it('turns into a stepper once the product is in the cart', () => {
    const addLine = vi.fn();
    const decLine = vi.fn();
    card({ cart: { 14: 4 }, addLine, decLine });
    const group = screen.getByRole('group', { name: 'Kite cigarette tobacco quantity' });
    expect(group.className).toBe('stepper card-stepper');
    expect(group.querySelector('b').textContent).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(addLine).toHaveBeenCalledWith(14, null);
    expect(decLine).toHaveBeenCalledWith('14');
    // The + and − are drawn icons, not text.
    expect(group.querySelectorAll('button svg.icon')).toHaveLength(2);
    expect(group.querySelector('button').textContent).toBe('');
  });

  it('still asks guests to sign in for pricing', () => {
    const onLoginClick = vi.fn();
    card({ onLoginClick });
    fireEvent.click(screen.getByRole('button', { name: /Sign in for pricing/ }));
    expect(onLoginClick).toHaveBeenCalledTimes(1);
  });
});
