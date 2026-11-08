// The home page: one h1, in the split hero (AW-004); the planned section order
// with the trust band (AW-005) and the services straight after the hero
// (AW-059); no Net-30 or volume discounts, and the volume-pricing line in
// their place (AW-025); no approval time (AW-246); department tiles with a
// chosen photo and the biggest lines on a solid band (AW-060, AW-061); one
// row each of new arrivals and bestsellers without SKUs (AW-060); numbers only
// on the application steps (AW-216). Products without a photo stay off the
// rails (AW-029, Cursor PR #13). The hero carousel shows new products.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANY, DEPARTMENT_GROUPS, SOURCING, VOLUME_PRICING } from '../data/content.js';
import { PRODUCTS, NAV_ORDER, NEW_ARRIVALS_IDS } from '../data/products.js';
import { departmentsFor, topLines } from '../lib/departments.js';
import { hrefFor } from '../lib/routes.js';
import { cardDetail } from '../components/ProductCard.jsx';
import { HomePage, RAIL_LENGTH, departmentPhotos, hasPhoto, newProductSlides } from './HomePage.jsx';

afterEach(() => {
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
    expect(document.querySelectorAll('#new-arrivals .photo-soon, #new-deals .photo-soon, #bestsellers .photo-soon')).toHaveLength(0);
  });

  it('shows one row of four cards at most in each rail, without the SKU', () => {
    expect(RAIL_LENGTH).toBe(4);
    renderHome();
    // Three products are tagged NEW with a photo since #75 Wava kava, the
    // fourth card, was delisted (AW-001); staff tag more in Admin -> Products.
    for (const [id, count] of [['new-arrivals', 3], ['new-deals', 3], ['bestsellers', 4]]) {
      const cards = document.querySelectorAll(`#${id} .content-card`);
      expect(cards, id).toHaveLength(count);
      for (const card of cards) {
        const product = PRODUCTS.find((p) => p.name === card.querySelector('h3').textContent);
        const detail = card.querySelector('.card-detail').textContent;
        expect(detail, product.name).not.toContain(product.sku);
        expect(detail).not.toMatch(/\bAW-[A-Z0-9]/);
        // Everything else on the line stays.
        expect(detail).toBe(cardDetail(product, { sku: false }));
      }
    }
  });

  it('links each rail to All products, which spans every department, not to one department (AW-056)', () => {
    renderHome();
    for (const id of ['new-arrivals', 'new-deals', 'bestsellers']) {
      const head = document.querySelector(`#${id} .section-head`);
      const links = within(head).getAllByRole('link');
      expect(links.map((a) => [a.textContent, a.getAttribute('href')]), id).toEqual([['Browse all products', '/catalog']]);
    }
    expect(screen.queryByRole('link', { name: 'Shop novelties' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Shop tobacco' })).toBeNull();
  });

  it('keeps the SKU on cards everywhere else', () => {
    const p = { brand: 'Swisher Sweets', sku: 'AW-SS', variants: [] };
    expect(cardDetail(p)).toBe('Swisher Sweets\u00a0· AW-SS');
    expect(cardDetail(p, { sku: false })).toBe('Swisher Sweets');
  });
});

describe('HomePage sections', () => {
  it('opens with the new-product carousel and the page\'s only h1, with no headline box', () => {
    renderHome();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('h1').closest('.home-hero')).not.toBeNull();
    expect(document.querySelector('h1').className).toBe('sr-only');
    expect(document.querySelector('.home-hero').previousElementSibling).toBeNull();
    expect(document.querySelector('.home-hero-copy')).toBeNull();
    expect(document.querySelector('.home-carousel').getAttribute('aria-label')).toBe('New products');
  });

  it('runs hero, trust band, departments, new arrivals, new deals, bestsellers, collections, application, then services', () => {
    renderHome();
    expect(document.querySelector('.home-hero').nextElementSibling.className).toBe('trust-band');
    expect(document.querySelector('.trust-band').nextElementSibling.className).not.toBe('services');
    const h2s = [...document.querySelectorAll('h2')].map(text);
    const order = ['About Alabama Wholesale', 'Shop by department', 'New arrivals', 'New deals', 'Bestsellers', 'Disposables, detox,hookah & more.', 'Tobacco, wraps& accessories.', 'Open a trade account', 'Services'];
    expect(h2s).toEqual(order);
    expect(document.querySelector('.services').nextElementSibling).toBeNull();
    expect(document.getElementById('new-deals').previousElementSibling.id).toBe('new-arrivals');
    for (const id of ['new-arrivals', 'new-deals', 'bestsellers']) {
      expect(document.querySelector(`#${id} .card-rail`).classList.contains('card-grid')).toBe(true);
    }
    // The header, menu and footer link to these.
    const ids = [...document.querySelectorAll('section[id]')].map((s) => s.id);
    expect(ids).toEqual(['catalog', 'new-arrivals', 'new-deals', 'bestsellers', 'apply']);
  });

  it('names no kratom, kava or mushroom product anywhere on the page (AW-001)', () => {
    renderHome();
    expect(document.body.textContent).not.toMatch(/kratom|kava|mushroom|shroom/i);
    expect([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /kratom|mushroom/.test(h))).toEqual([]);
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

  it('gives each service an icon, the claim and a link to its page, or the trade desk\'s email and phone for volume pricing', () => {
    renderHome();
    const services = [...document.querySelectorAll('.services .service')];
    expect(services).toHaveLength(3);
    expect(services.map((s) => s.querySelector('h3').textContent)).toEqual(['Next-day delivery, our own trucks', 'Buying in volume?', 'Licensed businesses only']);
    const links = services.map((s) => {
      const icon = s.querySelector('.service-icon');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
      expect(icon.querySelector('svg')).not.toBeNull();
      expect(icon.textContent).toBe('');
      return within(s).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);
    });
    expect(links).toEqual([
      [['Delivery and service area', '/delivery']],
      [['email us', `mailto:${COMPANY.email}`], [COMPANY.phone, `tel:${COMPANY.phoneRaw}`]],
      [['How to apply', '/apply']],
    ]);
    // AW-025: the volume-pricing line, word for word, and no Net-30 or discount.
    expect(services[1].querySelector('p').textContent).toBe(VOLUME_PRICING);
    expect(document.querySelector('.services').textContent).not.toMatch(/net[- ]?30|discount|\d+ ?%/i);
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
  it('links each department, with its biggest lines on the band, not the photo', () => {
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
      // A no-break space holds each dot to the last word before it, so a
      // narrow tile never starts a line with a lone dot (NEW-082).
      expect(tile.querySelector('.dept-tile-count')).toBeNull();
      expect(tile.textContent).not.toMatch(/\d+ products|\d+ product lines/);
      expect(tile.querySelector('.dept-tile-lines').textContent).toBe(topLines(PRODUCTS, d.key).join('\u00a0· '));
      // Each part wraps as a unit, its separator dot with it.
      const lines = [...tile.querySelectorAll('.dept-tile-lines > span')].map((span) => span.textContent);
      expect(lines).toEqual(topLines(PRODUCTS, d.key).map((line, j, all) => (j < all.length - 1 ? `${line}\u00a0· ` : line)));
      // The frame is the group's packshots, and nothing else.
      expect(tile.querySelector('.dept-tile-media').textContent).toBe('');
      const imgs = [...tile.querySelectorAll('.dept-tile-media img')];
      expect(imgs.map((img) => img.getAttribute('src'))).toEqual(DEPARTMENT_GROUPS[d.key].map((id) => byId(id).picture.src));
      expect(imgs.every((img) => img.getAttribute('alt') === '')).toBe(true);
      expect(tile.querySelector('.dept-tile-media').classList.contains('is-4')).toBe(true);
    });
    // Biggest lines first: Merchandise no longer leads with 'Adult Wellness'.
    expect(text(tiles[2].querySelector('.dept-tile-lines'))).toMatch(/^OTC & Health · /);
  });

  it('groups four photographed products for every department, Swisher, Seneca and Black & Mild among tobacco', () => {
    expect(Object.keys(DEPARTMENT_GROUPS).sort()).toEqual([...NAV_ORDER].sort());
    for (const key of NAV_ORDER) {
      const group = departmentPhotos(PRODUCTS, key);
      expect(group.map((p) => p.id), key).toEqual(DEPARTMENT_GROUPS[key]);
      expect(group.every((p) => p.cat === key && p.picture?.src), key).toBe(true);
    }
    expect(departmentPhotos(PRODUCTS, 'TOBACCO').map((p) => p.name)).toEqual([
      'Swisher Sweets cigarillos', 'Seneca cigarettes', 'Black & Mild cigars 25-count', 'Backwoods cigars 5-pack',
    ]);
  });

  it('skips a group product that is missing or has no photo, then fills from the department', () => {
    const withoutSwisher = PRODUCTS.filter((p) => p.id !== 1);
    const tobacco = departmentPhotos(withoutSwisher, 'TOBACCO');
    expect(tobacco.map((p) => p.id).slice(0, 3)).toEqual([86, 17, 11]);
    expect(tobacco).toHaveLength(4);
    expect(tobacco[3].cat).toBe('TOBACCO');
    expect(tobacco[3].id).not.toBe(1);
    const photoless = PRODUCTS.map((p) => (p.id === 163 ? { ...p, img: null, picture: null } : p));
    const candies = departmentPhotos(photoless, 'CANDIES');
    expect(candies.map((p) => p.id).slice(0, 3)).toEqual([171, 162, 37]);
    expect(candies).toHaveLength(4);
    expect(candies.every((p) => hasPhoto(p))).toBe(true);
    // A department only the live catalog has.
    const extra = [{ id: 9001, cat: 'SEASONAL', sub: 'Gifts', img: '/x.jpg', picture: { src: '/x.jpg' } }];
    expect(departmentPhotos(extra, 'SEASONAL')).toEqual(extra);
    // One photographed product is the whole group.
    const kite = { id: 14, cat: 'TOBACCO', sub: 'Cigarettes', name: 'Kite', img: '/k.jpg', picture: { src: '/k.jpg' } };
    expect(departmentPhotos([kite], 'TOBACCO')).toEqual([kite]);
    renderHome({ products: [kite, ...PRODUCTS.filter((p) => p.cat !== 'TOBACCO')] });
    const tile = document.querySelector('#catalog .dept-tile');
    expect(tile.querySelector('.dept-tile-media').classList.contains('is-1')).toBe(true);
    expect(tile.querySelector('.dept-tile-media img').getAttribute('src')).toBe('/k.jpg');
  });

  it('leaves the frame empty when a department has no suitable photo', () => {
    const products = PRODUCTS.filter((p) => p.cat !== 'MOTOR OIL' || !hasPhoto(p));
    renderHome({ products });
    const tile = [...document.querySelectorAll('#catalog .dept-tile')].find((t) => t.querySelector('h3').textContent === 'Motor Oil');
    expect(tile.querySelector('.dept-tile-media').children).toHaveLength(0);
  });
});

describe('HomePage new-product carousel', () => {
  const labels = () => [...document.querySelectorAll('.home-carousel-slide')].map((s) => s.getAttribute('aria-label'));

  it('shows new products with a photo, each opening its page, and no warehouse photo', () => {
    renderHome();
    const slides = newProductSlides(PRODUCTS);
    expect(slides.map((s) => s.alt)).toEqual(['Foger Switch Pro full kit', 'RAZ 25K', 'Tueni chews']);
    expect(labels()).toEqual(['1 of 3: Foger Switch Pro full kit', '2 of 3: RAZ 25K', '3 of 3: Tueni chews']);
    const active = document.querySelector('.home-carousel-slide.is-active');
    expect(active.querySelector('img').getAttribute('alt')).toBe('Foger Switch Pro full kit');
    expect(within(active).getByRole('link', { name: 'Foger Switch Pro full kit' }).getAttribute('href')).toBe('/product/62');
    expect(slides.map((s) => s.nicotineWarning)).toEqual([true, true, false]);
    expect(document.querySelector('.home-carousel-warning').getAttribute('aria-hidden')).toBeNull();
    expect(document.body.textContent).not.toMatch(/loading doors|Graymont|pallet racks/);
  });

  it('leaves the carousel empty when nothing new has a photo', () => {
    renderHome({ products: PRODUCTS.filter((p) => p.tag !== 'NEW') });
    expect(newProductSlides(PRODUCTS.filter((p) => p.tag !== 'NEW'))).toEqual([]);
    expect(document.querySelector('section.home-carousel')).toBeNull();
    expect(document.querySelector('.home-carousel.is-empty')).toBeTruthy();
  });
});

// AW-005 (owner answers 2026-10): the confirmed facts, in a band under the
// hero, and nothing the owner ruled out.
describe('HomePage trust band (AW-005)', () => {
  it('names 20 years in business, 100% authentic products and where every product comes from', () => {
    renderHome();
    const band = document.querySelector('.trust-band');
    expect(band.getAttribute('aria-labelledby')).toBe('trust-band-title');
    expect(document.getElementById('trust-band-title').textContent).toBe('About Alabama Wholesale');
    expect([...band.querySelectorAll('.trust-fact')].map(text)).toEqual(['20 years in business', '100% authentic products']);
    expect(band.querySelector('.trust-sourcing').textContent).toBe(SOURCING);
  });

  it('claims no account count, no generations and never "direct from the manufacturer" anywhere on the page', () => {
    renderHome();
    const page = document.body.textContent;
    expect(page).not.toMatch(/three generations|family[- ]owned|direct(ly)? from (the )?manufacturer|accounts served|stores served/i);
  });

  it('promises no approval time in the application steps (AW-246)', () => {
    renderHome();
    const steps = [...document.querySelectorAll('.apply-steps > li > p')].map(text);
    expect(steps[1]).toBe('Our team checks your license with the state before approving your account. Wholesale pricing and ordering unlock when you sign in.');
    expect(document.body.textContent).not.toMatch(/business day|approved within|within 24 hours/i);
  });
});
