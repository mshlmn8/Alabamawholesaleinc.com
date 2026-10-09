// The home page: one h1, in the split hero (AW-004); the planned section order
// with the services straight after the hero (AW-059); department tiles with a
// chosen photo and the biggest lines on a solid band (AW-060, AW-061); one
// row each of new arrivals and bestsellers without SKUs (AW-060); numbers only
// on the application steps (AW-216). Products without a photo stay off the
// rails (AW-029, Cursor PR #13). The hero photos come from Admin -> Homepage
// once loaded, the bundled ones until then (AW-119).
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPARTMENT_PHOTOS, HERO_SLIDES } from '../data/content.js';
import { PRODUCTS, NAV_ORDER, NEW_ARRIVALS_IDS } from '../data/products.js';
import { departmentsFor, topLines } from '../lib/departments.js';
import { resetHomeSlidesForTests } from '../lib/homeSlides.js';
import { heroImage } from '../lib/images.js';
import { showsNicotineWarning } from '../lib/regulated.js';
import { hrefFor } from '../lib/routes.js';
import { cardDetail } from '../components/ProductCard.jsx';
import { HomePage, RAIL_LENGTH, departmentPhoto, hasPhoto } from './HomePage.jsx';

// No backend: the bundled hero photos, and no request (the tests' .env.local
// may name a real project).
beforeEach(() => resetHomeSlidesForTests({ client: null }));
afterEach(() => {
  resetHomeSlidesForTests({ client: null });
  vi.restoreAllMocks();
});

const DEPARTMENTS = departmentsFor(PRODUCTS);
const renderHome = (props = {}) => {
  const products = props.products ?? PRODUCTS;
  return render(
    <HomePage products={products} departments={departmentsFor(products)} profile={null} isApprovedBuyer={false} cart={{}}
              addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} onApplyClick={() => {}} {...props} />,
  );
};
const byId = (id) => PRODUCTS.find((p) => p.id === id);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

// The lines waiting on the legal review (AW-001).
const REVIEW_LINES = ['Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills', 'Honey & Energy'];
// Everything the two rails can show, before they are cut to one row.
const RAIL_IDS = new Set([
  ...NEW_ARRIVALS_IDS,
  ...PRODUCTS.filter((p) => p.tag === 'BESTSELLER').map((p) => p.id),
]);

describe('HomePage rails', () => {
  it('tells a product with a photo from one without', () => {
    expect(hasPhoto({ picture: { src: '/a.jpg' } })).toBe(true);
    expect(hasPhoto({ img: '/a.jpg', picture: null })).toBe(true);
    expect(hasPhoto({ img: null, picture: null })).toBe(false);
    expect(hasPhoto(undefined)).toBe(false);
  });

  it('leaves photo-less products such as Dubai chocolate (#342) off New arrivals and Bestsellers', () => {
    // #342 is listed as a new arrival but has no photo yet.
    expect(NEW_ARRIVALS_IDS).toContain(342);
    expect(PRODUCTS.find((p) => p.id === 342).picture).toBeNull();
    renderHome();
    const names = (id) => [...document.querySelectorAll(`#${id} .content-card h3`)].map((h) => h.textContent);
    expect(names('new-arrivals')).not.toContain('Dubai chocolate');
    expect(names('new-arrivals').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('#new-arrivals .photo-soon, #bestsellers .photo-soon')).toHaveLength(0);
  });

  it('shows one row of four cards in each rail, without the SKU', () => {
    expect(RAIL_LENGTH).toBe(4);
    renderHome();
    for (const id of ['new-arrivals', 'bestsellers']) {
      const cards = document.querySelectorAll(`#${id} .content-card`);
      expect(cards, id).toHaveLength(4);
      for (const card of cards) {
        const product = PRODUCTS.find((p) => p.name === card.querySelector('h3').textContent);
        const detail = card.querySelector('.card-detail').textContent;
        expect(detail, product.name).not.toContain(product.sku);
        expect(detail).not.toMatch(/\bAW-[A-Z0-9]/);
        // Everything else on the line stays.
        expect(detail).toBe(cardDetail(product, { sku: false }));
      }
    }
    // The section links stay.
    expect(within(document.querySelector('#new-arrivals')).getByRole('link', { name: 'Shop novelties' })).toBeTruthy();
    expect(within(document.querySelector('#bestsellers')).getByRole('link', { name: 'Shop tobacco' })).toBeTruthy();
  });

  it('keeps the SKU on cards everywhere else', () => {
    const p = { brand: 'Swisher Sweets', sku: 'AW-SS', variants: [] };
    expect(cardDetail(p)).toBe('Swisher Sweets · AW-SS');
    expect(cardDetail(p, { sku: false })).toBe('Swisher Sweets');
  });
});

