// Admin -> Products with the fake client: the list (photos, New product, Edit
// links), and the product editor at /admin/products/:id and /new (AW-023,
// AW-116, AW-117, AW-118): focus, Enter and Escape, unsaved changes, checked
// saves and the live database's fallbacks, delete, photos.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { ADMIN_COLUMN_STEPS, SEARCH_DEBOUNCE_MS, resetAdminProductColumnsForTests } = await import('./ProductsSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const base = {
  tag: null, active: true, description: '', sell_unit: '', unavailable_variants: [], variant_axis: null, img: null,
  stock_status: 'in_stock', featured_rank: null, updated_at: '2026-10-01T12:00:00Z',
};
const SWISHER = { ...base, id: 1, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', sku: 'AW-SW', variants: [], img: 'https://cdn.example.test/sw.jpg' };
const KITE = { ...base, id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe Tobacco', sku: 'AW-KITE', variants: ['Red', 'Blue'], variant_axis: 'Color' };
const OLD = { ...base, id: 3, name: 'Old stock', brand: 'Old', cat: 'CANDIES', sub: 'Chocolate Bars', sku: 'AW-OLD', variants: [], active: false };
const url = () => window.location.pathname + window.location.search;

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

let onCatalogChange;
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin/products', { replace: true }));
  resetAdminProductColumnsForTests();
  fake.reset();
  fake.tables = { products: [SWISHER, KITE, OLD], profiles: [ADMIN], orders: [], order_items: [] };
  fake.rpcData.admin_product_prices = { 1: { list: 10, variants: {} }, 2: { list: 12.5, variants: { Red: { list: 13 } } }, 3: { list: null, variants: {} } };
  onCatalogChange = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderAdmin = async (path = '/admin/products') => {
  act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" onCatalogChange={onCatalogChange} />); });
};
const editLink = (name) => screen.getByRole('link', { name: new RegExp(`^Edit ?${name}$`) });
const openEditor = async (name) => { await act(async () => { fireEvent.click(editLink(name)); }); };
const field = (label) => screen.getByLabelText(label);
const form = () => document.querySelector('form.product-form');
const submit = async () => { await act(async () => { fireEvent.submit(form()); }); };
const statusText = () => document.querySelector('.admin-status-text').textContent;
const updates = () => fake.find({ table: 'products', op: 'update' });
const inserts = () => fake.find({ table: 'products', op: 'insert' });
// history.back() lands a moment later (popstate).
const backAtList = () => waitFor(() => expect(url()).toBe('/admin/products'));

describe('the products list (AW-023)', () => {
  it('shows a 48px photo per row, New product, Edit links and View on site for active products', async () => {
    await renderAdmin();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const photo = rows[0].querySelector('img.product-thumb');
    expect([photo.getAttribute('src'), photo.getAttribute('width'), photo.getAttribute('height'), photo.getAttribute('alt')])
      .toEqual(['https://cdn.example.test/sw.jpg', '48', '48', '']);
    expect(rows[2].querySelector('.product-thumb .photo-soon')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New product' }).getAttribute('href')).toBe('/admin/products/new');
    expect(editLink('Kite').getAttribute('href')).toBe('/admin/products/2');
    expect(editLink('Kite').id).toBe('edit-product-2');
    expect(screen.getByRole('link', { name: 'View on site: Kite' }).getAttribute('href')).toBe('/product/2');
    expect(screen.queryByRole('link', { name: 'View on site: Old stock' })).toBeNull();
    // Every column the editor needs, never price; prices from admin_product_prices().
    const select = fake.find({ table: 'products', op: 'select' })[0];
    expect(select.columns).toBe(ADMIN_COLUMN_STEPS[0]);
    expect(select.columns.split(',')).not.toContain('price');
    expect(screen.getAllByRole('cell', { name: '$12.50' })).toHaveLength(1);
  });

  it('steps down the columns on a database without the October 2026 ones, and remembers the step', async () => {
    fake.respond = (request) => {
      if (request.table !== 'products' || request.op !== 'select') return undefined;
      return /stock_status|variant_axis/.test(request.columns)
        ? { data: null, error: { code: '42703', message: 'column products.stock_status does not exist' } } : undefined;
    };
    await renderAdmin();
    expect(fake.find({ table: 'products', op: 'select' }).map((r) => r.columns)).toEqual(ADMIN_COLUMN_STEPS);
    expect(screen.getByText('3 of 3 products')).toBeTruthy();
    await openEditor('Kite');
    // The fields of the missing columns say so; "can't be ordered" and the
    // variant prices are not offered.
    expect(field('Stock status').disabled).toBe(true);
    expect(screen.getByText('Stock status needs the October 2026 database update (see BACKEND.md).')).toBeTruthy();
    expect(field('Homepage rank').disabled).toBe(true);
    expect(screen.queryByLabelText(/Can’t be ordered/)).toBeNull();
    expect(screen.queryByLabelText(/List price of variant/)).toBeNull();
  });
});

describe('the product editor: focus, Enter and Escape (AW-117)', () => {
  it('opens at /admin/products/:id with focus in Name, and a clean Escape goes back to the list, focusing the Edit link', async () => {
    await renderAdmin();
    await openEditor('Kite');
    expect(url()).toBe('/admin/products/2');
    expect(screen.getByRole('heading', { name: 'Edit product' })).toBeTruthy();
    expect(document.activeElement).toBe(field('Name'));
    expect(field('Name').value).toBe('Kite');
    expect(field('List price').value).toBe('12.50');
    expect(form().noValidate).toBe(true);
    expect(within(form()).getByRole('button', { name: 'Save product' }).type).toBe('submit');
    await act(async () => { fireEvent.keyDown(field('Brand'), { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await backAtList();
    await waitFor(() => expect(document.activeElement).toBe(editLink('Kite')));
  });

  it('asks before Escape or Cancel drops changes, keeps them on “Keep editing”, and leaves on “Discard changes”', async () => {
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('Name'), { target: { value: 'Kite pipe tobacco' } });
    fireEvent.keyDown(field('Name'), { key: 'Escape' });
    const dialog = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    expect(within(dialog).getByText('Your changes to Kite pipe tobacco aren’t saved.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(field('Name').value).toBe('Kite pipe tobacco');
    fireEvent.click(within(form()).getByRole('button', { name: 'Cancel' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })); });
    await backAtList();
    await waitFor(() => expect(document.activeElement).toBe(editLink('Kite')));
    expect(updates()).toHaveLength(0);
  });

  it('asks before a link, Back or a reload drops changes (useLeaveGuard)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('List price'), { target: { value: '12.34' } });
    const orders = screen.getByRole('navigation', { name: 'Admin sections' }).querySelector('a[href^="/admin/orders"]');
    await act(async () => { fireEvent.click(orders); });
    expect(confirm).toHaveBeenCalledWith('Your changes to Kite aren’t saved. Leave without saving them?');
    expect(url()).toBe('/admin/products/2');
    expect(field('List price').value).toBe('12.34');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('a deep link opens the editor too, and leaving it goes to the list by link', async () => {
    await renderAdmin('/admin/products/1');
    expect(document.activeElement).toBe(field('Name'));
    fireEvent.click(within(form()).getByRole('button', { name: 'Cancel' }));
    await backAtList();
    await waitFor(() => expect(document.activeElement).toBe(editLink('Swisher Sweets')));
  });
});

describe('saving (AW-023, AW-116, AW-202)', () => {
  it('Enter (the form’s submit) saves only what changed, says so, reloads the catalog and returns to the Edit link', async () => {
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('List price'), { target: { value: ' 13.40 ' } });
    fireEvent.change(field('Variant 1'), { target: { value: 'Red' } });
    fireEvent.change(field('List price of variant 2'), { target: { value: '9' } });
    await submit();
    expect(updates()).toHaveLength(1);
    expect(updates()[0]).toMatchObject({ patch: { price: 13.4 }, filters: [['eq', 'id', 2]], returning: 'id' });
    expect(fake.find({ table: 'product_variant_prices', op: 'upsert' })[0]).toMatchObject({
      rows: [{ product_id: 2, variant: 'Blue', price: 9 }], options: { onConflict: 'product_id,variant' },
    });
    expect(statusText()).toBe('Saved Kite.');
    expect(onCatalogChange).toHaveBeenCalledTimes(1);
    await backAtList();
    await waitFor(() => expect(document.activeElement).toBe(editLink('Kite')));
  });

  it('refuses a blank name, a negative price and a duplicate SKU, lists them and focuses the first; nothing is sent', async () => {
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('Name'), { target: { value: '  ' } });
    fireEvent.change(field('List price'), { target: { value: '-5' } });
    fireEvent.change(field('SKU'), { target: { value: 'aw-sw' } });
    await submit();
    const summary = screen.getByRole('alert');
    expect(within(summary).getByText('Check these 3 fields:')).toBeTruthy();
    expect([...summary.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Name: Enter the product name.',
      'SKU: That SKU is already used by another product.',
      expect.stringMatching(/^List price: Enter the price as an amount from 0 to 99999\.99/),
    ]);
    expect(document.activeElement).toBe(field('Name'));
    expect(field('Name').getAttribute('aria-invalid')).toBe('true');
    expect(field('Name').getAttribute('aria-describedby')).toBe('product-name-error');
    expect(document.getElementById('product-name-error').textContent).toBe('Enter the product name.');
    expect(field('SKU').getAttribute('aria-describedby')).toBe('product-sku-hint product-sku-error');
    expect(updates()).toHaveLength(0);
    // Fixing a field clears its error.
    fireEvent.change(field('Name'), { target: { value: 'Kite' } });
    expect(field('Name').getAttribute('aria-invalid')).toBeNull();
  });

  it('a refused save keeps the values and shows the error; a database refusal of the SKU goes under SKU', async () => {
    let answer = { data: null, error: { code: '42501', message: 'permission denied' }, status: 403 };
    fake.respond = (request) => (request.op === 'update' && request.table === 'products' ? answer : undefined);
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('Brand'), { target: { value: 'Kite Co' } });
    await submit();
    expect(screen.getByRole('alert').textContent).toBe('The changes to Kite weren’t saved: your account isn’t allowed to do that.');
    expect(field('Brand').value).toBe('Kite Co');
    expect(url()).toBe('/admin/products/2');
    answer = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "products_sku_upper_key"' }, status: 409 };
    await submit();
    expect(document.getElementById('product-sku-error').textContent).toBe('That SKU is already used.');
    expect(document.activeElement).toBe(field('SKU'));
    answer = { data: null, error: { code: '23514', message: 'new row for relation "products" violates check constraint "products_price_max"' }, status: 400 };
    await submit();
    expect(document.getElementById('product-price-error').textContent).toMatch(/^Enter a price from 0 to 99999\.99/);
    answer = undefined;
    await submit();
    expect(statusText()).toBe('Saved Kite.');
  });

  it('a save the database answers PGRST204 (a missing column) retries without the new columns and says so', async () => {
    fake.respond = (request) => (request.op === 'update' && 'stock_status' in (request.patch || {})
      ? { data: null, error: { code: 'PGRST204', message: 'Could not find the \'stock_status\' column of \'products\' in the schema cache' }, status: 400 }
      : undefined);
    await renderAdmin();
    await openEditor('Kite');
    fireEvent.change(field('Name'), { target: { value: 'Kite tobacco' } });
    fireEvent.change(field('Stock status'), { target: { value: 'low' } });
    await submit();
    expect(updates().map((r) => r.patch)).toEqual([{ name: 'Kite tobacco', stock_status: 'low' }, { name: 'Kite tobacco' }]);
    expect(statusText()).toBe('Saved Kite tobacco. Stock status: not saved, needs the October 2026 database update (see BACKEND.md).');
  });

  it('a new product is inserted without an id, and once more with the next id when the database has no id default (23502)', async () => {
    fake.respond = (request) => {
      if (request.table !== 'products' || request.op !== 'insert') return undefined;
      if (!('id' in request.rows)) {
        return { data: null, error: { code: '23502', message: 'null value in column "id" of relation "products" violates not-null constraint' }, status: 400 };
      }
      fake.tables.products = [...fake.tables.products, { ...base, ...request.rows }];
      return { data: [{ id: request.rows.id }], error: null, status: 201 };
    };
    await renderAdmin();
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'New product' })); });
    expect(url()).toBe('/admin/products/new');
    expect(screen.getByRole('heading', { name: 'New product' })).toBeTruthy();
    expect(document.activeElement).toBe(field('Name'));
    fireEvent.change(field('Name'), { target: { value: 'Nerds bags' } });
    fireEvent.change(field('Brand'), { target: { value: 'Nerds' } });
    fireEvent.change(field('Department'), { target: { value: 'CANDIES' } });
    fireEvent.change(field('Sub-line'), { target: { value: '__new__' } });
    fireEvent.change(field('New sub-line name'), { target: { value: 'Sweets & Gummies' } });
    fireEvent.change(field('SKU'), { target: { value: 'aw-nerds-bags' } });
    fireEvent.change(field('Tag'), { target: { value: 'NEW' } });
    fireEvent.change(field('Homepage rank'), { target: { value: '2' } });
    await submit();
    expect(inserts()).toHaveLength(2);
    expect(inserts()[0].rows).not.toHaveProperty('id');
    expect(inserts()[0].rows).not.toHaveProperty('flavors');
    expect(inserts()[0].rows).toMatchObject({
      name: 'Nerds bags', brand: 'Nerds', cat: 'CANDIES', sub: 'Sweets & Gummies', sku: 'AW-NERDS-BAGS', tag: 'NEW', featured_rank: 2,
      price: null, active: true, stock_status: 'in_stock', variants: [], variant_axis: null,
    });
    expect(inserts()[1].rows).toMatchObject({ id: 4, name: 'Nerds bags' });
    expect(statusText()).toBe('Saved Nerds bags.');
    await backAtList();
    await waitFor(() => expect(document.activeElement).toBe(editLink('Nerds bags')));
  });

  it('Duplicate starts a new product from a copy: “ (copy)”, no SKU', async () => {
    await renderAdmin('/admin/products/2');
    expect(screen.getByRole('link', { name: 'Duplicate' }).getAttribute('href')).toBe('/admin/products/new?from=2');
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Duplicate' })); });
    expect(url()).toBe('/admin/products/new?from=2');
    expect(field('Name').value).toBe('Kite (copy)');
    expect(field('SKU').value).toBe('');
    expect(field('Variant 1').value).toBe('Red');
    expect(screen.getByText('A copy of product 2')).toBeTruthy();
  });
});

