// The product page takes the quantity saved from an older cart (AW-354),
// shows the signed-in buyer's price from priceOf (AW-003, AW-030), and labels
// variants by their axis (AW-233, AW-128). Products carry no prices; the
// amounts are test values.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { dismissToast, getToast } from '../lib/toast.js';
import { CHECKING_AVAILABILITY_TEXT, ProductPage } from './ProductPage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const P = [{ id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] }];
const page = (props) => <ProductPage productId={1} products={P} cart={{}} addLine={vi.fn()} decLine={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />;
const qty = () => screen.getByRole('group', { name: 'Quantity to add' }).querySelector('input').value;

const pd = () => document.querySelector('.pd-price').textContent;
const sku = () => document.querySelector('.pd-sku').textContent;
const APPROVED = { id: 'a', status: 'approved' };

describe('ProductPage prices', () => {
  it('shows "From" the lowest variant price, then the chosen variant’s own price (AW-030)', () => {
    const priceOf = (id, variant) => (variant === 'Red' ? 13.5 : 12.25);
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf, pricesStatus: 'ready' }));
    // The SKU is the .pd-sku line, for everyone (AW-234), not in the price block.
    expect(pd()).toBe('From $12.25Wholesale unit price');
    expect(sku()).toBe('SKU AW-SS');
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect(pd()).toBe('$13.50Wholesale unit price');
    expect(sku()).toBe('SKU AW-SS-RED');
    fireEvent.click(screen.getByRole('radio', { name: 'Diamond' }));
    expect(pd()).toBe('$12.25Wholesale unit price');
    expect(sku()).toBe('SKU AW-SS-DIAMOND');
  });

  it('shows one price when every variant costs the same', () => {
    render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => 12.25, pricesStatus: 'ready' }));
    expect(pd()).toBe('$12.25Wholesale unit price');
  });

  it('says "Price on request" for a product without a price, and "Loading price…" while prices load', () => {
    const view = render(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => null, pricesStatus: 'ready' }));
    expect(pd()).toBe('Price on requestWholesale unit price');
    view.rerender(page({ profile: APPROVED, isApprovedBuyer: true, priceOf: () => null, pricesStatus: 'loading' }));
    expect(pd()).toBe('Loading price…Wholesale unit price');
  });

  it('shows no price to guests and accounts awaiting approval, whatever priceOf says', () => {
    const priceOf = () => 12.25;
    const view = render(page({ priceOf }));
    expect(pd()).toBe('Wholesale prices show here for approved trade accounts.Sign in to see wholesale pricesApply for a trade account');
    view.rerender(page({ profile: { id: 'p', status: 'pending' }, priceOf }));
    expect(pd()).toBe('Pricing unlocks after your account is approved.View approval status');
  });

  it('tells an account on hold ordering is paused, with the trade desk’s number and its account status (AW-101)', () => {
    const view = render(page({ profile: { id: 's', status: 'suspended' }, priceOf: () => 12.25 }));
    // A sentence in the price slot and the one way forward, the trade desk (AW-133).
    expect(pd()).toMatch(/^Ordering is paused on this account\. Call .+ or email .+ and a trade rep will help you sort it out\.$/);
    expect(document.querySelector('.pd-price a[href^="tel:"]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'View approval status' })).toBeNull();
    // An applicant under review keeps its own wording, and no call link.
    view.rerender(page({ profile: { id: 'p', status: 'pending' } }));
    expect(screen.getByRole('link', { name: 'View approval status' })).toBeTruthy();
    expect(document.querySelector('.pd-price a[href^="tel:"]')).toBeNull();
  });
});