describe('HomePage sections', () => {
  it('opens with the split hero, holding the page\'s only h1', () => {
    renderHome();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).closest('.home-hero')).not.toBeNull();
    // Nothing in the page comes before the hero.
    expect(document.querySelector('.home-hero').previousElementSibling).toBeNull();
  });

  it('passes the signed-in state to the hero calls to action', () => {
    const hero = () => within(document.querySelector('.home-hero'));
    const { unmount } = renderHome();
    expect(hero().getByRole('button', { name: 'Apply for a trade account' })).toBeTruthy();
    unmount();
    renderHome({ signedIn: true });
    expect(hero().queryByRole('button', { name: 'Apply for a trade account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to my account' }).getAttribute('href')).toBe('/account');
  });

  it('runs hero, services, departments, new arrivals, bestsellers, collections, application', () => {
    renderHome();
    expect(document.querySelector('.home-hero').nextElementSibling.className).toBe('services');
    const h2s = [...document.querySelectorAll('h2')].map(text);
    const order = ['Services', 'Shop by department', 'New arrivals', 'Bestsellers', 'Disposables, detox,kratom & more.', 'Tobacco, wraps& accessories.', 'Open a trade account'];
    expect(h2s).toEqual(order);
    // The header, menu and footer link to these.
    const ids = [...document.querySelectorAll('section[id]')].map((s) => s.id);
    expect(ids).toEqual(['catalog', 'new-arrivals', 'bestsellers', 'apply']);
  });

  it('keeps the heading outline whole: h1, then h2, then h3', () => {
    renderHome();
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => {
      if (i) expect(level, `heading ${i}`).toBeLessThanOrEqual(levels[i - 1] + 1);
    });
  });

  it('numbers only the application steps', () => {
    renderHome();
    const labels = [...document.querySelectorAll('.eyebrow, .card-kicker')].map(text);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).not.toMatch(/ \/ \d{2}$/);
    expect(document.body.textContent).not.toMatch(/COLLECTION|DEPARTMENT/);
    expect([...document.querySelectorAll('.eyebrow')].map(text)).toEqual(expect.arrayContaining(['FRESH INVENTORY', 'PROVEN MOVERS', 'FULL ASSORTMENT', 'OPEN AN ACCOUNT']));
    expect(document.querySelectorAll('.apply-steps > li')).toHaveLength(3);
  });

  it('gives each service an icon, the claim as published and a link to its page', () => {
    renderHome();
    const services = [...document.querySelectorAll('.services .service')];
    expect(services).toHaveLength(3);
    expect(services.map((s) => s.querySelector('h3').textContent)).toEqual(['Next-day delivery, our own trucks', 'Net-30 trade terms', 'Licensed businesses only']);
    const links = services.map((s) => {
      const icon = s.querySelector('.service-icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg')).not.toBeNull();
      expect(icon.textContent).toBe('');
      const link = within(s).getByRole('link');
      return [link.textContent, link.getAttribute('href')];
    });
    expect(links).toEqual([['Delivery and service area', '/delivery'], ['Trade terms', '/terms'], ['How to apply', '/apply']]);
    // The section is named by a heading, not an aria-label.
    const section = document.querySelector('.services');
    expect(section.hasAttribute('aria-label')).toBe(false);
    expect(section.querySelector('h2.sr-only').textContent).toBe('Services');
  });
});

describe('HomePage collection cards', () => {
  it('keeps each heading a plain heading, with the call to action as the link (AW-170)', () => {
    renderHome();
    const cards = [...document.querySelectorAll('.editorials > .editorial-card')];
    expect(cards.map((c) => c.tagName)).toEqual(['DIV', 'DIV']);
    const links = cards.map((c) => {
      const all = c.querySelectorAll('a');
      expect(all).toHaveLength(1);
      expect(c.querySelector('h2').closest('a')).toBeNull();
      return [all[0].className, all[0].textContent, all[0].getAttribute('href')];
    });
    expect(links).toEqual([
      ['text-link', 'Browse novelties', hrefFor({ page: 'category', category: 'NOVELTIES' })],
      ['text-link', 'Browse tobacco', hrefFor({ page: 'category', category: 'TOBACCO' })],
    ]);
  });
});

