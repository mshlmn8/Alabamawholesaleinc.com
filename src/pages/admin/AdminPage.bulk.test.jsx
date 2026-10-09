// Admin -> Products' bulk changes with the fake client (AW-114): selecting
// rows and all filtered rows, the selection across pages and filters, Set
// tag / Activate / Deactivate / Set price as one checked update, Adjust with
// its preview and the RPC, Export, Import, and the live database without
// the October 2026 functions.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetAdminProductColumnsForTests } = await import('./ProductsSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');
const { parseCsv } = await import('./csv.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
// 120 products: 1-40 Swisher (TOBACCO), the rest Gum (CANDIES). Made-up test prices.
const ROWS = Array.from({ length: 120 }, (_, i) => {
  const id = i + 1;
  const swisher = id <= 40;
  return {
    id, name: swisher ? `Swisher ${id}` : `Gum ${id}`, brand: swisher ? 'Swisher' : 'Wrigley', cat: swisher ? 'TOBACCO' : 'CANDIES',
    sub: swisher ? 'Cigars & Cigarillos' : 'Gum', sku: `AW-B${id}`, variants: id === 1 ? ['Red', 'Blue'] : [], variant_axis: id === 1 ? 'Color' : null,
    unavailable_variants: [], description: '', sell_unit: 'box', img: `p${id}.jpg`, tag: null, active: id !== 3,
    stock_status: 'in_stock', featured_rank: null, updated_at: '2026-09-01T12:00:00Z',
  };
});
const PRICES = Object.fromEntries(ROWS.map((r) => [r.id, { list: r.id === 2 ? null : 10.1, variants: r.id === 1 ? { Red: { list: 20 } } : {} }]));
const url = () => window.location.pathname + window.location.search;

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

let onCatalogChange;
// Product updates answer with the ids they were sent (or `updateIds`).
let updateIds = null;
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin/products', { replace: true }));
  resetAdminProductColumnsForTests();
  fake.reset();
  fake.tables = { products: ROWS, profiles: [ADMIN], orders: [] };
  fake.rpcData.admin_product_prices = PRICES;
  updateIds = null;
  fake.respond = (request) => {
    if (request.table === 'products' && request.op === 'update') {
      const ids = updateIds || request.filters.find(([name, column]) => name === 'in' && column === 'id')?.[2] || [];
      return { data: ids.map((id) => ({ id, updated_at: '2026-10-08T12:00:00Z' })), error: null };
    }
    return undefined;
  };
  onCatalogChange = vi.fn();
});
// A confirmation's history entry is taken back (history.back()) a moment
// after it closes: let that land before the next test moves the URL.
afterEach(async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.restoreAllMocks();
});

const renderAdmin = async (path = '/admin/products') => {
  act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" onCatalogChange={onCatalogChange} />); });
};
const bodyRows = () => screen.getAllByRole('row').filter((r) => r.closest('table.admin-products') && r.parentElement.tagName === 'TBODY');
const rowOf = (id) => bodyRows().find((r) => r.cells[1].textContent === String(id));
const tick = (name) => act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: `Select ${name}` })); });
const bar = () => screen.getByRole('region', { name: 'Change the selected products' });
const statusText = () => document.querySelector('.admin-status-text').textContent;
const confirmDialog = () => screen.getByRole('alertdialog');
const confirmButton = async () => {
  const dialog = confirmDialog();
  const buttons = within(dialog).getAllByRole('button');
  await act(async () => { fireEvent.click(buttons[0]); });
};
const updates = () => fake.find({ table: 'products', op: 'update' });

describe('selecting products (AW-114)', () => {
  it('selects rows by id across pages, all filtered rows at once, and clears with a note when the filters change', async () => {
    await renderAdmin();
    expect(screen.queryByRole('region', { name: 'Change the selected products' })).toBeNull();
    await tick('Swisher 1');
    expect(within(bar()).getByText('1 product selected')).toBeTruthy();
    // Paging keeps the selection.
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next page' })); });
    expect(url()).toBe('/admin/products?page=2');
    await tick('Gum 51');
    expect(within(bar()).getByText('2 products selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export 2 selected' })).toBeTruthy();
    // A filter change clears it, and says so.
    await act(async () => { fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'tobacco' } }); });
    expect(screen.queryByRole('region', { name: 'Change the selected products' })).toBeNull();
    expect(screen.getByText('The selection was cleared because the filters changed.')).toBeTruthy();
    // Select all 40 filtered, though the page shows them all here.
    const all = screen.getByRole('checkbox', { name: 'Select all 40 filtered' });
    await act(async () => { fireEvent.click(all); });
    expect(within(bar()).getByText('40 products selected')).toBeTruthy();
    expect(screen.queryByText('The selection was cleared because the filters changed.')).toBeNull();
    await tick('Swisher 5');
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Clear selection' })); });
    expect(screen.queryByRole('region', { name: 'Change the selected products' })).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('.admin-count'));
  });

  it('gives each checkbox a 44px label target', async () => {
    await renderAdmin();
    const box = screen.getByRole('checkbox', { name: 'Select Swisher 1' });
    expect(box.closest('label').className).toBe('row-select');
  });
});