describe('ProductPage variants (AW-233, AW-128, AW-030)', () => {
  const product = (extra) => ({ ...P[0], ...extra });
  const note = (text) => screen.queryByText(text);
  const FLAVOR_NOTE = 'Flavors and availability change often. The trade desk confirms what is in stock.';

  it('names the choice by the product’s axis, and shows the flavor note only for flavors', () => {
    const view = render(page({ products: [product({ variantAxis: 'Flavor' })] }));
    expect(screen.getByRole('radiogroup', { name: 'Choose a flavor' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeTruthy();
    expect(note('Add each flavor you want separately.')).toBeTruthy();
    expect(note(/Choose one variant/)).toBeNull();
    view.rerender(page({ products: [product({ variantAxis: 'Size' })] }));
    expect(screen.getByRole('radiogroup', { name: 'Choose a size' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
    expect(note('Add each size you want separately.')).toBeTruthy();
    view.rerender(page({ products: [product({ variantAxis: undefined })] }));
    expect(screen.getByRole('radiogroup', { name: 'Choose a variant' })).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
  });

  it('shows no chips for a single variant, and its label as text when the name doesn’t say it', () => {
    const view = render(page({ products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'] })] }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(document.querySelector('.variant-chips')).toBeNull();
    expect(screen.getByText('Variety: Green')).toBeTruthy();
    expect(note(FLAVOR_NOTE)).toBeNull();
    expect(note(/Add each/)).toBeNull();
    view.rerender(page({ products: [product({ name: 'RAW tips', variants: ['Tips'] })] }));
    expect(screen.queryByText(/Variety:/)).toBeNull();
    expect(document.querySelector('.variant-chips')).toBeNull();
    view.rerender(page({ products: [product({ variants: [] })] }));
    expect(document.querySelector('.variant-chips')).toBeNull();
    expect(screen.queryByText(/Variety:/)).toBeNull();
  });

  it('adds a single-variant product with its variant, without a choice', () => {
    const addLine = vi.fn();
    render(page({ addLine, products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'] })] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Green', 1);
  });

  it('disables a variant marked not available, says so, and leaves it out of the "From" price', () => {
    const addLine = vi.fn();
    const priceOf = (id, variant) => (variant === 'Red' ? 9.5 : 12.25);
    render(page({
      addLine, profile: APPROVED, isApprovedBuyer: true, priceOf, pricesStatus: 'ready',
      products: [product({ variantAxis: 'Flavor', unavailableVariants: ['Red'] })],
    }));
    const red = screen.getByRole('radio', { name: 'Red (not available)' });
    expect(red.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'Diamond' }).disabled).toBe(false);
    expect(pd()).toBe('$12.25Wholesale unit price');
    expect(sku()).toBe('SKU AW-SS');
    fireEvent.click(red);
    expect(red.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }));
    expect(addLine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Diamond' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Diamond', 1);
  });

  it('says so, and adds nothing, when a single variant is marked not available', () => {
    const addLine = vi.fn();
    render(page({ addLine, products: [product({ name: 'Garcia y Vega cigars', variants: ['Green'], unavailableVariants: ['Green'] })] }));
    expect(screen.getByText('Variety: Green (not available)')).toBeTruthy();
    const add = screen.getByRole('button', { name: /Add to quote/ });
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(addLine).not.toHaveBeenCalled();
  });

  it('shows the SKU to every visitor, and the chosen variant’s once there is one (AW-234)', () => {
    const sku = () => document.querySelector('.pd-sku').textContent;
    const view = render(page({}));
    expect(sku()).toBe('SKU AW-SS');
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect(sku()).toBe('SKU AW-SS-RED');
    // The fine print no longer starts with it; the rest of the sentence is unchanged.
    expect(document.querySelector('.pd-fine').textContent).toMatch(/^Supplied to licensed retail businesses for lawful resale\. /);
    view.rerender(page({ profile: { id: 'p', status: 'pending' } }));
    expect(sku()).toBe('SKU AW-SS-RED');
    view.rerender(page({ products: [product({ name: 'Garcia y Vega cigars', sku: 'AW-GARCIA-VEGA', variants: ['Green'] })] }));
    expect(sku()).toBe('SKU AW-GARCIA-VEGA-GREEN');
  });

  it('says what quantity 1 means when the product has a sell unit (AW-031)', () => {
    const view = render(page({ products: [product({ sellUnit: 'box of 200' })] }));
    expect(screen.getByText('Sold by the box of 200 — quantity 1 is one box of 200.')).toBeTruthy();
    view.rerender(page({ products: [product({ sellUnit: '' })] }));
    expect(document.querySelector('.pd-unit')).toBeNull();
  });
});

// The chips are one required choice (AW-235), and adding before a choice says
// so instead of a disabled button (AW-074).
describe('ProductPage variant choice (AW-235, AW-074)', () => {
  const FLAVORS = [{ ...P[0], variantAxis: 'Flavor', variants: ['Diamond', 'Red', 'Grape', 'Wine'], unavailableVariants: ['Diamond'] }];
  const radio = (name) => screen.getByRole('radio', { name });
  const tabStops = () => screen.getAllByRole('radio').filter((r) => r.tabIndex === 0).map((r) => r.textContent);
  const press = (key) => fireEvent.keyDown(document.activeElement, { key });

  it('is a required radiogroup named by the visible label, with one radio in the tab order', () => {
    render(page({ products: FLAVORS }));
    const group = screen.getByRole('radiogroup', { name: 'Choose a flavor' });
    expect(group.getAttribute('aria-labelledby')).toBe('pd-variant-label');
    expect(document.getElementById('pd-variant-label').textContent).toBe('Choose a flavor');
    expect(group.getAttribute('aria-required')).toBe('true');
    expect(group.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getAllByRole('radio').map((r) => [r.textContent, r.getAttribute('aria-checked'), r.disabled]))
      .toEqual([['Diamond (not available)', 'false', true], ['Red', 'false', false], ['Grape', 'false', false], ['Wine', 'false', false]]);
    // Before a choice the first variant that can be chosen takes Tab, then the chosen one.
    expect(tabStops()).toEqual(['Red']);
    fireEvent.click(radio('Grape'));
    expect(radio('Grape').getAttribute('aria-checked')).toBe('true');
    expect(radio('Red').getAttribute('aria-checked')).toBe('false');
    expect(tabStops()).toEqual(['Grape']);
  });

  it('moves and chooses with the arrow keys, Home and End, past a variant that is not available', () => {
    render(page({ products: FLAVORS }));
    radio('Red').focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(radio('Grape'));
    expect(radio('Grape').getAttribute('aria-checked')).toBe('true');
    press('ArrowDown');
    expect(document.activeElement).toBe(radio('Wine'));
    // Round the end, past "Diamond (not available)".
    press('ArrowRight');
    expect(document.activeElement).toBe(radio('Red'));
    press('ArrowLeft');
    expect(document.activeElement).toBe(radio('Wine'));
    press('ArrowUp');
    expect(document.activeElement).toBe(radio('Grape'));
    press('Home');
    expect(document.activeElement).toBe(radio('Red'));
    expect(radio('Red').getAttribute('aria-checked')).toBe('true');
    press('End');
    expect(document.activeElement).toBe(radio('Wine'));
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent)).toEqual(['Wine']);
    expect(tabStops()).toEqual(['Wine']);
  });

  it('keeps the add button enabled; adding before a choice says so under the chips and focuses the first variant', () => {
    const addLine = vi.fn();
    render(page({ addLine, products: FLAVORS }));
    const add = screen.getByRole('button', { name: /Add to quote/ });
    expect(add.disabled).toBe(false);
    add.focus();
    fireEvent.click(add);
    expect(addLine).not.toHaveBeenCalled();
    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Select a flavor before adding this product.');
    expect(error.id).toBe('pd-variant-error');
    expect(error.previousElementSibling.getAttribute('role')).toBe('radiogroup');
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(group.getAttribute('aria-describedby')).toBe('pd-variant-error');
    expect(document.activeElement).toBe(radio('Red'));
    // Choosing clears the error.
    press('ArrowRight');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(group.getAttribute('aria-invalid')).toBeNull();
    expect(group.getAttribute('aria-describedby')).toBeNull();
    fireEvent.click(add);
    expect(addLine).toHaveBeenCalledWith(1, 'Grape', 1);
  });

  it('disables the add button only when no variant can be chosen', () => {
    render(page({ products: [{ ...FLAVORS[0], unavailableVariants: ['Diamond', 'Red', 'Grape', 'Wine'] }] }));
    expect(screen.getByRole('button', { name: /Add to quote/ }).disabled).toBe(true);
    expect(tabStops()).toEqual([]);
  });
});

// The trail names the line (AW-230), and the row underneath varies and fills
// a small line from its department (AW-231, src/lib/related.js).
describe('ProductPage trail and related row (AW-230, AW-231)', () => {
  const cigar = (id, extra = {}) => ({ id, sku: `AW-C${id}`, name: `Cigar ${id}`, brand: `Brand ${id}`, cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: [], img: `/img/c${id}.jpg`, ...extra });
  const LINE = [cigar(1, { name: 'Swisher Sweets cigarillos' }), cigar(2), cigar(3), cigar(4), cigar(5), cigar(6)];
  const crumbs = () => [...document.querySelectorAll('nav.crumbs li')].map((li) => {
    const a = li.querySelector('a');
    return a ? `${a.textContent} -> ${a.getAttribute('href')}` : li.textContent;
  });

  it('leads back through All products, the department and the product line', () => {
    render(page({ products: LINE }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(crumbs()).toEqual(['Home -> /', 'All products -> /catalog', 'Tobacco -> /category/tobacco',
      'Cigars & Cigarillos -> /category/tobacco/cigars-and-cigarillos', 'Swisher Sweets cigarillos']);
    expect(document.querySelector('nav.crumbs [aria-current="page"]').textContent).toBe('Swisher Sweets cigarillos');
  });

  it('heads a row from the line "More <line>", with "View all" leading to the line', () => {
    render(page({ products: LINE }));
    const row = screen.getByRole('heading', { level: 2, name: 'More Cigars & Cigarillos' }).closest('section');
    expect(row.querySelector('.eyebrow').textContent).toBe('SAME LINE');
    expect(row.querySelectorAll('.content-card')).toHaveLength(4);
    const all = screen.getByRole('link', { name: 'View all Cigars & Cigarillos' });
    expect(all.getAttribute('href')).toBe('/category/tobacco/cigars-and-cigarillos');
    // Only "View all" shows; the line's name is for screen readers.
    expect(all.firstChild.textContent.trim()).toBe('View all');
    expect(all.querySelector('.sr-only').textContent).toBe('Cigars & Cigarillos');
  });

  it('fills a small line from the department, headed by the department', () => {
    const products = [cigar(1, { name: 'Swisher Sweets cigarillos' }), cigar(2), cigar(10, { sub: 'Wraps & Leafs' }), cigar(11, { sub: 'Wraps & Leafs' }), cigar(12, { sub: 'Cigarettes' })];
    render(page({ products }));
    const row = screen.getByRole('heading', { level: 2, name: 'More from Tobacco' }).closest('section');
    expect(row.querySelector('.eyebrow').textContent).toBe('RELATED');
    expect(row.querySelectorAll('.content-card')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'View all Tobacco' }).getAttribute('href')).toBe('/category/tobacco');
  });

  it('has no row when the department has nothing else', () => {
    render(page({ products: [cigar(1)] }));
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

// A photo other rows share (AW-136).
describe('ProductPage shared photos (AW-136)', () => {
  const PICTURE = { src: '/img/x--640x582.jpg', srcSet: '', webpSrcSet: '', width: 640, height: 582 };
  const row = (extra) => [{ ...P[0], id: 7, variants: [], picture: PICTURE, sharedPhoto: true, sellUnit: '', ...extra }];
  const shared = (extra) => page({ productId: 7, products: row(extra) });
  const badge = () => document.querySelector('.pd-media .pack-badge')?.textContent ?? null;
  const caption = () => document.querySelector('figure.pd-figure > figcaption')?.textContent ?? null;

  it('badges the photo with the sell unit, else the size word in the name', () => {
    const view = render(shared({ name: 'Backwoods cigars singles', sellUnit: 'single' }));
    expect(badge()).toBe('single');
    expect(caption()).toBeNull();
    view.rerender(shared({ name: 'Gatorade (big)' }));
    expect(badge()).toBe('big');
    expect(caption()).toBeNull();
  });

  it('says the photo shows a related pack or size when there is neither, under the photo and in the enlarged view', () => {
    render(shared({ name: "Uncle Al's" }));
    expect(badge()).toBeNull();
    expect(caption()).toBe('Photo shows a related pack or size.');
    expect(document.querySelector('figure.pd-figure > figcaption.photo-credit .photo-note')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "Enlarge photo of Uncle Al's" }));
    const dialog = screen.getByRole('dialog', { name: "Photo of Uncle Al's" });
    expect(dialog.querySelector('.photo-credit').textContent).toBe('Photo shows a related pack or size.');
    expect(dialog.querySelector('img').getAttribute('alt')).toBe("Uncle Al's (representative photo)");
  });

  it('calls a shared photo representative, and leaves a photo of its own alone', () => {
    const view = render(shared({ name: 'Gatorade (big)' }));
    expect(document.querySelector('.pd-media img').getAttribute('alt')).toBe('Gatorade (big) (representative photo)');
    view.rerender(shared({ name: 'Gatorade (big)', sharedPhoto: false }));
    expect(document.querySelector('.pd-media img').getAttribute('alt')).toBe('Gatorade (big)');
    expect(badge()).toBeNull();
    expect(caption()).toBeNull();
    // No photo: "Photo coming soon", with no badge or note.
    view.rerender(shared({ name: "Uncle Al's", picture: null }));
    expect(document.querySelector('.pd-media .photo-soon')).not.toBeNull();
    expect(badge()).toBeNull();
    expect(caption()).toBeNull();
  });
});

// The photo opens larger in a dialog (AW-236).
describe('ProductPage photo zoom (AW-236)', () => {
  const PICTURE = {
    src: '/img/dice--640x582.jpg', srcSet: '/img/dice--320x291.jpg 320w, /img/dice--640x582.jpg 640w',
    webpSrcSet: '/img/dice--320x291.webp 320w, /img/dice--640x582.webp 640w, /img/dice--1024x931.webp 1024w', width: 1024, height: 931,
  };
  // #149 is one of the photos with a Wikimedia credit.
  const DICE = [{ id: 149, sku: 'AW-DICE', name: 'Rolling dice', brand: 'Assorted', cat: 'MERCHANDISE', sub: 'Counter Goods', variants: [], img: '/img/dice--thumb.jpg', picture: PICTURE }];
  const zoomPage = (props) => page({ productId: 149, products: DICE, ...props });

  it('makes the photo a button that opens it in a dialog at its largest rendition, with its credit', () => {
    render(zoomPage({}));
    const zoom = screen.getByRole('button', { name: 'Enlarge photo of Rolling dice' });
    expect(zoom.closest('.pd-media')).toBeTruthy();
    zoom.focus();
    fireEvent.click(zoom);
    const dialog = screen.getByRole('dialog', { name: 'Photo of Rolling dice' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    // The close button comes first, so it takes focus (in a browser: jsdom has no layout).
    expect(dialog.querySelector('button').getAttribute('aria-label')).toBe('Close');
    const img = dialog.querySelector('img');
    expect(img.getAttribute('alt')).toBe('Rolling dice');
    expect(img.getAttribute('width')).toBe('1024');
    expect(dialog.querySelector('source').getAttribute('sizes')).toBe('1024px');
    expect(dialog.querySelector('.photo-credit').textContent).toBe('Photo: Dietmar Rabich, CC BY-SA 4.0 (opens in a new tab), resized. Wikimedia Commons (opens in a new tab)');
  });

  it('credits the photo under it: the author, the licence linked to its deed, "resized", and the file page (AW-033)', () => {
    render(zoomPage({}));
    const caption = document.querySelector('figure.pd-figure > figcaption.photo-credit');
    expect(caption.textContent).toBe('Photo: Dietmar Rabich, CC BY-SA 4.0 (opens in a new tab), resized. Wikimedia Commons (opens in a new tab)');
    const licence = screen.getByRole('link', { name: /^CC BY-SA 4\.0\s*\(opens in a new tab\)$/ });
    expect(licence.getAttribute('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    const file = screen.getByRole('link', { name: /^Wikimedia Commons\s*\(opens in a new tab\)$/ });
    expect(file.getAttribute('href')).toBe('https://commons.wikimedia.org/wiki/File:W%C3%BCrfel_--_2021_--_4266.jpg');
    for (const link of [licence, file]) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.querySelector('svg')).not.toBeNull();
    }
    // Its own photo: no "(representative photo)" and no note.
    expect(document.querySelector('.pd-media img').getAttribute('alt')).toBe('Rolling dice');
    expect(caption.querySelector('.photo-note')).toBeNull();
  });

  it('closes with Escape, the close button and the backdrop, and gives focus back to the photo', () => {
    render(zoomPage({}));
    const zoom = screen.getByRole('button', { name: 'Enlarge photo of Rolling dice' });
    fireEvent.click(zoom);
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(zoom);
    fireEvent.click(zoom);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(zoom);
    fireEvent.click(zoom);
    fireEvent.click(document.querySelector('.overlay'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(zoom);
    // A click inside the dialog doesn't close it.
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('has no button without a photo', () => {
    render(page({}));
    expect(screen.queryByRole('button', { name: /Enlarge photo/ })).toBeNull();
  });
});

describe('ProductPage and a saved quantity', () => {
  it('fills in the saved quantity, then what is left of it after an add', () => {
    const addLine = vi.fn();
    const view = render(page({ savedQty: 3, addLine }));
    expect(qty()).toBe('3');
    expect(screen.getByText('From your last visit: quantity 3. Choose a variant, then add it.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Red', 2);
    view.rerender(page({ savedQty: 1, addLine }));
    expect(qty()).toBe('1');
    view.rerender(page({ savedQty: 0, addLine }));
    expect(screen.queryByText(/From your last visit/)).toBeNull();
  });

  it('starts at 1 without a saved quantity', () => {
    render(page({}));
    expect(qty()).toBe('1');
    expect(screen.queryByText(/From your last visit/)).toBeNull();
  });
});

describe('ProductPage quantity (AW-013) and a bare cart line (AW-011)', () => {
  it('can’t go below 1, and takes a typed quantity', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 48, capped: false }));
    render(page({ addLine }));
    const group = screen.getByRole('group', { name: 'Quantity to add' });
    expect(group.className).toBe('stepper');
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(true);
    const input = screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos to add' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    fireEvent.blur(input);
    expect(qty()).toBe('48');
    expect(screen.getByRole('button', { name: 'Decrease quantity' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, 'Red', 48);
    expect(qty()).toBe('1');
  });

  it('doesn’t show a bare line’s quantity as already in the quote, only the chosen variant’s', () => {
    const view = render(page({ cart: { 1: 12 } }));
    expect(screen.queryByText(/Already in/)).toBeNull();
    view.rerender(page({ cart: { 1: 12, '1::red': 3 } }));
    expect(screen.queryByText(/Already in/)).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect([...document.querySelectorAll('.in-cart-note')].map((n) => n.textContent)).toContain('Already in quote: 3 · Red');
  });
});

// The add is confirmed by the toast, with the quantity and the variant, and
// focus stays on the button (AW-072, AW-042).
describe('ProductPage add feedback', () => {
  afterEach(() => {
    dismissToast();
    vi.mocked(announce).mockClear();
  });
  const typeQty = (n) => {
    const input = screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos to add' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: String(n) } });
    fireEvent.blur(input);
  };

  it('names the quantity, the product and its variant, spoken once, and keeps focus on the button', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 3, capped: false }));
    render(page({ addLine }));
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    typeQty(3);
    const add = screen.getByRole('button', { name: /Add to quote/ });
    add.focus();
    fireEvent.click(add);
    expect(getToast()).toMatchObject({ text: 'Added 3 × Swisher Sweets cigarillos — Red to your quote.', action: { id: 'open-cart', label: 'View quote' } });
    expect(vi.mocked(announce).mock.calls).toEqual([['Added 3 × Swisher Sweets cigarillos — Red to your quote.']]);
    expect(document.activeElement).toBe(add);
  });

  it('says "order" to an approved buyer, and leaves out a variant the product doesn’t have', () => {
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    render(page({ addLine, profile: APPROVED, isApprovedBuyer: true, products: [{ ...P[0], variants: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }));
    expect(getToast()).toMatchObject({ text: 'Added 1 × Swisher Sweets cigarillos to your order.', action: { label: 'View order' } });
  });

  it('says what fits when the line reaches the 100,000 limit (AW-013)', () => {
    const addLine = vi.fn(() => ({ key: '1::red', qty: 100000, capped: true }));
    const view = render(page({ addLine, cart: { '1::red': 99990 } }));
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    typeQty(48);
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast().text).toBe('Added 10 × Swisher Sweets cigarillos — Red to your quote. The most per line is 100,000.');
    view.rerender(page({ addLine, cart: { '1::red': 100000 } }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast().text).toBe('Your quote already has 100,000 × Swisher Sweets cigarillos — Red. The most per line is 100,000.');
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('shows nothing when nothing could be added', () => {
    render(page({ addLine: vi.fn(() => null), products: [{ ...P[0], variants: [] }] }));
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(getToast()).toBeNull();
  });

  it('keeps the "Already in" note plain text, not a live region', () => {
    render(page({ cart: { '1::red': 3 } }));
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    const note = [...document.querySelectorAll('.in-cart-note')].find((n) => /Already in/.test(n.textContent));
    expect(note.getAttribute('aria-live')).toBeNull();
    expect(note.getAttribute('role')).toBeNull();
  });
});

// The bundled catalog is on screen until the live one answers, and it still
// lists products staff have deactivated since (AW-232).
describe('ProductPage while the live catalog is checked (AW-232)', () => {
  const single = [{ ...P[0], variants: [] }];
  const addRow = () => document.querySelector('.qty-row');

  it('while the first live load runs, holds the add row: "Checking availability…" in its place, and nothing can be added', () => {
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    render(page({ products: single, addLine, catalogStatus: 'loading', catalogSettled: false }));
    expect(screen.getByRole('status')).toHaveProperty('textContent', CHECKING_AVAILABILITY_TEXT);
    expect(CHECKING_AVAILABILITY_TEXT).toBe('Checking availability…');
    // The row keeps its place unseen (index.css), out of the accessibility tree.
    expect(addRow().parentElement.className).toBe('pd-add-hold');
    expect(addRow().getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button', { name: /Add to quote/ })).toBeNull();
    const hidden = addRow().querySelector('.button');
    expect(hidden.disabled).toBe(true);
    fireEvent.click(hidden);
    expect(addLine).not.toHaveBeenCalled();
    // The rest of the page is there: the name, the SKU and the description.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Swisher Sweets cigarillos');
    expect(document.querySelector('.pd-sku').textContent).toBe('SKU AW-SS');
  });

  it('gives the row back when the live catalog arrives', () => {
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    const view = render(page({ products: single, addLine, catalogStatus: 'loading', catalogSettled: false }));
    view.rerender(page({ products: single, addLine, catalogStatus: 'ready', catalogSettled: true }));
    expect(screen.queryByText(CHECKING_AVAILABILITY_TEXT)).toBeNull();
    expect(document.querySelector('.pd-add-hold')).toBeNull();
    expect(addRow().getAttribute('aria-hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, null, 1);
    dismissToast();
  });

  it('when the live load failed, adds from the bundled copy as before, so the page never waits for good', () => {
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    render(page({ products: single, addLine, catalogStatus: 'error', catalogSettled: false }));
    expect(screen.queryByText(CHECKING_AVAILABILITY_TEXT)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add to quote/ }));
    expect(addLine).toHaveBeenCalledWith(1, null, 1);
    dismissToast();
  });

  it('without a backend (the bundled copy is the catalog) or by default, the row is there', () => {
    const view = render(page({ products: single, catalogStatus: 'static', catalogSettled: true }));
    expect(screen.getByRole('button', { name: /Add to quote/ })).not.toBeNull();
    view.rerender(page({ products: single }));
    expect(screen.getByRole('button', { name: /Add to quote/ })).not.toBeNull();
    expect(screen.queryByText(CHECKING_AVAILABILITY_TEXT)).toBeNull();
  });
});

describe('ProductPage and “Show no description” (AW-023)', () => {
  const descs = () => [...document.querySelectorAll('.pd-desc')].map((n) => n.className);

  it('shows the description, or the generic sentence without one', () => {
    const view = render(page({ products: [{ ...P[0], variants: [], description: 'Foil pouches.' }] }));
    expect(screen.getByText('Foil pouches.').className).toBe('pd-desc');
    view.rerender(page({ products: [{ ...P[0], variants: [], description: '' }] }));
    expect(screen.getByText('Wholesale cigars & cigarillos from Swisher Sweets.').className).toBe('pd-desc');
  });

  it('shows no description line at all, not even the generic one, when staff hid it; the fine print stays', () => {
    render(page({ products: [{ ...P[0], variants: [], description: '', descriptionHidden: true }] }));
    expect(descs()).toEqual(['pd-desc pd-fine']);
    expect(screen.queryByText(/^Wholesale cigars/)).toBeNull();
  });
});