describe('variants (AW-023)', () => {
  it('adds, moves with buttons (focus stays on the moved row), marks “can’t be ordered” and removes', async () => {
    await renderAdmin('/admin/products/2');
    fireEvent.click(screen.getByRole('button', { name: 'Add variant' }));
    expect(document.activeElement).toBe(field('Variant 3'));
    fireEvent.change(field('Variant 3'), { target: { value: 'Green' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move up: variant 3' }));
    expect(field('Variant 2').value).toBe('Green');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move up: variant 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move up: variant 2' }));
    // At the top, Move up is off: focus goes to Move down.
    expect(field('Variant 1').value).toBe('Green');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move down: variant 1' }));
    fireEvent.click(screen.getByLabelText('Can’t be ordered: variant 3'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove: variant 2' }));
    expect(document.activeElement).toBe(field('Variant 2'));
    await submit();
    expect(updates()[0].patch).toEqual({ variants: ['Green', 'Blue'], unavailable_variants: ['Blue'] });
    // Red's own price row goes with it.
    expect(fake.find({ table: 'product_variant_prices', op: 'delete' })[0].filters).toEqual([['eq', 'product_id', 2], ['eq', 'variant', 'Red']]);
  });
});

describe('delete (AW-023)', () => {
  it('is blocked for a product on order lines: only Deactivate is offered, with the reason', async () => {
    fake.tables.order_items = [{ id: 7, product_id: 2 }];
    await renderAdmin('/admin/products/2');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete product' })); });
    expect(fake.find({ table: 'order_items' })[0]).toMatchObject({ columns: 'id', options: { count: 'exact', head: true }, filters: [['eq', 'product_id', 2]] });
    const dialog = screen.getByRole('alertdialog', { name: 'Deactivate Kite?' });
    expect(within(dialog).getByText(/^It is on 1 order line, so it can’t be deleted/)).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Delete product' })).toBeNull();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' })); });
    expect(updates()[0]).toMatchObject({ patch: { active: false }, filters: [['eq', 'id', 2]] });
    expect(fake.find({ table: 'products', op: 'delete' })).toHaveLength(0);
    expect(statusText()).toBe('Deactivated Kite. It stays in the order history.');
  });

  it('an inactive product on order lines just says why it stays', async () => {
    fake.tables.order_items = [{ id: 7, product_id: 3 }, { id: 8, product_id: 3 }];
    await renderAdmin('/admin/products/3');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete product' })); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText(/^Old stock is on 2 order lines, so it can’t be deleted/)).toBeTruthy();
  });

  it('deletes a product without order lines after a confirmation, and maps the database’s product_has_orders refusal', async () => {
    let refuse = true;
    fake.respond = (request) => (request.op === 'delete' && refuse
      ? { data: null, error: { code: '23503', hint: 'product_has_orders', message: 'Product 1 is on order lines' }, status: 409 }
      : undefined);
    await renderAdmin('/admin/products/1');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete product' })); });
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Swisher Sweets?' });
    expect(within(dialog).getByText('This can’t be undone.')).toBeTruthy();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete product' })); });
    expect(screen.getByRole('alert').textContent).toBe('Swisher Sweets is on an order now, so it can’t be deleted. Deactivate it instead.');
    refuse = false;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete product' })); });
    await act(async () => { fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete product' })); });
    expect(fake.find({ table: 'products', op: 'delete' }).at(-1).filters).toEqual([['eq', 'id', 1]]);
    expect(statusText()).toBe('Deleted Swisher Sweets.');
    await backAtList();
  });
});

describe('photos (AW-023)', () => {
  const fakePhoto = (type = 'image/png', size = 12) => new File([new Uint8Array(size)], 'Kite Front.png', { type });

  it('uploads a JPEG, PNG or WebP to product-images and puts its public URL in the image field', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    await renderAdmin('/admin/products/2');
    await act(async () => { fireEvent.change(field('Upload a photo'), { target: { files: [fakePhoto()] } }); });
    const upload = fake.find({ kind: 'storage', op: 'upload' })[0];
    expect(upload).toMatchObject({ bucket: 'product-images', path: 'products/2/1700000000000-kite-front.png', options: { contentType: 'image/png', upsert: false } });
    expect(field('Image file or URL').value).toBe('https://files.example.test/public/product-images/products/2/1700000000000-kite-front.png');
    expect(document.querySelector('.product-photo-preview img').getAttribute('src')).toBe(field('Image file or URL').value);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(field('Image file or URL').value).toBe('');
  });

  it('refuses other files before uploading, and says when the bucket isn’t there yet', async () => {
    fake.respond = (request) => (request.op === 'upload' ? { data: null, error: { message: 'Bucket not found', statusCode: '404' } } : undefined);
    await renderAdmin('/admin/products/2');
    await act(async () => { fireEvent.change(field('Upload a photo'), { target: { files: [fakePhoto('image/gif')] } }); });
    expect(document.getElementById('product-photo-file-error').textContent).toBe('Choose a JPEG, PNG or WebP photo.');
    await act(async () => { fireEvent.change(field('Upload a photo'), { target: { files: [fakePhoto('image/jpeg', 6 * 1024 * 1024)] } }); });
    expect(document.getElementById('product-photo-file-error').textContent).toBe('Choose a photo of at most 5 MB.');
    expect(fake.find({ op: 'upload' })).toHaveLength(0);
    await act(async () => { fireEvent.change(field('Upload a photo'), { target: { files: [fakePhoto()] } }); });
    expect(document.getElementById('product-photo-file-error').textContent)
      .toBe('Photo upload needs the October 2026 database update; enter a file name or URL instead.');
    expect(field('Image file or URL').value).toBe('');
  });
});

describe('the list search (AW-118)', () => {
  it('writes ?q= without asking, and the editor’s Back returns to the filtered list', async () => {
    await renderAdmin();
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'kite' } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
    vi.useRealTimers();
    expect(url()).toBe('/admin/products?q=kite');
    await openEditor('Kite');
    fireEvent.keyDown(field('Name'), { key: 'Escape' });
    await waitFor(() => expect(url()).toBe('/admin/products?q=kite'));
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('kite');
    await waitFor(() => expect(document.activeElement).toBe(editLink('Kite')));
  });
});