describe('bulk updates (AW-114)', () => {
  it('sets the tag of the selection in one checked update, after a confirmation with the count, and patches the rows', async () => {
    await renderAdmin('/admin/products?q=swisher');
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 40 filtered' })); });
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Set tag' })); });
    expect(within(bar()).getByRole('button', { name: 'Set tag', expanded: true })).toBeTruthy();
    await act(async () => { fireEvent.change(within(bar()).getByLabelText('New tag'), { target: { value: 'DEAL' } }); });
    await act(async () => { fireEvent.submit(within(bar()).getByLabelText('New tag').closest('form')); });
    expect(within(confirmDialog()).getByRole('heading').textContent).toBe('Set the tag of 40 products?');
    expect(updates()).toHaveLength(0);
    await confirmButton();
    expect(updates()).toHaveLength(1);
    const [request] = updates();
    expect(request.patch).toEqual({ tag: 'DEAL' });
    expect(request.filters).toEqual([['in', 'id', ROWS.slice(0, 40).map((r) => r.id)]]);
    expect(request.returning).toBe('id,updated_at');
    expect(statusText()).toBe('Updated 40 products');
    expect(onCatalogChange).toHaveBeenCalledTimes(1);
    // No reload: the rows are patched where they are.
    expect(fake.find({ table: 'products', op: 'select' })).toHaveLength(1);
    expect(rowOf(1).cells[9].textContent).toBe('DEAL');
    expect(screen.queryByRole('region', { name: 'Change the selected products' })).toBeNull();
  });

  it('deactivates and activates, and says when fewer rows came back than were sent', async () => {
    await renderAdmin();
    await tick('Swisher 1');
    await tick('Swisher 4');
    updateIds = [1];
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Deactivate' })); });
    expect(within(confirmDialog()).getByRole('heading').textContent).toBe('Deactivate 2 products?');
    await confirmButton();
    expect(updates()[0].patch).toEqual({ active: false });
    expect(statusText()).toBe('Updated 1 of 2 products; the others weren’t changed (reload the list to see them)');
    expect(rowOf(1).className).toBe('inactive');
    expect(rowOf(4).className).toBe('');
    updateIds = null;
    await tick('Swisher 1');
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Activate' })); });
    await confirmButton();
    expect(updates()[1].patch).toEqual({ active: true });
    expect(rowOf(1).className).toBe('');
  });

  it('shows a refused update next to the bar and changes nothing', async () => {
    await renderAdmin();
    await tick('Swisher 1');
    fake.respond = () => ({ data: [], error: null });
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Activate' })); });
    await confirmButton();
    expect(within(bar()).getByRole('alert').textContent).toMatch(/^The products weren’t changed: no product was changed/);
    expect(onCatalogChange).not.toHaveBeenCalled();
  });

  it('sets a price, blank meaning price on request, and checks the box', async () => {
    await renderAdmin();
    await tick('Swisher 1');
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Set price' })); });
    const box = within(bar()).getByLabelText('New list price');
    await act(async () => { fireEvent.change(box, { target: { value: '12.345' } }); });
    await act(async () => { fireEvent.submit(box.closest('form')); });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await act(async () => { fireEvent.change(box, { target: { value: '' } }); });
    await act(async () => { fireEvent.submit(box.closest('form')); });
    expect(within(confirmDialog()).getByText(/gets the list price price on request/)).toBeTruthy();
    await confirmButton();
    expect(updates()[0].patch).toEqual({ price: null });
    expect(rowOf(1).cells[8].textContent).toBe('On request');
  });
});