describe('HomePage department tiles', () => {
  it('links each department, with its counts and biggest lines on the band, not the photo', () => {
    renderHome();
    const tiles = [...document.querySelectorAll('#catalog .dept-grid > .dept-tile')];
    expect(tiles).toHaveLength(DEPARTMENTS.length);
    expect(document.querySelectorAll('#catalog .card-grid, #catalog .card-tag')).toHaveLength(0);
    DEPARTMENTS.forEach((d, i) => {
      const tile = tiles[i];
      // The name in the heading is the link (stretched over the tile in CSS),
      // so the heading is a real heading and the link is named by it (AW-170).
      expect(tile.tagName).toBe('DIV');
      const links = tile.querySelectorAll('a');
      expect(links).toHaveLength(1);
      expect(links[0].className).toBe('dept-tile-link');
      expect(links[0].parentElement.matches('.dept-tile-body > h3')).toBe(true);
      expect(within(tile).getByRole('link', { name: d.label }).getAttribute('href')).toBe(hrefFor({ page: 'category', category: d.key }));
      expect(tile.querySelector('.dept-tile-body h3').textContent).toBe(d.label);
      expect(tile.querySelector('.dept-tile-count').textContent).toBe(`${d.count} products · ${d.subs.length} product lines`);
      expect(tile.querySelector('.dept-tile-lines').textContent).toBe(topLines(PRODUCTS, d.key).join(' · '));
      // Each part wraps as a unit, its separator dot with it.
      const lines = [...tile.querySelectorAll('.dept-tile-lines > span')].map((span) => span.textContent);
      expect(lines).toEqual(topLines(PRODUCTS, d.key).map((line, j, all) => (j < all.length - 1 ? `${line} · ` : line)));
      // Only the photo is in the frame.
      expect(tile.querySelector('.dept-tile-media').textContent).toBe('');
      const img = tile.querySelector('.dept-tile-media img');
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('src')).toBe(byId(DEPARTMENT_PHOTOS[d.key]).picture.src);
    });
    // Biggest lines first: Merchandise no longer leads with 'Adult Wellness'.
    expect(text(tiles[2].querySelector('.dept-tile-lines'))).toMatch(/^OTC & Health · /);
  });

  it('chose a photo for every department: a packshot from its bigger lines, off the rails, no nicotine and no line under review', () => {
    expect(Object.keys(DEPARTMENT_PHOTOS).sort()).toEqual([...NAV_ORDER].sort());
    for (const key of NAV_ORDER) {
      const p = byId(DEPARTMENT_PHOTOS[key]);
      expect(p, key).toBeTruthy();
      expect(p.cat, key).toBe(key);
      expect(p.picture?.src, key).toBeTruthy();
      expect(showsNicotineWarning(p), key).toBe(false);
      expect(RAIL_IDS.has(p.id), key).toBe(false);
      expect(REVIEW_LINES, key).not.toContain(p.sub);
      expect(topLines(PRODUCTS, key, 4), key).toContain(p.sub);
      expect(departmentPhoto(PRODUCTS, key), key).toBe(p);
    }
  });

  it('falls back to the first suitable photo in the department\'s biggest line that has one', () => {
    const firstSuitable = (products, key) => {
      for (const line of topLines(products, key, Infinity)) {
        const p = products.find((x) => x.cat === key && x.sub === line && hasPhoto(x) && !showsNicotineWarning(x));
        if (p) return p;
      }
      return null;
    };
    // The chosen product is missing from the live catalog. Without it, Cigars
    // & Cigarillos ties Wraps & Leafs as the biggest line, but holds only
    // nicotine products, so the photo comes from Wraps & Leafs: #319, hemp.
    const without = PRODUCTS.filter((p) => p.id !== DEPARTMENT_PHOTOS.TOBACCO);
    expect(topLines(without, 'TOBACCO', 2)).toEqual(['Cigars & Cigarillos', 'Wraps & Leafs']);
    const fallback = departmentPhoto(without, 'TOBACCO');
    expect(fallback).toBe(firstSuitable(without, 'TOBACCO'));
    expect(fallback.id).toBe(319);
    expect(showsNicotineWarning(fallback)).toBe(false);
    // ... or has no photo.
    const photoless = PRODUCTS.map((p) => (p.id === DEPARTMENT_PHOTOS.CANDIES ? { ...p, img: null, picture: null } : p));
    expect(departmentPhoto(photoless, 'CANDIES')).toBe(firstSuitable(photoless, 'CANDIES'));
    expect(departmentPhoto(photoless, 'CANDIES').sub).toBe('Sweets & Gummies');
    // A department only the live catalog has.
    const extra = [{ id: 9001, cat: 'SEASONAL', sub: 'Gifts', img: '/x.jpg', picture: { src: '/x.jpg' } }];
    expect(departmentPhoto(extra, 'SEASONAL')).toBe(extra[0]);
    // Nothing suitable: no photo rather than a nicotine product.
    expect(departmentPhoto([{ id: 1, cat: 'TOBACCO', sub: 'Cigarettes', name: 'Kite', img: '/k.jpg', picture: { src: '/k.jpg' } }], 'TOBACCO')).toBeNull();
    // The tile shows the fallback.
    renderHome({ products: without });
    const tile = document.querySelector('#catalog .dept-tile');
    expect(tile.querySelector('.dept-tile-media img').getAttribute('src')).toBe(fallback.picture.src);
  });

  it('leaves the frame empty when a department has no suitable photo', () => {
    const products = PRODUCTS.filter((p) => p.cat !== 'MOTOR OIL' || !hasPhoto(p));
    renderHome({ products });
    const tile = [...document.querySelectorAll('#catalog .dept-tile')].find((t) => t.querySelector('h3').textContent === 'Motor Oil');
    expect(tile.querySelector('.dept-tile-media').children).toHaveLength(0);
  });
});

