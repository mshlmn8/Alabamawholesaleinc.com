// Admin -> Homepage with the fake client (AW-119): the hero photos listed in
// the home page's order, adding one with an upload, the form's checks,
// reordering, turning photos off, deleting after a confirmation, a refused
// change, the live database without the table, and the rails, read-only.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { SLIDES_MISSING, RAILS_NOTE } = await import('./HomepageSection.jsx');
const { CatalogProvider } = await import('../../lib/catalog.jsx');
const { getHomeSlidesState, resetHomeSlidesForTests } = await import('../../lib/homeSlides.js');
const { heroImage } = await import('../../lib/images.js');
const { homeRails } = await import('../../lib/merchandising.js');
const { PRODUCTS } = await import('../../data/products.js');
const { HERO_SLIDES } = await import('../../data/content.js');
const { RAIL_LENGTH, hasPhoto } = await import('../HomePage.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const STORAGE = 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-counter.jpg';
const slide = (id, sort, extra = {}) => ({
  id, img: 'hero_candy.jpg', alt: `Photo ${id}`, go_cat: 'CANDIES', nicotine_warning: false, sort, active: true, updated_at: '2026-10-09T12:00:00Z', ...extra,
});
const VAPE = slide(1, 20, { img: 'hero_vape.jpg', alt: 'Geek Bar Pulse X disposable vape advertisement', go_cat: 'NOVELTIES', nicotine_warning: true });
const CANDY = slide(2, 10, { alt: 'Display box of Turtles Bites chocolates' });
const UPLOAD = slide(3, 30, { img: STORAGE, alt: 'Counter display', go_cat: null, active: false });

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  fake.reset();
  fake.tables = { home_slides: [VAPE, CANDY, UPLOAD], profiles: [ADMIN], orders: [] };
  resetHomeSlidesForTests();
});
afterEach(async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  resetHomeSlidesForTests({ client: null });
  vi.restoreAllMocks();
});

const renderHomepage = async () => {
  act(() => navigate('/admin/homepage', { replace: true }));
  await act(async () => {
    render(<CatalogProvider client={null}><RoutedAdmin profile={ADMIN} account="ready" /></CatalogProvider>);
  });
};
const list = () => screen.getByRole('list', { name: 'Hero photos, in order' });
const alts = () => within(list()).getAllByRole('listitem').map((li) => li.querySelector('.admin-slide-alt').textContent);
const item = (alt) => within(list()).getAllByRole('listitem').find((li) => li.querySelector('.admin-slide-alt').textContent === alt);
const statusText = () => document.querySelector('.admin-status-text').textContent;
const click = (el) => act(async () => { fireEvent.click(el); });
const calls = (op) => fake.find({ table: 'home_slides', op });
// The home page's own read: active rows only (refreshHomeSlides).
const storeReads = () => calls('select').filter((c) => c.filters.some(([name, column]) => name === 'eq' && column === 'active'));