describe('focus after a confirmed change (NEW-004, AW-114)', () => {
  // Inside <main>, so the page-heading fallback is there to take focus, as
  // on the site: before the fix the count line's focus came too early and
  // the closing dialog then sent focus to the h1.
  const renderInMain = async (path = '/admin/products') => {
    act(() => navigate(path, { replace: true }));
    await act(async () => { render(<main><RoutedAdmin profile={ADMIN} account="ready" onCatalogChange={onCatalogChange} /></main>); });
  };
  const count = () => document.querySelector('.admin-count');
  // jsdom doesn't focus a clicked button: focus it first, as a browser does.
  const press = async (button) => {
    button.focus();
    await act(async () => { fireEvent.click(button); });
  };
  const settleDialog = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

  it('hands focus to the count line after a bulk tag change, as the bar that opened the confirmation is gone', async () => {
    await renderInMain();
    await tick('Swisher 1');
    await tick('Swisher 4');
    await press(within(bar()).getByRole('button', { name: 'Set tag' }));
    await act(async () => { fireEvent.change(within(bar()).getByLabelText('New tag'), { target: { value: 'NEW' } }); });
    await press(within(bar()).getAllByRole('button', { name: 'Set tag' }).find((b) => b.type === 'submit'));
    expect(within(confirmDialog()).getByRole('heading').textContent).toBe('Set the tag of 2 products?');
    await press(within(confirmDialog()).getByRole('button', { name: 'Tag 2 products' }));
    await settleDialog();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Change the selected products' })).toBeNull();
    expect(document.activeElement).toBe(count());
  });

  it('gives focus back to the button that opened the confirmation when it is cancelled or refused', async () => {
    await renderInMain();
    await tick('Swisher 1');
    const activate = within(bar()).getByRole('button', { name: 'Activate' });
    await press(activate);
    await press(within(confirmDialog()).getByRole('button', { name: 'Cancel' }));
    await settleDialog();
    expect(document.activeElement).toBe(activate);
    fake.respond = () => ({ data: [], error: null });
    await press(activate);
    await press(within(confirmDialog()).getByRole('button', { name: 'Activate 1 product' }));
    await settleDialog();
    expect(within(bar()).getByRole('alert')).toBeTruthy();
    expect(document.activeElement).toBe(activate);
  });

  it('hands focus to the count line after an import’s Update n products, and to Import CSV after Cancel', async () => {
    fake.rpcData.admin_import_products = 1;
    await renderInMain();
    const input = document.querySelector('input[type=file]');
    const choose = async (text) => {
      await act(async () => { fireEvent.change(input, { target: { files: [new File([text], 'products-edit.csv', { type: 'text/csv' })] } }); });
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Import products-edit.csv' })).toBeTruthy());
    };
    await choose('sku,tag\nAW-B1,NEW\n');
    const preview = screen.getByRole('region', { name: /^Import / });
    await press(within(preview).getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Import CSV' }));
    await choose('sku,tag\nAW-B1,NEW\n');
    await press(within(screen.getByRole('region', { name: /^Import / })).getByRole('button', { name: 'Import 1 change' }));
    await press(within(confirmDialog()).getByRole('button', { name: 'Update 1 product' }));
    await settleDialog();
    expect(screen.queryByRole('region', { name: /^Import / })).toBeNull();
    expect(document.activeElement).toBe(count());
  });
});

describe('adjusting prices (AW-114)', () => {
  const openAdjust = async (value, mode = 'pct') => {
    await act(async () => { fireEvent.click(within(bar()).getByRole('button', { name: 'Adjust price' })); });
    await act(async () => { fireEvent.change(within(bar()).getByLabelText('Adjust by'), { target: { value: mode } }); });
    await act(async () => { fireEvent.change(within(bar()).getByLabelText(mode === 'pct' ? 'Change in %' : 'Change in $'), { target: { value } }); });
  };

  it('previews old and new prices (20 rows, then a count), skips products on request, and calls the RPC once', async () => {
    fake.rpcData.admin_bulk_adjust_prices = { updated: 39, skipped: 1, variants: 1 };
    await renderAdmin('/admin/products?q=swisher');
    await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Select all 40 filtered' })); });
    await openAdjust('5');
    const preview = within(bar()).getByRole('table', { name: 'New list prices' });
    const lines = within(preview).getAllByRole('row').slice(1);
    expect(lines).toHaveLength(20);
    expect([...lines[0].cells].map((c) => c.textContent)).toEqual(['Swisher 1', 'AW-B1', '$10.10', '$10.61']);
    expect(within(bar()).getByText('And 19 more products.')).toBeTruthy();
    expect(within(bar()).getByText('Also 1 variant price, by the same change.')).toBeTruthy();
    expect(within(bar()).getByText('Skipped, price on request: Swisher 2.')).toBeTruthy();
    await act(async () => { fireEvent.submit(within(bar()).getByLabelText('Change in %').closest('form')); });
    expect(within(confirmDialog()).getByRole('heading').textContent).toBe('Adjust 39 prices?');
    expect(within(confirmDialog()).getByText(/^Raise the list price of 39 products and 1 variant price by 5%\. 1 product on request is skipped\./)).toBeTruthy();
    await confirmButton();
    const calls = fake.find({ kind: 'rpc', name: 'admin_bulk_adjust_prices' });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ p_ids: ROWS.slice(0, 40).map((r) => r.id), p_pct: 5, p_amount: 0, p_variants: true });
    expect(statusText()).toBe('Updated 39 products; 1 on request skipped');
    expect(rowOf(1).cells[8].textContent).toBe('$10.61');
    expect(rowOf(2).cells[8].textContent).toBe('On request');
    expect(updates()).toHaveLength(0);
  });

  it('refuses a change that takes a price below 0, before asking', async () => {
    await renderAdmin();
    await tick('Swisher 1');
    await openAdjust('-15', 'amount');
    expect(within(bar()).getByText(/^Out of range \(below \$0\.00 or above \$99,999\.99\): Swisher 1 -\$4\.90/)).toBeTruthy();
    await act(async () => { fireEvent.submit(within(bar()).getByLabelText('Change in $').closest('form')); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(fake.find({ kind: 'rpc', name: 'admin_bulk_adjust_prices' })).toHaveLength(0);
  });

  it('turns itself off on a database without admin_bulk_adjust_prices; Set price still works', async () => {
    fake.respond = (request) => (request.kind === 'rpc' && request.name === 'admin_bulk_adjust_prices'
      ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } : undefined);
    await renderAdmin();
    await tick('Swisher 1');
    await openAdjust('5');
    await act(async () => { fireEvent.submit(within(bar()).getByLabelText('Change in %').closest('form')); });
    await confirmButton();
    expect(within(bar()).getByRole('alert').textContent).toBe('Adjust price needs the October 2026 database update (see BACKEND.md). Set price works now.');
    const adjust = within(bar()).getByRole('button', { name: 'Adjust price' });
    expect(adjust.disabled).toBe(true);
    expect(within(bar()).getByRole('button', { name: 'Set price' }).disabled).toBe(false);
    expect(rowOf(1).cells[8].textContent).toBe('$10.10');
  });
});