// Admin -> Homepage's photos (AW-119), from a stand-in for the Supabase client.
describe('HomePage hero photos', () => {
  const STORAGE = 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-display.jpg';
  const slidesClient = (answer) => ({
    calls: 0,
    from() {
      this.calls += 1;
      const builder = {
        select: () => builder, eq: () => builder, order: () => builder, abortSignal: () => builder,
        then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject),
      };
      return builder;
    },
  });
  const renderLoaded = async (answer) => {
    const client = slidesClient(answer);
    resetHomeSlidesForTests({ client });
    renderHome();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    return client;
  };
  const slideLabels = () => [...document.querySelectorAll('.home-carousel-slide')].map((s) => s.getAttribute('aria-label'));

  it('shows the bundled photos first and with no backend', () => {
    renderHome();
    expect(slideLabels()).toEqual(['1 of 4: Candies', '2 of 4: Novelties & Vapes', '3 of 4: Merchandise', '4 of 4: Drinks & Bags']);
    expect(document.querySelector('.home-carousel-slide.is-active img').getAttribute('alt')).toBe(HERO_SLIDES[0].alt);
  });

  it('swaps in the photos staff keep, in their order, starting at slide 1, with the FDA warning on the flagged one', async () => {
    const client = await renderLoaded(() => ({
      data: [
        { id: 9, img: 'hero_vape.jpg', alt: 'Vape display', go_cat: 'NOVELTIES', nicotine_warning: true, sort: 5 },
        { id: 2, img: STORAGE, alt: 'Counter display of candy', go_cat: null, nicotine_warning: false, sort: 10 },
      ],
      error: null,
    }));
    expect(client.calls).toBe(1);
    expect(slideLabels()).toEqual(['1 of 2: Novelties & Vapes', '2 of 2: Counter display of candy']);
    const active = document.querySelector('.home-carousel-slide.is-active');
    expect(active.querySelector('img').getAttribute('src')).toBe(heroImage('hero_vape.jpg').picture.src);
    expect(within(active).getByRole('link', { name: 'Shop Novelties & Vapes' })).toBeTruthy();
    // The warning band shows for the vape photo.
    expect(document.querySelector('.home-carousel-warning').getAttribute('aria-hidden')).toBeNull();
    // A photo with no link is named by its alt text.
    expect(screen.getByRole('button', { name: 'Show slide 2: Counter display of candy' })).toBeTruthy();
  });

  it('shows the headline alone when every photo is turned off', async () => {
    await renderLoaded(() => ({ data: [], error: null }));
    expect(document.querySelector('.home-carousel')).toBeNull();
    expect(document.querySelector('.home-hero-media').children).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeTruthy();
  });

  it('keeps the bundled photos when the table is missing', async () => {
    await renderLoaded(() => ({ data: null, error: { code: 'PGRST205', message: 'Could not find the table public.home_slides' } }));
    expect(slideLabels()).toHaveLength(HERO_SLIDES.length);
    expect(document.querySelector('.home-carousel-slide.is-active img').getAttribute('alt')).toBe(HERO_SLIDES[0].alt);
  });
});
