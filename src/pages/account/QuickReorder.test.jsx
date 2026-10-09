// Quick Reorder's quantities (AW-100, AW-013): a row whose quantity can't be
// ordered needs attention in the app, and never blocks the rows that are
// ready. Its rows (AW-109): one to start, Remove only where it means
// something, focus on a new row, prices for an approved buyer and 'Paste a
// list'. Fixtures carry no prices; the test prices are synthetic.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PASTE_LINES, QuickReorder, parsePastedList } from './QuickReorder.jsx';

const PRODUCTS = [
  { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', sub: 'Cigarettes', variants: [] },
  { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', sub: 'Cigars', variants: ['Diamond', 'Red'] },
];

const HINT = 'Enter a whole number from 1 to 100,000.';
const skuBoxes = () => [...document.querySelectorAll('.qr-field:not(.qr-qty) input')];
const qtyBoxes = () => screen.getAllByRole('spinbutton');
const rowEls = () => [...document.querySelectorAll('.qr-row')];
const addLine = () => fireEvent.click(screen.getByRole('button', { name: 'Add another line' }));
function fillRow(i, sku, qty) {
  while (skuBoxes().length <= i) addLine();
  fireEvent.change(skuBoxes()[i], { target: { value: sku } });
  fireEvent.change(qtyBoxes()[i], { target: { value: qty } });
}
const setup = (props = {}) => {
  const addLines = vi.fn();
  render(<QuickReorder products={PRODUCTS} addLines={addLines} onOpenCart={vi.fn()} isApprovedBuyer {...props} />);
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

describe('QuickReorder rows (AW-109)', () => {
  it('starts with one empty row: no status cell and no Remove', () => {
    setup();
    expect(rowEls()).toHaveLength(1);
    expect(rowEls()[0].className).toBe('qr-row is-empty');
    expect(screen.queryByRole('button', { name: /Remove line/ })).toBeNull();
    fireEvent.change(skuBoxes()[0], { target: { value: 'AW-KITE' } });
    expect(rowEls()[0].className).toBe('qr-row');
    // Remove on the only row empties it, and focus stays in it.
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(rowEls()).toHaveLength(1);
    expect(skuBoxes()[0].value).toBe('');
    expect(document.activeElement).toBe(skuBoxes()[0]);
    expect(screen.queryByRole('button', { name: /Remove line/ })).toBeNull();
  });

  it('puts focus in the new row, and offers Remove on every row once there are two', () => {
    setup();
    addLine();
    expect(rowEls()).toHaveLength(2);
    expect(document.activeElement).toBe(skuBoxes()[1]);
    expect(screen.getAllByRole('button', { name: /Remove line/ })).toHaveLength(2);
    addLine();
    expect(document.activeElement).toBe(skuBoxes()[2]);
    // Removing the last row moves focus to the one before it; removing the
    // first, to the row that took its place.
    fireEvent.change(skuBoxes()[0], { target: { value: 'AW-KITE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 3' }));
    expect(document.activeElement).toBe(skuBoxes()[1]);
    const second = skuBoxes()[1];
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(skuBoxes()).toEqual([second]);
    expect(document.activeElement).toBe(second);
  });

  it('puts focus back in the first row after an add', () => {
    const addLines = setup();
    fillRow(0, 'AW-KITE', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 14, variant: null, qty: 2 }]);
    expect(rowEls()).toHaveLength(1);
    expect(document.activeElement).toBe(skuBoxes()[0]);
  });
});

describe('QuickReorder prices (AW-109)', () => {
  const priceOf = (id, variant) => (id === 14 ? 10.25 : (id === 1 && variant === 'Red' ? null : 3));
  const priceLine = (i) => rowEls()[i].querySelector('.qr-price')?.textContent ?? null;

  it('shows an approved buyer the unit price and the line total of a matched row', () => {
    setup({ priceOf, pricesStatus: 'ready' });
    fillRow(0, 'AW-KITE', '4');
    expect(priceLine(0)).toBe('$10.25 each · $41.00');
    fireEvent.change(qtyBoxes()[0], { target: { value: '0' } });
    expect(priceLine(0)).toBe('$10.25 each');
    // No price for this line: said, never $0.00.
    fillRow(1, 'AW-SS-RED', '2');
    expect(priceLine(1)).toBe('Price on request');
  });

  it('says prices are loading, and shows none to an account that isn’t approved', () => {
    const view = render(<QuickReorder products={PRODUCTS} addLines={vi.fn()} onOpenCart={vi.fn()} isApprovedBuyer priceOf={() => null} pricesStatus="loading" />);
    fillRow(0, 'AW-KITE', '1');
    expect(priceLine(0)).toBe('Loading price…');
    view.unmount();
    render(<QuickReorder products={PRODUCTS} addLines={vi.fn()} onOpenCart={vi.fn()} isApprovedBuyer={false} priceOf={priceOf} pricesStatus="off" />);
    fillRow(0, 'AW-KITE', '1');
    expect(priceLine(0)).toBeNull();
  });
});

describe('QuickReorder Paste a list (AW-109)', () => {
  it('reads SKU, qty / SKU<tab>qty / SKU qty lines, with 1 when there is no quantity', () => {
    expect(parsePastedList('AW-KITE, 4\r\nAW-SS-RED\t10\n\n  aw-ss-diamond 2  \nAW-KITE\nAW-KITE,\nAW-KITE, 2.5')).toEqual({
      rows: [
        { sku: 'AW-KITE', qty: '4' }, { sku: 'AW-SS-RED', qty: '10' }, { sku: 'aw-ss-diamond', qty: '2' },
        { sku: 'AW-KITE', qty: '1' }, { sku: 'AW-KITE', qty: '1' }, { sku: 'AW-KITE', qty: '2.5' },
      ],
      skipped: 0,
    });
    const many = Array.from({ length: 105 }, (_, i) => `AW-KITE, ${i + 1}`).join('\n');
    const { rows, skipped } = parsePastedList(many);
    expect(MAX_PASTE_LINES).toBe(100);
    expect(rows).toHaveLength(100);
    expect(skipped).toBe(5);
    expect(parsePastedList('  \n ')).toEqual({ rows: [], skipped: 0 });
  });

  it('opens from a disclosure button and turns the lines into rows in place of the empty ones', async () => {
    const addLines = setup();
    fillRow(0, 'AW-KITE', '3');
    addLine();
    const toggle = screen.getByRole('button', { name: 'Paste a list' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.hasAttribute('aria-controls')).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(panel.className).toBe('form-grid qr-paste');
    const box = within(panel).getByLabelText('SKUs and quantities');
    expect(box.getAttribute('aria-describedby')).toBe(within(panel).getByText(/^One line each/).id);
    fireEvent.change(box, { target: { value: 'AW-SS-RED, 2\nAW-SS-DIAMOND\t0' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add rows' }));
    // The typed row stays; the empty row after it is replaced.
    expect(skuBoxes().map((el) => el.value)).toEqual(['AW-KITE', 'AW-SS-RED', 'AW-SS-DIAMOND']);
    expect(qtyBoxes().map((el) => el.value)).toEqual(['3', '2', '0']);
    expect(box.value).toBe('');
    await waitFor(() => expect(document.getElementById('aw-announcer').textContent).toBe('Added 2 rows.'));
    // The 0 still goes through the quantity rule.
    expect(screen.getByText('1 line needs attention before it can be added.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 lines to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 14, variant: null, qty: 3 }, { productId: 1, variant: 'Red', qty: 2 }]);
  });

  it('says what to paste when the box is empty', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paste a list' }));
    const box = screen.getByLabelText('SKUs and quantities');
    fireEvent.click(screen.getByRole('button', { name: 'Add rows' }));
    const error = screen.getByText('Paste at least one line: a SKU, then its quantity.');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby').split(' ')).toContain(error.id);
    expect(rowEls()).toHaveLength(1);
  });
});