describe('export and import (AW-114)', () => {
  let blobs;
  let downloads;
  beforeEach(() => {
    blobs = [];
    downloads = [];
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return `blob:aw/${blobs.length}`; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() { downloads.push(this.download); });
  });

  it('exports the filtered rows, or the selection, as CSV, without fetching anything', async () => {
    await renderAdmin('/admin/products?dept=tobacco&sort=id&dir=desc');
    const before = fake.calls.length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Export CSV' })); });
    expect(fake.calls.length).toBe(before);
    expect(downloads).toEqual([expect.stringMatching(/^products-\d{4}-\d{2}-\d{2}\.csv$/)]);
    const records = parseCsv(await blobs[0].text());
    expect(records[0]).toEqual(['id', 'sku', 'name', 'brand', 'cat', 'sub', 'sell_unit', 'price', 'tag', 'active', 'stock_status', 'featured_rank']);
    expect(records).toHaveLength(41);
    expect(records[1].slice(0, 3)).toEqual(['40', 'AW-B40', 'Swisher 40']);
    expect(statusText()).toMatch(/^Exported 40 products to products-/);
    await tick('Swisher 7');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Export 1 selected' })); });
    expect(parseCsv(await blobs[1].text()).slice(1).map((r) => r[0])).toEqual(['7']);
  });

  const chooseFile = async (text, name = 'products-edit.csv') => {
    const input = document.querySelector('input[type=file]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File([text], name, { type: 'text/csv' })] } }); });
    await waitFor(() => expect(screen.getByRole('heading', { name: `Import ${name}` })).toBeTruthy());
  };
  const preview = () => screen.getByRole('region', { name: /^Import / });

  it('previews an imported file’s changes, unknown SKUs and invalid rows, and imports after a confirmation', async () => {
    fake.rpcData.admin_import_products = 2;
    await renderAdmin();
    await chooseFile('sku,name,price,tag\nAW-B1,Swisher 1,10.10,NEW\naw-b5,Swisher five,,\nAW-NOPE,Mystery,1.00,\nAW-B6,Swisher 6,10.10,\n');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Import products-edit.csv' }));
    expect(within(preview()).getByText('2 products to change · 1 unchanged · 1 unknown SKU')).toBeTruthy();
    expect(within(preview()).getByText('Columns the file doesn’t have are left as they are. An empty price cell means price on request.')).toBeTruthy();
    expect(within(preview()).getByText('AW-NOPE (line 4)')).toBeTruthy();
    const changes = within(preview()).getAllByRole('row').slice(1);
    expect(changes.map((r) => r.cells[2].textContent)).toEqual([
      'Tag from — to NEW',
      'Name from Swisher 5 to Swisher fivePrice from $10.10 to On request',
    ]);
    await act(async () => { fireEvent.click(within(preview()).getByRole('button', { name: 'Import 2 changes' })); });
    expect(within(confirmDialog()).getByRole('heading').textContent).toBe('Update 2 products?');
    await confirmButton();
    const calls = fake.find({ kind: 'rpc', name: 'admin_import_products' });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ p_rows: [{ sku: 'AW-B1', tag: 'NEW' }, { sku: 'AW-B5', name: 'Swisher five', price: null }] });
    expect(statusText()).toBe('Updated 2 products from products-edit.csv');
    expect(rowOf(5).cells[3].textContent).toBe('Swisher five');
    expect(screen.queryByRole('region', { name: /^Import / })).toBeNull();
    expect(onCatalogChange).toHaveBeenCalledTimes(1);
  });

  it('blocks the import while a row is invalid', async () => {
    await renderAdmin();
    await chooseFile('sku,price,active\nAW-B1,abc,true\nAW-B4,11.00,maybe\n');
    expect(within(preview()).getByText('price: Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.')).toBeTruthy();
    expect(within(preview()).getByText('active: use true or false.')).toBeTruthy();
    expect(within(preview()).getByRole('button', { name: 'Import 0 changes' }).disabled).toBe(true);
    await act(async () => { fireEvent.click(within(preview()).getByRole('button', { name: 'Cancel' })); });
    expect(screen.queryByRole('region', { name: /^Import / })).toBeNull();
  });

  it('says what is wrong with a file it can’t use', async () => {
    await renderAdmin();
    await chooseFile('name,price\nKite,1\n');
    expect(within(preview()).getByRole('alert').textContent).toMatch(/needs a sku column/);
    await act(async () => { fireEvent.click(within(preview()).getByRole('button', { name: 'Close' })); });
    await chooseFile('sku,name\n"AW-B1,Kite\n', 'broken.csv');
    expect(within(preview()).getByRole('alert').textContent).toBe('The file can’t be read: A quoted cell that starts on line 2 never closes.');
  });

  it('turns Import off on a database without admin_import_products; Export still works', async () => {
    fake.respond = (request) => (request.kind === 'rpc' && request.name === 'admin_import_products'
      ? { data: null, error: { code: '42883', message: 'function admin_import_products(jsonb) does not exist' } } : undefined);
    await renderAdmin();
    await chooseFile('sku,tag\nAW-B1,NEW\n');
    await act(async () => { fireEvent.click(within(preview()).getByRole('button', { name: 'Import 1 change' })); });
    await confirmButton();
    expect(within(preview()).getByRole('alert').textContent).toBe('Import needs the October 2026 database update (see BACKEND.md). Export works now.');
    expect(within(preview()).getByRole('button', { name: 'Import 1 change' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Import CSV' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(false);
  });

  it('refuses the whole import when the database no longer knows a SKU', async () => {
    fake.respond = (request) => (request.kind === 'rpc' && request.name === 'admin_import_products'
      ? { data: null, error: { code: 'P0002', message: 'No product has the SKU AW-B1', hint: 'unknown_sku', details: 'AW-B1' } } : undefined);
    await renderAdmin();
    await chooseFile('sku,tag\nAW-B1,NEW\n');
    await act(async () => { fireEvent.click(within(preview()).getByRole('button', { name: 'Import 1 change' })); });
    await confirmButton();
    expect(within(preview()).getByRole('alert').textContent).toBe('No product has the SKU AW-B1 any more, so nothing was imported. Reload the list and choose the file again.');
    expect(rowOf(1).cells[9].textContent).toBe('—');
  });
});
