// Quick Reorder's quantities (AW-100, AW-013): a row whose quantity can't be
// ordered needs attention in the app, and never blocks the rows that are
// ready. Its rows (AW-109): one to start, Remove only where it means
// something, focus on a new row, prices for an approved buyer and 'Paste a
// list'. Pasted quantities (NEW-011), the text Qty box (NEW-060), what a
// screen reader hears about each row (NEW-012), counts with separators
// (NEW-035) and the guard for a code two products share (AW-074). Fixtures
// carry no prices; the test prices are synthetic.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PASTE_LINES, QuickReorder, SKU_PAUSE_MS, parsePastedList, pastedQty, skuResultText } from './QuickReorder.jsx';

const PRODUCTS = [
  { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', sub: 'Cigarettes', variants: [] },
  { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', sub: 'Cigars', variants: ['Diamond', 'Red'] },
];

const HINT = 'Enter a whole number from 1 to 100,000.';
const skuBoxes = () => screen.getAllByRole('textbox', { name: 'SKU' });
const qtyBoxes = () => screen.getAllByRole('textbox', { name: 'Qty' });
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
  it('leaves validation to the app, with a text Qty box like every other quantity (NEW-060)', () => {
    setup();
    expect(document.querySelector('form.quick-reorder').noValidate).toBe(true);
    const box = qtyBoxes()[0];
    expect(box.type).toBe('text');
    expect(box.inputMode).toBe('numeric');
    expect(box.getAttribute('autocomplete')).toBe('off');
    // 100000 is six digits.
    expect(box.maxLength).toBe(6);
    for (const attr of ['min', 'max', 'step']) expect(box.hasAttribute(attr)).toBe(false);
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
    expect(document.querySelector('.qr-summary').textContent).toBe('Added 1 line (3 units) to your order. 1 line is still waiting above.View order');
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

describe('QuickReorder pasted quantities (NEW-011, NEW-060)', () => {
  it('reads a count with thousands separators as that count, never as 1', () => {
    expect(parsePastedList('AW-KITE, 1,000\nX\t1,200\nAW-SS-RED 12,500').rows).toEqual([
      { sku: 'AW-KITE', qty: '1000' }, { sku: 'X', qty: '1200' }, { sku: 'AW-SS-RED', qty: '12500' },
    ]);
  });

  it('takes the quotes off a CSV line, around the SKU and around the quantity', () => {
    expect(parsePastedList('"AW-OREO",2\n"AW-KITE","1,000"\n"AW-SS-RED"\t"3"\n"AW-OREO",""').rows).toEqual([
      { sku: 'AW-OREO', qty: '2' }, { sku: 'AW-KITE', qty: '1000' }, { sku: 'AW-SS-RED', qty: '3' }, { sku: 'AW-OREO', qty: '1' },
    ]);
  });

  it('keeps any other quantity as written, so the row flags it instead of taking a number from it', () => {
    expect(parsePastedList('SKU, 4 cases\nAW-KITE, 1,00\nAW-KITE, 1000,5\nAW-KITE, 1.000\nbad line here').rows).toEqual([
      { sku: 'SKU', qty: '4 cases' }, { sku: 'AW-KITE', qty: '1,00' }, { sku: 'AW-KITE', qty: '1000,5' },
      { sku: 'AW-KITE', qty: '1.000' }, { sku: 'bad', qty: 'line here' },
    ]);
  });

  it('drops a leading x or × on the quantity', () => {
    expect(parsePastedList('AW-KITE x4\nAW-KITE, X 12\nAW-KITE\t×3\nAW-KITE x1,000\nAW-KITE, x').rows).toEqual([
      { sku: 'AW-KITE', qty: '4' }, { sku: 'AW-KITE', qty: '12' }, { sku: 'AW-KITE', qty: '3' },
      { sku: 'AW-KITE', qty: '1000' }, { sku: 'AW-KITE', qty: 'x' },
    ]);
    expect(pastedQty(undefined)).toBe('1');
    expect(pastedQty('  ')).toBe('1');
  });

  it('keeps a line that doesn’t start with a code whole, as a SKU the catalog won’t know', () => {
    expect(parsePastedList(', 4\n"",2').rows).toEqual([{ sku: ', 4', qty: '1' }, { sku: '"",2', qty: '1' }]);
  });

  it('adds 1,000 units from a pasted line, and shows a quantity it can’t read in the Qty box', () => {
    const addLines = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Paste a list' }));
    fireEvent.change(screen.getByLabelText('SKUs and quantities'), { target: { value: 'AW-KITE, 1,000\nAW-SS-RED, 4 cases' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add rows' }));
    expect(qtyBoxes().map((el) => el.value)).toEqual(['1000', '4 cases']);
    expect(qtyBoxes()[1].getAttribute('aria-invalid')).toBe('true');
    expect(within(rowEls()[1]).getByText(HINT)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 14, variant: null, qty: 1000 }]);
  });
});

describe('QuickReorder summary counts (NEW-035)', () => {
  it('writes counts of four digits and more with separators', () => {
    const addLines = setup();
    fillRow(0, 'AW-KITE', '2500');
    fillRow(1, 'AW-SS-RED', '100000');
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 lines to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 14, variant: null, qty: 2500 }, { productId: 1, variant: 'Red', qty: 100000 }]);
    expect(document.querySelector('.qr-summary p').textContent).toBe('Added 2 lines (102,500 units) to your order.');
  });

  it('keeps 1 unit and 1 line singular', () => {
    setup();
    fillRow(0, 'AW-KITE', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(document.querySelector('.qr-summary p').textContent).toBe('Added 1 line (1 unit) to your order.');
  });
});

describe('QuickReorder for screen readers (NEW-012)', () => {
  const announcer = () => document.getElementById('aw-announcer');
  // announce() writes 120 ms after it is called.
  const wait = (ms) => act(() => { vi.advanceTimersByTime(ms); });
  const heard = () => {
    wait(200);
    const text = announcer()?.textContent ?? '';
    if (announcer()) announcer().textContent = '';
    return text;
  };
  const statusOf = (i) => rowEls()[i].querySelector('.qr-status');
  const typeSku = (i, value) => fireEvent.change(skuBoxes()[i], { target: { value } });

  beforeEach(() => {
    vi.useFakeTimers();
    if (announcer()) announcer().textContent = '';
  });
  afterEach(() => { vi.useRealTimers(); });

  it('describes the SKU box by its row’s status, and marks a code the catalog doesn’t have', () => {
    setup();
    const box = skuBoxes()[0];
    expect(box.hasAttribute('aria-describedby')).toBe(false);
    expect(box.hasAttribute('aria-invalid')).toBe(false);
    typeSku(0, 'NOPE-1');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe(statusOf(0).id);
    expect(statusOf(0).textContent).toBe('Not in the catalog. Check the code or search the catalog above.');
    // The status cell itself stays quiet: no live region on every keystroke.
    expect(statusOf(0).hasAttribute('aria-live')).toBe(false);
    expect(statusOf(0).hasAttribute('role')).toBe(false);
    typeSku(0, 'AW-KITE');
    expect(box.hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById(box.getAttribute('aria-describedby')).textContent).toContain('Kite cigarette tobacco');
    // The quantity box keeps its own hint.
    fireEvent.change(qtyBoxes()[0], { target: { value: '0' } });
    expect(qtyBoxes()[0].getAttribute('aria-describedby')).toBe(screen.getByText(HINT).id);
    expect(box.getAttribute('aria-describedby')).toBe(statusOf(0).id);
  });

  it('announces a row’s result once, after typing pauses, and again only when it changes', () => {
    setup();
    typeSku(0, 'N');
    wait(SKU_PAUSE_MS - 100);
    typeSku(0, 'NOPE-1');
    wait(SKU_PAUSE_MS - 100);
    expect(announcer()?.textContent ?? '').toBe('');
    wait(100);
    expect(heard()).toBe('Not in the catalog.');
    // Still not in the catalog: nothing new to say, on a pause or on leaving.
    typeSku(0, 'NOPE-12');
    wait(SKU_PAUSE_MS);
    fireEvent.blur(skuBoxes()[0]);
    expect(heard()).toBe('');
    typeSku(0, 'AW-KITE');
    wait(SKU_PAUSE_MS);
    expect(heard()).toBe('Kite cigarette tobacco matched.');
    fireEvent.blur(skuBoxes()[0]);
    wait(SKU_PAUSE_MS);
    expect(heard()).toBe('');
  });

  it('announces at once when the SKU box loses focus before the pause', () => {
    setup();
    typeSku(0, 'aw-ss-red');
    fireEvent.blur(skuBoxes()[0]);
    expect(heard()).toBe('Swisher Sweets cigarillos — Red matched.');
    wait(SKU_PAUSE_MS);
    expect(heard()).toBe('');
  });

  it('asks for a variant, announces the one chosen and moves focus to Qty', () => {
    setup();
    typeSku(0, 'AW-SS');
    wait(SKU_PAUSE_MS);
    expect(heard()).toBe('Choose a variant of Swisher Sweets cigarillos.');
    fireEvent.change(within(statusOf(0)).getByRole('combobox'), { target: { value: 'Red' } });
    expect(heard()).toBe('Swisher Sweets cigarillos — Red matched.');
    expect(document.activeElement).toBe(qtyBoxes()[0]);
  });

  it('keeps the count of lines that need attention in a polite status that is always there', () => {
    setup();
    const note = document.querySelector('.qr-note');
    expect(note.getAttribute('role')).toBe('status');
    expect(note.textContent).toBe('');
    typeSku(0, 'NOPE-1');
    expect(note.textContent).toBe('1 line needs attention before it can be added.');
    fillRow(1, 'AW-SS', '2');
    expect(document.querySelector('.qr-note')).toBe(note);
    expect(note.textContent).toBe('2 lines need attention before they can be added.');
    typeSku(0, '');
    fireEvent.change(within(statusOf(1)).getByRole('combobox'), { target: { value: 'Diamond' } });
    expect(note.textContent).toBe('');
  });
});

describe('QuickReorder: a code two products share (AW-074)', () => {
  // As on a live database that still has a duplicate SKU, before
  // products_sku_upper_key can be created.
  const SHARED = [...PRODUCTS, { id: 77, sku: 'AW-KITE', name: 'Kite pipe tobacco', brand: 'Kite', sub: 'Pipe tobacco', variants: [] }];

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('asks which product, then adds the one chosen', () => {
    const addLines = setup({ products: SHARED });
    fireEvent.change(skuBoxes()[0], { target: { value: 'AW-KITE' } });
    fireEvent.change(qtyBoxes()[0], { target: { value: '5' } });
    const list = screen.getByRole('combobox', { name: /Several products share this code/ });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a product…', 'Kite cigarette tobacco · Cigarettes', 'Kite pipe tobacco · Pipe tobacco']);
    expect(screen.getByRole('button', { name: 'Add to order' }).disabled).toBe(true);
    fireEvent.change(list, { target: { value: '77' } });
    act(() => { vi.advanceTimersByTime(200); });
    expect(document.getElementById('aw-announcer').textContent).toBe('Kite pipe tobacco matched.');
    expect(document.activeElement).toBe(qtyBoxes()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 line to order' }));
    expect(addLines).toHaveBeenCalledWith([{ productId: 77, variant: null, qty: 5 }]);
  });

  it('words each result for the live region', () => {
    const product = PRODUCTS[1];
    expect(skuResultText({ status: 'empty' })).toBeNull();
    expect(skuResultText({ status: 'ok', product, variant: 'Red' })).toBe('Swisher Sweets cigarillos — Red matched.');
    expect(skuResultText({ status: 'not-found' })).toBe('Not in the catalog.');
    expect(skuResultText({ status: 'choose-variant', product })).toBe('Choose a variant of Swisher Sweets cigarillos.');
    expect(skuResultText({ status: 'choose-product' })).toBe('Choose a product: more than one has this code.');
  });
});
