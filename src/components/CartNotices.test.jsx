// Cart notices (AW-354, AW-083, NEW-021).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedLinesNotice, UnavailableNotice, unavailableAdvice } from './CartNotices.jsx';

describe('SavedLinesNotice (AW-354)', () => {
  it('lists each product with its saved quantity and a link to choose a variant', () => {
    const onDismiss = vi.fn();
    const onChoose = vi.fn();
    render(<SavedLinesNotice items={[{ productId: 1, qty: 3, name: 'Swisher Sweets cigarillos' }, { productId: 162, qty: 2, name: 'Snickers bars' }]}
                             onDismiss={onDismiss} onChoose={onChoose} />);
    const region = screen.getByRole('region', { name: 'Our catalog was updated. Choose a variant for 2 products from your last visit.' });
    expect(region).toBeTruthy();
    expect(screen.getByText('Quantity 3')).toBeTruthy();
    const choose = screen.getByRole('link', { name: 'Choose a variant for Swisher Sweets cigarillos' });
    expect(choose.getAttribute('href')).toBe('/product/1');
    fireEvent.click(choose);
    expect(onChoose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this list' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<SavedLinesNotice items={[]} onDismiss={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('UnavailableNotice (AW-083)', () => {
  it('says how many lines can no longer be ordered and removes them all', () => {
    const onRemoveAll = vi.fn();
    render(<UnavailableNotice items={[{ lineKey: '999' }, { lineKey: '1::purple' }]} onRemoveAll={onRemoveAll} />);
    expect(screen.getByText('2 items in your quote are no longer available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable items' }));
    expect(onRemoveAll).toHaveBeenCalledWith(['999', '1::purple']);
  });

  const notice = () => document.querySelector('[data-notice="unavailable"]');
  const lines = () => [...notice().querySelectorAll('p, button')].map((el) => el.textContent);

  it('speaks of one item as one: "Remove it" and "Remove unavailable item" (NEW-021)', () => {
    const onRemoveAll = vi.fn();
    render(<UnavailableNotice items={[{ lineKey: '45', unavailable: 'product' }]} onRemoveAll={onRemoveAll} noun="order" />);
    expect(lines()).toEqual(['1 item in your order is no longer available.', 'Remove it to continue.', 'Remove unavailable item']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable item' }));
    expect(onRemoveAll).toHaveBeenCalledWith(['45']);
  });

  it('speaks of two as them', () => {
    render(<UnavailableNotice items={[{ lineKey: '45', unavailable: 'product' }, { lineKey: '999', unavailable: 'product' }]} onRemoveAll={vi.fn()} />);
    expect(lines()).toEqual(['2 items in your quote are no longer available.', 'Remove them to continue.', 'Remove unavailable items']);
  });

  it('offers another variant only when a line’s product is still offered (unavailable "variant", not "product")', () => {
    // The old merged #62 label: the product is still offered with other variants.
    const view = render(<UnavailableNotice items={[{ lineKey: '62::watermelon-ice-kiwi-dragon-berry', unavailable: 'variant' }]} onRemoveAll={vi.fn()} noun="order" />);
    expect(lines()).toEqual([
      '1 item in your order is no longer available.',
      'Remove it to continue, or choose another variant where the product is still offered.',
      'Remove unavailable item',
    ]);
    view.rerender(<UnavailableNotice items={[{ lineKey: '45', unavailable: 'product' }, { lineKey: '1::purple', unavailable: 'variant' }]} onRemoveAll={vi.fn()} />);
    expect(lines()[1]).toBe('Remove them to continue, or choose another variant where the product is still offered.');
    expect(unavailableAdvice([{ unavailable: 'product' }, { unavailable: 'product' }])).toBe('Remove them to continue.');
  });
});
