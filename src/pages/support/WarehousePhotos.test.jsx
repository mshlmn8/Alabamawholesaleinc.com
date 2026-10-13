// The contact page's warehouse photos (AW-006): the 29 photos the home
// page's reel doesn't show, as tiles that open a larger view, with the
// tobacco, vape and nicotine-pouch photos under the FDA statement.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WAREHOUSE_GALLERY } from '../../data/warehousePhotos.js';
import { NICOTINE_WARNING_TEXT } from '../../components/NicotineWarning.jsx';
import { SIZES, zoomSizes } from '../../lib/images.js';

// Every photo as a responsive set, whether or not the image build has run
// (without its manifest a photo is a single URL, with no srcset).
vi.mock('../../lib/images.js', async (importOriginal) => {
  const actual = await importOriginal();
  const base = (file) => file.replace(/\.jpg$/, '');
  return {
    ...actual,
    heroImage: (file) => ({
      img: `/img/${base(file)}--480x270.jpg`,
      picture: {
        src: `/img/${base(file)}--480x270.jpg`, srcSet: `/img/${base(file)}--480x270.jpg 480w`,
        webpSrcSet: `/img/${base(file)}--480x270.webp 480w, /img/${base(file)}--1280x720.webp 1280w`, width: 1280, height: 720,
      },
    }),
  };
});

const { GENERAL_PHOTOS, NICOTINE_PHOTOS, PRICE_NOTE, WAREHOUSE_ASPECT, WarehousePhotos } = await import('./WarehousePhotos.jsx');

const general = WAREHOUSE_GALLERY.filter((photo) => !photo.nicotine);
const nicotine = WAREHOUSE_GALLERY.filter((photo) => photo.nicotine);
const grid = (name) => screen.getByRole('list', { name });
const tiles = (name) => within(grid(name)).getAllByRole('button');
const viewer = () => screen.queryByRole('dialog', { name: 'Warehouse photos' });
// What the live caption reads out, and the place shown between the buttons.
const caption = () => viewer().querySelector('.warehouse-viewer-caption').textContent;
const place = () => viewer().querySelector('.warehouse-viewer-count').textContent;

describe('WarehousePhotos', () => {
  it('shows all 29 photos once, each tile a button named by its photo’s description', () => {
    render(<WarehousePhotos />);
    expect(screen.getByRole('heading', { level: 2, name: 'A look around the warehouse' })).toBeTruthy();
    expect(tiles('Warehouse photos').map((b) => b.textContent)).toEqual(general.map((p) => p.alt));
    expect(tiles('Tobacco, vapes and nicotine pouches').map((b) => b.textContent)).toEqual(nicotine.map((p) => p.alt));
    expect(GENERAL_PHOTOS.length + NICOTINE_PHOTOS.length).toBe(29);
    for (const button of [...tiles('Warehouse photos'), ...tiles('Tobacco, vapes and nicotine pouches')]) {
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      // The photo is the button's picture; the description names it.
      const img = button.querySelector('img');
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('sizes')).toBe(SIZES.warehouse);
      expect(button.querySelector('source').getAttribute('sizes')).toBe(SIZES.warehouse);
    }
  });

  it('groups the tobacco, vape and nicotine-pouch photos under the FDA statement, and only those', () => {
    render(<WarehousePhotos />);
    const group = screen.getByRole('heading', { level: 3, name: 'Tobacco, vapes and nicotine pouches' }).closest('section');
    const statements = document.querySelectorAll('.warehouse-photos .nicotine-warning');
    expect(statements).toHaveLength(1);
    expect(group.contains(statements[0])).toBe(true);
    expect(statements[0].textContent).toBe(NICOTINE_WARNING_TEXT);
    // Above the photos it stands for.
    expect(statements[0].compareDocumentPosition(grid('Tobacco, vapes and nicotine pouches')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.contains(grid('Warehouse photos'))).toBe(false);
  });

  it('says the shelf stickers in the photos aren’t prices', () => {
    render(<WarehousePhotos />);
    expect(screen.getByText(PRICE_NOTE)).toBeTruthy();
  });

  it('opens a photo larger, steps through its group with the buttons and arrow keys, and closes back to its tile', () => {
    render(<WarehousePhotos />);
    const tile = tiles('Warehouse photos')[3];
    tile.focus();
    fireEvent.click(tile);
    expect(viewer().getAttribute('aria-modal')).toBe('true');
    const img = () => viewer().querySelector('.warehouse-viewer-frame img');
    expect(img().getAttribute('alt')).toBe(general[3].alt);
    expect(img().getAttribute('loading')).toBe('eager');
    expect(viewer().querySelector('source').getAttribute('sizes')).toBe(zoomSizes(1280, WAREHOUSE_ASPECT));
    expect(caption()).toBe(`${general[3].alt}, photo 4 of 19`);
    expect(place()).toBe('4 of 19');
    expect(viewer().querySelector('.nicotine-warning')).toBeNull();
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Next photo' }));
    expect(img().getAttribute('alt')).toBe(general[4].alt);
    fireEvent.keyDown(viewer(), { key: 'ArrowLeft' });
    fireEvent.keyDown(viewer(), { key: 'ArrowLeft' });
    expect(caption()).toBe(`${general[2].alt}, photo 3 of 19`);
    fireEvent.keyDown(viewer(), { key: 'ArrowRight', ctrlKey: true });
    expect(place()).toBe('3 of 19');
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Close' }));
    expect(viewer()).toBeNull();
    expect(document.activeElement).toBe(tile);
  });

  it('wraps round, and keeps the nicotine photos and their statement together', () => {
    render(<WarehousePhotos />);
    fireEvent.click(tiles('Tobacco, vapes and nicotine pouches')[0]);
    expect(caption()).toBe(`${nicotine[0].alt}, photo 1 of 10`);
    expect(viewer().querySelector('.nicotine-warning').textContent).toBe(NICOTINE_WARNING_TEXT);
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Previous photo' }));
    expect(caption()).toBe(`${nicotine[9].alt}, photo 10 of 10`);
    expect(place()).toBe('10 of 10');
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Next photo' }));
    fireEvent.click(within(viewer()).getByRole('button', { name: 'Next photo' }));
    expect(caption()).toBe(`${nicotine[1].alt}, photo 2 of 10`);
    fireEvent.keyDown(viewer(), { key: 'Escape' });
    expect(viewer()).toBeNull();
  });
});