describe('Admin -> Homepage (AW-119)', () => {
  it('is a section of its own, listing the hero photos in the home page’s order', async () => {
    await renderHomepage();
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect(within(nav).getByRole('link', { name: 'Homepage' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 2, name: 'Hero photos' })).toBeTruthy();
    expect(calls('select')[0]).toMatchObject({ columns: 'id,img,alt,go_cat,nicotine_warning,sort,active,updated_at' });
    expect(alts()).toEqual(['Display box of Turtles Bites chocolates', 'Geek Bar Pulse X disposable vape advertisement', 'Counter display']);
    expect(item('Geek Bar Pulse X disposable vape advertisement').querySelector('.admin-slide-meta').textContent).toBe('Links to Novelties & Vapes · FDA warning');
    expect(item('Counter display').querySelector('.admin-slide-meta').textContent).toBe('No link');
    expect(item('Counter display').className).toBe('admin-slide inactive');
    expect(within(item('Counter display')).getByText('Off')).toBeTruthy();
    // Previews: the bundled photo's small rendition, the upload by its address.
    expect(item('Display box of Turtles Bites chocolates').querySelector('img').getAttribute('src')).toBe(heroImage('hero_candy.jpg').img);
    expect(item('Counter display').querySelector('img').getAttribute('src')).toBe(STORAGE);
    // Each control names its photo.
    expect(within(item('Counter display')).getByRole('checkbox', { name: 'Shown Counter display' }).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Move up Display box of Turtles Bites chocolates' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Move down Counter display' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Edit Counter display' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Counter display' })).toBeTruthy();
  });

  it('shows the rails as the home page has them, with each product’s tag, rank and Edit link', async () => {
    await renderHomepage();
    expect(screen.getByText(RAILS_NOTE)).toBeTruthy();
    const { newArrivals, bestsellers } = homeRails(PRODUCTS, { limit: RAIL_LENGTH, hasPhoto });
    for (const [title, items] of [['New arrivals', newArrivals], ['Bestsellers', bestsellers]]) {
      const rail = screen.getByRole('region', { name: title });
      const rows = within(rail).getAllByRole('listitem');
      expect(rows.map((li) => li.querySelector('.admin-slide-alt').textContent)).toEqual(items.map((p) => p.name));
      expect(rows[0].querySelector('.admin-slide-meta').textContent).toBe(`${items[0].tag} · No homepage rank`);
      const edit = within(rows[0]).getByRole('link', { name: `Edit ${items[0].name}` });
      // The editor knows to come back here (NEW-076); not ?from=, the editor's copy-from id.
      expect(edit.getAttribute('href')).toBe(`/admin/products/${items[0].id}?back=homepage`);
      expect(edit.id).toBe(`rail-edit-product-${items[0].id}`);
    }
  });

  describe('editing a rail’s product (NEW-076)', () => {
    const url = () => window.location.pathname + window.location.search;
    const { newArrivals } = homeRails(PRODUCTS, { limit: RAIL_LENGTH, hasPhoto });
    const first = () => newArrivals[0];
    const railLink = () => screen.getByRole('link', { name: `Edit ${first().name}` });
    beforeEach(() => {
      // The editor reads the products from the database (made-up rows from the bundled catalog).
      fake.tables.products = PRODUCTS.map((p) => ({
        id: p.id, name: p.name, brand: p.brand, cat: p.cat, sub: p.sub, sku: p.sku, sell_unit: p.sellUnit || '', description: '', variants: p.variants || [],
        variant_axis: p.variantAxis || null, unavailable_variants: [], img: null, tag: p.tag || null, active: true, stock_status: 'in_stock',
        featured_rank: null, updated_at: '2026-10-01T12:00:00Z',
      }));
      fake.rpcData.admin_product_prices = {};
    });

    it('opens the editor from the rail, and Cancel goes Back to the homepage with focus on that Edit link', async () => {
      await renderHomepage();
      await click(railLink());
      expect(url()).toBe(`/admin/products/${first().id}?back=homepage`);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit product' })).toBeTruthy());
      expect(screen.getByLabelText('Name').value).toBe(first().name);
      await click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(url()).toBe('/admin/homepage'));
      await waitFor(() => expect(document.activeElement).toBe(railLink()));
      expect(screen.getByRole('link', { name: 'Homepage' }).getAttribute('aria-current')).toBe('page');
    });

    it('comes back to the homepage after a save too, also when the editor was opened by its address', async () => {
      act(() => navigate(`/admin/products/${first().id}?back=homepage`, { replace: true }));
      await act(async () => {
        render(<CatalogProvider client={null}><RoutedAdmin profile={ADMIN} account="ready" /></CatalogProvider>);
      });
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit product' })).toBeTruthy());
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: `${first().name} 2` } });
      fake.respond = (request) => (request.table === 'products' && request.op === 'update'
        ? { data: [{ id: first().id }], error: null } : undefined);
      await act(async () => { fireEvent.submit(document.querySelector('form.product-form')); });
      expect(fake.find({ table: 'products', op: 'update' })).toHaveLength(1);
      await waitFor(() => expect(url()).toBe('/admin/homepage'));
      await waitFor(() => expect(document.activeElement).toBe(railLink()));
    });

    it('focuses the rails’ heading when the product is no longer in a rail', async () => {
      act(() => navigate(`/admin/products/${first().id}?back=homepage`, { replace: true }));
      await act(async () => {
        render(<CatalogProvider client={null}><RoutedAdmin profile={ADMIN} account="ready" /></CatalogProvider>);
      });
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit product' })).toBeTruthy());
      // As if it had left the rails: the link the editor would focus isn't there.
      const { railEditId } = await import('./HomepageSection.jsx');
      const spy = vi.spyOn(document, 'getElementById');
      spy.mockImplementation(function byId(id) {
        return id === railEditId(first().id) ? null : Document.prototype.getElementById.call(document, id);
      });
      await click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(url()).toBe('/admin/homepage'));
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Homepage rails' })));
    });
  });

  it('adds a photo with an upload, last in the order', async () => {
    fake.respond = (request) => {
      if (request.table !== 'home_slides' || request.op !== 'insert') return undefined;
      const added = { ...request.rows, id: 9, updated_at: '2026-10-09T13:00:00Z' };
      fake.tables.home_slides = [...fake.tables.home_slides, added];
      return { data: [added], error: null };
    };
    await renderHomepage();
    await click(screen.getByRole('button', { name: 'Add a photo' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Add a hero photo' }));
    const file = new File(['png'], 'Counter Display.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Or upload a photo'), { target: { files: [file] } }); });
    const upload = fake.find({ kind: 'storage', op: 'upload' })[0];
    expect(upload).toMatchObject({ bucket: 'product-images', options: { contentType: 'image/png', upsert: false } });
    expect(upload.path).toMatch(/^home\/\d+-counter-display\.png$/);
    const address = `https://fake.supabase.co/storage/v1/object/public/product-images/${upload.path}`;
    expect(screen.getByLabelText('Or the address of an uploaded photo').value).toBe(address);
    expect(document.querySelector('.slide-form .product-photo-preview img').getAttribute('src')).toBe(address);
    fireEvent.change(screen.getByLabelText('Description of the photo'), { target: { value: ' Counter display of lighters ' } });
    fireEvent.change(screen.getByLabelText('Links to'), { target: { value: 'MERCHANDISE' } });
    fireEvent.click(screen.getByLabelText('Shows a nicotine product (adds the FDA warning)'));
    const readsBefore = storeReads().length;
    await click(screen.getByRole('button', { name: 'Add photo' }));
    expect(calls('insert')).toHaveLength(1);
    expect(calls('insert')[0]).toMatchObject({
      rows: { img: address, alt: 'Counter display of lighters', go_cat: 'MERCHANDISE', nicotine_warning: true, active: true, sort: 40 },
      returning: 'id,img,alt,go_cat,nicotine_warning,sort,active,updated_at',
    });
    expect(statusText()).toBe('Added “Counter display of lighters” to the hero photos.');
    expect(alts().at(-1)).toBe('Counter display of lighters');
    expect(document.querySelector('form.slide-form')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Counter display of lighters' }));
    // The home page in this tab loads its photos again.
    expect(storeReads().length).toBe(readsBefore + 1);
  });

  it('checks the photo and the description before anything is saved, and never previews another site', async () => {
    await renderHomepage();
    await click(screen.getByRole('button', { name: 'Add a photo' }));
    await click(screen.getByRole('button', { name: 'Add photo' }));
    expect(screen.getByLabelText('Bundled photo').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Bundled photo'));
    expect(screen.getByLabelText('Description of the photo').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(screen.getByLabelText('Description of the photo').getAttribute('aria-describedby').split(' ')[1]).textContent)
      .toBe('Describe what the photo shows.');
    fireEvent.change(screen.getByLabelText('Or the address of an uploaded photo'), { target: { value: 'https://example.com/a.jpg' } });
    expect(document.querySelector('.slide-form .product-photo-preview img')).toBeNull();
    expect(screen.getByText('Photos on other sites are blocked by the site’s security settings. Upload the photo instead.')).toBeTruthy();
    await click(screen.getByRole('button', { name: 'Add photo' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Or the address of an uploaded photo'));
    expect(calls('insert')).toHaveLength(0);
    // A bundled photo instead.
    fireEvent.change(screen.getByLabelText('Bundled photo'), { target: { value: 'hero_lighters.jpg' } });
    expect(screen.getByLabelText('Or the address of an uploaded photo').value).toBe('');
    expect(document.querySelector('.slide-form .product-photo-preview img').getAttribute('src')).toBe(heroImage('hero_lighters.jpg').picture.src);
  });

  it('edits a photo, saving only what changed', async () => {
    await renderHomepage();
    await click(screen.getByRole('button', { name: 'Edit Geek Bar Pulse X disposable vape advertisement' }));
    expect(screen.getByLabelText('Bundled photo').value).toBe('hero_vape.jpg');
    expect(screen.getByLabelText('Links to').value).toBe('NOVELTIES');
    expect(screen.getByLabelText('Shows a nicotine product (adds the FDA warning)').checked).toBe(true);
    await click(screen.getByRole('button', { name: 'Save photo' }));
    expect(screen.getByRole('alert').textContent).toBe('Nothing has changed.');
    fireEvent.change(screen.getByLabelText('Links to'), { target: { value: '' } });
    await click(screen.getByRole('button', { name: 'Save photo' }));
    expect(calls('update')).toHaveLength(1);
    expect(calls('update')[0]).toMatchObject({ patch: { go_cat: null }, filters: [['eq', 'id', 1]], returning: 'id' });
    expect(statusText()).toBe('Saved “Geek Bar Pulse X disposable vape advertisement”.');
  });

  it('moves a photo up by swapping two sorts, says where it went and keeps focus on the photo', async () => {
    await renderHomepage();
    await click(screen.getByRole('button', { name: 'Move up Geek Bar Pulse X disposable vape advertisement' }));
    expect(calls('update').map((c) => [c.patch, c.filters])).toEqual([
      [{ sort: 10 }, [['eq', 'id', 1]]],
      [{ sort: 20 }, [['eq', 'id', 2]]],
    ]);
    expect(alts()).toEqual(['Geek Bar Pulse X disposable vape advertisement', 'Display box of Turtles Bites chocolates', 'Counter display']);
    expect(statusText()).toBe('Moved “Geek Bar Pulse X disposable vape advertisement” to place 1 of 3.');
    // At the top Move up is off, so Move down has focus.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move down Geek Bar Pulse X disposable vape advertisement' }));
  });

  it('turns a photo off and on at once, and its Shown box keeps the focus (NEW-071)', async () => {
    await renderHomepage();
    const name = 'Shown Display box of Turtles Bites chocolates';
    const box = within(item('Display box of Turtles Bites chocolates')).getByRole('checkbox', { name });
    // Every Shown box is named with its photo, like the row's buttons.
    expect(screen.getAllByRole('checkbox', { name: /^Shown / }).map((b) => b.id)).toEqual(
      ['2', '1', '3'].map((rowId) => expect.stringMatching(new RegExp(`-slide-${rowId}-shown$`))),
    );
    // The box is disabled while the write runs (a browser drops its focus
    // then): it is focused again once the write is done.
    const focus = vi.spyOn(box, 'focus');
    box.focus();
    focus.mockClear();
    await click(box);
    expect(calls('update')[0]).toMatchObject({ patch: { active: false }, filters: [['eq', 'id', 2]] });
    expect(statusText()).toBe('“Display box of Turtles Bites chocolates” is off the home page.');
    expect(item('Display box of Turtles Bites chocolates').className).toBe('admin-slide inactive');
    expect(focus).toHaveBeenCalled();
    expect(document.activeElement).toBe(box);
    expect(box.disabled).toBe(false);
    await click(within(item('Display box of Turtles Bites chocolates')).getByRole('checkbox', { name }));
    expect(calls('update')[1]).toMatchObject({ patch: { active: true } });
    expect(statusText()).toBe('“Display box of Turtles Bites chocolates” is shown on the home page.');
  });

  it('deletes a photo only after a confirmation', async () => {
    await renderHomepage();
    await click(screen.getByRole('button', { name: 'Delete Counter display' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Delete “Counter display”?');
    expect(within(dialog).getByText(/An uploaded photo file stays in storage\. To keep the photo for later, turn it off instead\./)).toBeTruthy();
    await click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls('delete')).toHaveLength(0);
    await click(screen.getByRole('button', { name: 'Delete Counter display' }));
    await click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete photo' }));
    expect(calls('delete')[0]).toMatchObject({ filters: [['eq', 'id', 3]], returning: 'id' });
    expect(alts()).toEqual(['Display box of Turtles Bites chocolates', 'Geek Bar Pulse X disposable vape advertisement']);
    expect(statusText()).toBe('Deleted “Counter display” from the hero photos.');
  });

  it('says when a change is refused, and keeps the photo as it was', async () => {
    fake.respond = (request) => (request.table === 'home_slides' && request.op === 'update'
      ? { data: null, error: { code: '42501', message: 'permission denied for table home_slides' }, status: 403 } : undefined);
    await renderHomepage();
    const box = within(item('Display box of Turtles Bites chocolates')).getByRole('checkbox', { name: 'Shown Display box of Turtles Bites chocolates' });
    const focus = vi.spyOn(box, 'focus');
    await click(box);
    expect(screen.getByRole('alert').textContent).toBe('“Display box of Turtles Bites chocolates” wasn’t changed: your account isn’t allowed to do that.');
    expect(box.checked).toBe(true);
    // A refused change gives the box its focus back too (NEW-071).
    expect(focus).toHaveBeenCalled();
    expect(document.activeElement).toBe(box);
    // An update RLS hides (no row back) says so too.
    fake.respond = (request) => (request.table === 'home_slides' && request.op === 'update' ? { data: [], error: null } : undefined);
    await click(screen.getByRole('button', { name: 'Move down Display box of Turtles Bites chocolates' }));
    expect(screen.getByRole('alert').textContent).toBe('“Display box of Turtles Bites chocolates” wasn’t moved: your account isn’t allowed to change it, or it no longer exists.');
    expect(alts()[0]).toBe('Display box of Turtles Bites chocolates');
  });

  it('shows the bundled photos read-only, and the rails, on a database without the table', async () => {
    fake.respond = (request) => (request.table === 'home_slides'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.home_slides' in the schema cache" }, status: 404 } : undefined);
    await renderHomepage();
    expect(screen.getByText(SLIDES_MISSING)).toBeTruthy();
    expect(SLIDES_MISSING).toMatch(/needs the October 2026 database update \(see BACKEND\.md\)/);
    const bundled = screen.getByRole('list', { name: 'Bundled hero photos' });
    expect(within(bundled).getAllByRole('listitem').map((li) => li.querySelector('.admin-slide-alt').textContent)).toEqual(HERO_SLIDES.map((s) => s.alt));
    expect(within(bundled).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Add a photo' })).toBeNull();
    expect(screen.getByRole('region', { name: 'New arrivals' })).toBeTruthy();
    expect(getHomeSlidesState().slides).toBe(HERO_SLIDES);
  });

  it('shows a failed load with Try again', async () => {
    fake.respond = (request) => (request.table === 'home_slides' ? { data: null, error: { code: 'XX000', message: 'upstream timeout' }, status: 500 } : undefined);
    await renderHomepage();
    expect(screen.getByRole('alert').textContent).toMatch(/^The hero photos didn’t load/);
    fake.respond = null;
    await click(screen.getByRole('button', { name: 'Try again' }));
    expect(alts()).toHaveLength(3);
  });
});
