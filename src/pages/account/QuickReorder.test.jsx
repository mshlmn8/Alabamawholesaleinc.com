// Quick Reorder's quantities (AW-100, AW-013): a row whose quantity can't be
// ordered needs attention in the app, and never blocks the rows that are
// ready. Fixtures carry no prices.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickReorder } from './QuickReorder.jsx';

const PRODUCTS = [
  { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', sub: 'Cigarettes', variants: [] },
  { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', sub: 'Cigars', variants: ['Diamond', 'Red'] },
];

const HINT = 'Enter a whole number from 1 to 100,000.';
const skuBoxes = () => screen.getAllByRole('textbox');
const qtyBoxes = () => screen.getAllByRole('spinbutton');
function fillRow(i, sku, qty) {
  fireEvent.change(skuBoxes()[i], { target: { value: sku } });
  fireEvent.change(qtyBoxes()[i], { target: { value: qty } });
}
const setup = () => {
  const addLines = vi.fn();
  render(<QuickReorder products={PRODUCTS} addLines={addLines} onOpenCart={vi.fn()} isApprovedBuyer />);
  return addLines;
};

describe('QuickReorder quantities (AW-100)', () => {
  it('leaves validation to the app, with the database’s limit on the quantity box', () => {
    setup();
    expect(document.querySelector('form.quick-reorder').noValidate).toBe(true);
    expect(qtyBoxes()[0].getAttribute('max')).toBe('100000');
    expect(qtyBoxes()[0].getAttribute('min')).toBe('1');
  });

  it('adds the ready row when another row has quantity 0, and says what the other needs', () => {
    const addLines = setup();
    fillRow(0, 'AW-KITE', '3');
    fillRow(1, 'AW-SS-RED', '0');
    const hint = screen.getByText(HINT);
    expect(hint.className).toBe('qr-problem');
    expect(qtyBoxes()[1].getAttribute('aria-invalid')).toBe('true');
    expect(qtyBoxes()[1].getAttribute('aria-describedby')).toBe(hint.id);
    expect(qtyBoxes()[0].hasAttribute('aria-invalid')).toBe(false);
    expect(screen.getByText('1 line needs attention before it can be added.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 14, variant: null, qty: 3 }]);
    expect(screen.getByRole('status').textContent).toBe('Added 1 line (3 units) to your order. 1 line is still waiting above.Review cart');
  });

  it('never rounds 2.5 down: the row needs attention', () => {
    setup();
    fillRow(0, 'AW-KITE', '2.5');
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to order' }).disabled).toBe(true);
  });

  it('doesn’t take 150,000, which the database would refuse', () => {
    const addLines = setup();
    fillRow(0, 'AW-KITE', '150000');
    fillRow(1, 'AW-SS-RED', '100000');
    expect(screen.getAllByText(HINT)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 1, variant: 'Red', qty: 100000 }]);
  });

  it('shows no quantity hint for an empty row or a code it can’t match', () => {
    setup();
    fireEvent.change(qtyBoxes()[0], { target: { value: '0' } });
    fillRow(1, 'AW-NOPE', '0');
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
