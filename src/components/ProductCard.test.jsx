// The product card's detail line counts variants by their axis only when
// there is a choice (AW-233, AW-332, AW-128) and says what quantity 1 means
// (AW-031); its price follows the variants (AW-030). Prices are test values.
// The add control (AW-143): one button style, sentence-case labels, and a
// name that starts with the label and ends with the product (AW-170). The
// card itself (AW-170): an article named by its title, a real link to the
// product. Feedback and focus (AW-042, AW-072) at the end.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { dismissToast, getToast } from '../lib/toast.js';
import { SIZES } from '../lib/images.js';
import { ProductCard, cardDetail, cardDetailParts } from './ProductCard.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const base = { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS' };
const card = (p, props = {}) => (
  <ProductCard p={p} profile={null} isApprovedBuyer={false} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} {...props} />
);
// The detail line as it reads: its separators hold a no-break space before
// the dot (NEW-082), compared here as a plain space.
const detail = () => document.querySelector('.card-detail').textContent.replace(/\u00a0/g, ' ');
const price = () => document.querySelector('.card-meta > span:first-child').textContent;
const APPROVED = { profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true, pricesStatus: 'ready' };

describe('ProductCard', () => {
  it('counts variants by their axis, only when there is more than one', () => {
    const view = render(card({ ...base, variants: ['Red', 'Grape', 'Diamond'], variantAxis: 'Flavor' }));
    expect(detail()).toBe('Swisher Sweets · 3 flavors · AW-SS');
    view.rerender(card({ ...base, variants: ['S', 'M'], variantAxis: 'Size' }));
    expect(detail()).toBe('Swisher Sweets · 2 sizes · AW-SS');
    view.rerender(card({ ...base, variants: ['S', 'M'] }));
    expect(detail()).toBe('Swisher Sweets · 2 variants · AW-SS');
    view.rerender(card({ ...base, variants: ['Green'] }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
    view.rerender(card({ ...base, variants: [] }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
    // An old row's stale count is not read.
    view.rerender(card({ ...base, variants: ['Green'], flavors: 5 }));
    expect(detail()).toBe('Swisher Sweets · AW-SS');
  });

  it('says what quantity 1 means (AW-031)', () => {
    render(card({ ...base, variants: [], sellUnit: '5-pack' }));
    expect(detail()).toBe('Swisher Sweets · Sold by the 5-pack · AW-SS');
  });

  it('shows "From" the lowest price when the variants are priced differently (AW-030)', () => {
    const p = { ...base, variants: ['Red', 'Grape'], variantAxis: 'Flavor' };
    const view = render(card(p, { ...APPROVED, priceOf: (id, v) => (v === 'Red' ? 9.5 : 12.25) }));
    expect(price()).toBe('From $9.50');
    view.rerender(card(p, { ...APPROVED, priceOf: () => 12.25 }));
    expect(price()).toBe('$12.25');
    // A variant that can't be ordered doesn't set the "From" price.
    view.rerender(card({ ...p, unavailableVariants: ['Red'] }, { ...APPROVED, priceOf: (id, v) => (v === 'Red' ? 9.5 : 12.25) }));
    expect(price()).toBe('$12.25');
    view.rerender(card({ ...base, variants: ['Green'] }, { ...APPROVED, priceOf: (id, v) => (v === 'Green' ? 7.1 : null) }));
    expect(price()).toBe('$7.10');
  });

  it('can’t add a product whose only variant is marked not available (AW-030)', () => {
    const addLine = vi.fn();
    const view = render(card({ ...base, variants: ['Green'], unavailableVariants: ['Green'] }, { addLine }));
    const button = screen.getByRole('button', { name: 'Not available, Swisher Sweets cigarillos' });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(addLine).not.toHaveBeenCalled();
    view.rerender(card({ ...base, variants: ['Green'] }, { addLine }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote, Swisher Sweets cigarillos' }));
    expect(addLine).toHaveBeenCalledWith(1, 'Green');
  });

  it('says "Not available", with no price, when every variant is marked not available (NEW-052)', () => {
    const p = { ...base, variants: ['Red', 'Grape'], variantAxis: 'Flavor', unavailableVariants: ['Red', 'Grape'] };
    const addLine = vi.fn();
    const view = render(card(p, { ...APPROVED, addLine, priceOf: () => null, cart: { '1::red': 2 } }));
    const button = screen.getByRole('button', { name: 'Not available, Swisher Sweets cigarillos' });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(addLine).not.toHaveBeenCalled();
    // No "Select options" leading to a product that can't be ordered, and no "Price on request".
    expect(screen.queryByRole('link', { name: /Select options/ })).toBeNull();
    expect(price()).toBe('');
    expect(document.querySelector('.card-meta').textContent).not.toMatch(/Price on request/);
    // The same for a price that did load, and for a product whose only variant is out.
    view.rerender(card(p, { ...APPROVED, priceOf: () => 12.25 }));
    expect(price()).toBe('');
    view.rerender(card({ ...base, variants: ['Green'], unavailableVariants: ['Green'] }, { ...APPROVED, priceOf: () => 14.35 }));
    expect(price()).toBe('');
    expect(screen.getByRole('button', { name: 'Not available, Swisher Sweets cigarillos' }).disabled).toBe(true);
    // A guest keeps the pricing line beside it.
    view.rerender(card(p));
    expect(price()).toBe('Pricing after approval');
    expect(screen.getByRole('button', { name: 'Not available, Swisher Sweets cigarillos' }).disabled).toBe(true);
    // One variant back: "Select options" again.
    view.rerender(card({ ...p, unavailableVariants: ['Red'] }, { ...APPROVED, priceOf: () => 12.25 }));
    expect(screen.getByRole('link', { name: 'Select options, Swisher Sweets cigarillos' })).toBeTruthy();
    expect(price()).toBe('$12.25');
  });

  // Cursor's PR #13 (AW-057, AW-029, AW-136, AW-286).
  it('says "Select options", "Add to quote" or "Add to order", and "Added" after an add (AW-057)', () => {
    vi.useFakeTimers();
    const addLine = vi.fn(() => ({ key: '1', qty: 1, capped: false }));
    const view = render(card({ ...base, variants: ['Red', 'Grape'] }, { addLine }));
    expect(screen.getByRole('link', { name: 'Select options, Swisher Sweets cigarillos' }).getAttribute('href')).toBe('/product/1');
    view.rerender(card({ ...base, variants: ['Red', 'Grape'] }, { addLine, cart: { '1::red': 2 } }));
    expect(screen.getByRole('link', { name: 'Select options · 2, Swisher Sweets cigarillos' })).toBeTruthy();
    view.rerender(card({ ...base, variants: [] }, { addLine }));
    const note = () => document.querySelector('.added-note').textContent;
    expect(note()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote, Swisher Sweets cigarillos' }));
    expect(addLine).toHaveBeenCalledWith(1, null);
    expect(note()).toBe('Added');
    act(() => vi.advanceTimersByTime(2100));
    expect(note()).toBe('');
    view.rerender(card({ ...base, variants: [] }, { addLine, ...APPROVED }));
    expect(screen.getByRole('button', { name: 'Add to order, Swisher Sweets cigarillos' })).toBeTruthy();
    vi.useRealTimers();
  });

  it('shows "Photo coming soon" without a photo, and badges a shared photo with the sell unit (AW-029, AW-136)', () => {
    const view = render(card({ ...base, variants: [], picture: null }));
    expect(document.querySelector('.card-block .photo-soon-label').textContent).toBe('Photo coming soon');
    expect(document.querySelector('.card-block .photo-soon-name').textContent).toBe(base.name);
    expect(document.querySelector('.card-initials')).toBeNull();
    const picture = { src: '/x.jpg', srcSet: '', webpSrcSet: '', width: 320, height: 320 };
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: true, sellUnit: '5-pack' }));
    expect(document.querySelector('.pack-badge').textContent).toBe('5-pack');
    // Not shared, or no sell unit: no badge.
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: false, sellUnit: '5-pack' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
    view.rerender(card({ ...base, variants: [], picture, sharedPhoto: true, sellUnit: '' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
  });

  it('asks for the photo at the rows’ card width, or the width its grid passes (AW-322)', () => {
    const picture = { src: '/x.jpg', srcSet: '/x-320.jpg 320w', webpSrcSet: '/x-320.webp 320w', width: 320, height: 320 };
    const view = render(card({ ...base, variants: [], picture }));
    const sizes = () => [...document.querySelectorAll('.card-block :is(img, source)')].map((el) => el.getAttribute('sizes'));
    expect(sizes()).toEqual([SIZES.card, SIZES.card]);
    view.rerender(card({ ...base, variants: [], picture }, { sizes: SIZES.categoryCard }));
    expect(sizes()).toEqual([SIZES.categoryCard, SIZES.categoryCard]);
  });

  it('badges a shared photo with the size word in the name when there is no sell unit, and calls it representative (AW-136)', () => {
    const picture = { src: '/x.jpg', srcSet: '', webpSrcSet: '', width: 320, height: 320 };
    const mamba = { ...base, id: 190, name: 'Mamba (small)', variants: [], picture };
    const view = render(card({ ...mamba, sharedPhoto: true, sellUnit: '' }));
    expect(document.querySelector('.pack-badge').textContent).toBe('small');
    expect(document.querySelector('.card-block img').getAttribute('alt')).toBe('Mamba (small) (representative photo)');
    // The sell unit comes first.
    view.rerender(card({ ...mamba, sharedPhoto: true, sellUnit: 'box of 24' }));
    expect(document.querySelector('.pack-badge').textContent).toBe('box of 24');
    // No word and no sell unit: nothing extra on a card (the product page has the note).
    view.rerender(card({ ...mamba, name: 'Gain dish liquid', sharedPhoto: true, sellUnit: '' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
    expect(document.querySelector('.photo-note')).toBeNull();
    expect(document.querySelector('.card-block img').getAttribute('alt')).toBe('Gain dish liquid (representative photo)');
    // A photo of its own: the name as it is, no badge.
    view.rerender(card({ ...mamba, sharedPhoto: false, sellUnit: '' }));
    expect(document.querySelector('.pack-badge')).toBeNull();
    expect(document.querySelector('.card-block img').getAttribute('alt')).toBe('Mamba (small)');
  });

  it('doesn’t print the placeholder brand "Assorted" (AW-286)', () => {
    render(card({ ...base, brand: 'Assorted', variants: ['S', 'M'], variantAxis: 'Size' }));
    expect(detail()).toBe('2 sizes · AW-SS');
  });

  it('prints the tag as a chip beside the product line, nothing over the photo, and not the department (AW-055)', () => {
    const picture = { src: '/x.jpg', srcSet: '', webpSrcSet: '', width: 320, height: 320 };
    const view = render(card({ ...base, variants: [], picture, tag: 'BESTSELLER' }));
    const kicker = document.querySelector('.card-kicker');
    expect([...kicker.children].map((el) => [el.tagName, el.className, el.textContent])).toEqual([['SPAN', '', 'Cigars'], ['SPAN', 'card-tag', 'BESTSELLER']]);
    // The photo box holds only the photo (and the sell-unit badge, AW-136).
    expect([...document.querySelector('.card-block').children].map((el) => el.tagName)).toEqual(['IMG']);
    expect(document.querySelector('.block-label')).toBeNull();
    expect(document.querySelector('.content-card').textContent).not.toMatch(/TOBACCO/);
    view.rerender(card({ ...base, variants: [], picture, tag: 'NEW' }));
    expect(document.querySelector('.card-kicker .card-tag').className).toBe('card-tag new');
    view.rerender(card({ ...base, variants: [], picture, tag: null }));
    expect([...document.querySelector('.card-kicker').children].map((el) => el.textContent)).toEqual(['Cigars']);
  });

  it('loads its photo lazily unless the page says eager; priority asks for it first (AW-323)', () => {
    const picture = { src: '/x.jpg', srcSet: '/x-320.jpg 320w', webpSrcSet: '/x-320.webp 320w', width: 320, height: 320 };
    const img = () => document.querySelector('.card-block img');
    const view = render(card({ ...base, variants: [], picture }));
    expect(img().getAttribute('loading')).toBe('lazy');
    expect(img().hasAttribute('fetchpriority')).toBe(false);
    view.rerender(card({ ...base, variants: [], picture }, { eager: true }));
    expect(img().getAttribute('loading')).toBe('eager');
    expect(img().hasAttribute('fetchpriority')).toBe(false);
    view.rerender(card({ ...base, variants: [], picture }, { eager: true, priority: true }));
    expect(img().getAttribute('loading')).toBe('eager');
    expect(img().getAttribute('fetchpriority')).toBe('high');
  });
});

// The add control (AW-143). Fixtures carry no prices.
const KITE = { id: 14, sku: 'AW-KITE', name: 'Kite cigarette tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes' };
const SWISHER = { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: ['Diamond', 'Red'] };
const APPROVED_PROFILE = { status: 'approved', pricing_tier: 'standard' };
const PENDING = { status: 'pending', pricing_tier: 'standard' };

const addCard = (props) => render(
  <ProductCard p={KITE} profile={null} isApprovedBuyer={false} cart={{}} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} {...props} />,
);

describe('ProductCard add control', () => {
  it('says "Add to quote" to guests and pending accounts, and adds one', () => {
    const addLine = vi.fn();
    addCard({ addLine });
    const add = screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' });
    expect(add.className).toBe('button ghost sm card-add');
    fireEvent.click(add);
    expect(addLine).toHaveBeenCalledWith(14, null);

    addCard({ profile: PENDING });
    expect(screen.getAllByRole('button', { name: 'Add to quote, Kite cigarette tobacco' })).toHaveLength(2);
  });

  it('says "Add to order" to approved buyers', () => {
    addCard({ profile: APPROVED_PROFILE, isApprovedBuyer: true });
    expect(screen.getByRole('button', { name: 'Add to order, Kite cigarette tobacco' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /quote/i })).toBeNull();
  });

  it('asks for a variant (Cursor\'s "Select options", AW-057) with a link to the product, counting what is already in the cart', () => {
    const view = addCard({ p: SWISHER });
    const choose = screen.getByRole('link', { name: 'Select options, Swisher Sweets cigarillos' });
    expect(choose.getAttribute('href')).toBe('/product/1');
    expect(choose.className).toBe('button ghost sm card-add');

    view.rerender(<ProductCard p={SWISHER} profile={null} isApprovedBuyer={false} cart={{ '1::red': 2, '1::diamond': 1, 14: 5 }} addLine={vi.fn()} decLine={vi.fn()} onLoginClick={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Select options · 3, Swisher Sweets cigarillos' })).toBeTruthy();
  });

  it('names each control by its visible label, then the product, for a list of buttons (AW-170, WCAG 2.5.3)', () => {
    // The product is screen-reader text after the label; the label shows.
    const visible = (el) => [...el.childNodes].filter((n) => !n.classList?.contains('sr-only')).map((n) => n.textContent).join('');
    addCard();
    const add = screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' });
    expect(visible(add)).toBe('Add to quote');
    expect(add.querySelector('.sr-only').textContent).toBe(', Kite cigarette tobacco');

    addCard({ p: SWISHER, cart: { '1::red': 2 } });
    const choose = screen.getByRole('link', { name: 'Select options · 2, Swisher Sweets cigarillos' });
    expect(visible(choose)).toBe('Select options · 2');

    addCard({ p: { ...KITE, id: 15, variants: ['Green'], unavailableVariants: ['Green'] } });
    expect(visible(screen.getByRole('button', { name: 'Not available, Kite cigarette tobacco' }))).toBe('Not available');
    // Nothing is described by the title any more: the name says it.
    expect(document.querySelectorAll('[aria-describedby]')).toHaveLength(0);
  });

  it('turns into a stepper once the product is in the cart', () => {
    const addLine = vi.fn();
    const decLine = vi.fn();
    addCard({ cart: { 14: 4 }, addLine, decLine });
    const group = screen.getByRole('group', { name: 'Kite cigarette tobacco quantity' });
    expect(group.className).toBe('stepper card-stepper');
    expect(screen.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' }).value).toBe('4');
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Kite cigarette tobacco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Kite cigarette tobacco' }));
    expect(addLine).toHaveBeenCalledWith(14, null, 1);
    expect(decLine).toHaveBeenCalledWith('14', 1);
    // The + and − are drawn icons, not text.
    expect(group.querySelectorAll('button svg.icon')).toHaveLength(2);
    expect(group.querySelector('button').textContent).toBe('');
  });

  it('takes a typed quantity as a change from the cart’s, with the same two actions (AW-013)', () => {
    const addLine = vi.fn();
    const decLine = vi.fn();
    addCard({ cart: { 14: 4 }, addLine, decLine });
    const input = screen.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '48' } });
    expect(addLine).toHaveBeenCalledWith(14, null, 44);
    fireEvent.change(input, { target: { value: '2' } });
    expect(decLine).toHaveBeenCalledWith('14', 2);
  });

  it('removes the product from 1 with −, named for the product', () => {
    const decLine = vi.fn();
    addCard({ cart: { 14: 1 }, decLine });
    expect(screen.queryByRole('button', { name: /^Decrease quantity/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kite cigarette tobacco' }));
    expect(decLine).toHaveBeenCalledWith('14', 1);
  });

  it('tells guests "Pricing after approval" in plain text, with no sign-in tab stop of its own (AW-224)', () => {
    const onLoginClick = vi.fn();
    addCard({ onLoginClick });
    const lock = screen.getByText('Pricing after approval');
    expect(lock.tagName).toBe('SPAN');
    expect(lock.className).toBe('lock');
    expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull();
    // The add button is the card's only control after its link.
    // (Its visible label; the product's name follows for screen readers, AW-170.)
    expect([...document.querySelectorAll('.card-meta button, .card-meta a')].map((el) => el.firstElementChild.textContent)).toEqual(['Add to quote']);
    expect(onLoginClick).not.toHaveBeenCalled();
  });

  it('tells a signed-in account waiting for approval the same, in plain text', () => {
    addCard({ profile: PENDING });
    expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull();
    expect(screen.getByText('Pricing after approval').className).toBe('lock');
  });

  it('tells an account on hold it is on hold, not that pricing comes after approval (AW-101)', () => {
    addCard({ profile: { status: 'suspended', pricing_tier: 'silver' } });
    expect(screen.getByText('Account on hold').className).toBe('lock');
    expect(screen.queryByText(/after approval/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign in for pricing/ })).toBeNull();
  });
});

// Feedback and focus (AW-042, AW-072): the add shows the toast, which is the
// one announcement; focus moves to the stepper and back to the add button.
describe('ProductCard feedback', () => {
  // The card with a cart that changes, as App's does.
  function Shelf({ p = KITE, approved = false }) {
    const [cart, setCart] = useState({});
    const addLine = (id, variant, n = 1) => {
      const key = String(id);
      const qty = (cart[key] || 0) + n;
      setCart({ ...cart, [key]: qty });
      return { key, qty, capped: false };
    };
    const decLine = (key, n = 1) => {
      const next = { ...cart, [key]: (cart[key] || 0) - n };
      if (next[key] <= 0) delete next[key];
      setCart(next);
    };
    return (
      <ProductCard p={p} profile={approved ? APPROVED_PROFILE : null} isApprovedBuyer={approved} cart={cart}
                   addLine={addLine} decLine={decLine} onLoginClick={vi.fn()} />
    );
  }
  const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text);

  afterEach(() => {
    dismissToast();
    vi.mocked(announce).mockClear();
  });

  it('confirms an add with the toast, spoken once, and focuses the stepper’s quantity', () => {
    render(<Shelf />);
    const add = screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' });
    add.focus();
    fireEvent.click(add);
    expect(getToast()).toMatchObject({ text: 'Added Kite cigarette tobacco to your quote.', action: { id: 'open-cart', label: 'View quote' } });
    expect(announced()).toEqual(['Added Kite cigarette tobacco to your quote.']);
    const input = screen.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' });
    expect(document.activeElement).toBe(input);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('says "order" to an approved buyer', () => {
    render(<Shelf approved />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to order, Kite cigarette tobacco' }));
    expect(getToast()).toMatchObject({ text: 'Added Kite cigarette tobacco to your order.', action: { label: 'View order' } });
  });

  it('focuses + instead of the number box after a tap, so a phone’s keyboard stays shut', () => {
    render(<Shelf />);
    const add = screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' });
    fireEvent.pointerDown(add, { pointerType: 'touch' });
    fireEvent.click(add);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Increase quantity of Kite cigarette tobacco' }));
  });

  it('announces a removal with − at 1 and puts focus back on the add button', () => {
    render(<Shelf />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' }));
    vi.mocked(announce).mockClear();
    const remove = screen.getByRole('button', { name: 'Remove Kite cigarette tobacco' });
    remove.focus();
    fireEvent.click(remove);
    expect(announced()).toEqual(['Removed Kite cigarette tobacco from your quote.']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' }));
  });

  it('shows no toast and no "Added" when nothing could be added', () => {
    addCard({ addLine: vi.fn(() => null) });
    fireEvent.click(screen.getByRole('button', { name: 'Add to quote, Kite cigarette tobacco' }));
    expect(getToast()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    expect(document.querySelector('.added-note').textContent).toBe('');
  });
});

// The card (AW-170): an article named by its title; the title is a real link
// to the product page whose name is the product name, stretched over the
// card in CSS; the controls follow it in the tab order. The detail line
// wraps between its values (AW-304).
describe('ProductCard structure', () => {
  it('is an article named by its title, whose link opens the product page', () => {
    addCard();
    const article = screen.getByRole('article', { name: 'Kite cigarette tobacco' });
    expect(article.className).toBe('content-card');
    const heading = within(article).getByRole('heading', { level: 3, name: 'Kite cigarette tobacco' });
    const link = within(heading).getByRole('link', { name: 'Kite cigarette tobacco' });
    expect(link.className).toBe('card-link');
    expect(link.getAttribute('href')).toBe('/product/14');
    expect(link.hasAttribute('aria-label')).toBe(false);
    // The photo, kicker and detail line are outside the link: nothing block-level in it.
    expect(link.children).toHaveLength(0);
    expect(article.querySelector('.card-block').closest('a')).toBeNull();
    expect(article.querySelector('.card-detail').closest('a')).toBeNull();
  });

  // No sign-in prompt on the card (AW-224): the page's PricingNotice has it.
  it('goes link, then the action in the tab order', () => {
    addCard();
    const order = [...document.querySelectorAll('.content-card a[href], .content-card button')].map((el) => el.className);
    expect(order).toEqual(['card-link', 'button ghost sm card-add']);
  });

  it('shows the detail line as parts that wrap between them, reading as one line (AW-304, NEW-082)', () => {
    render(card({ ...base, variants: ['Red', 'Grape'], variantAxis: 'Flavor', sellUnit: '5-pack' }));
    const parts = [...document.querySelectorAll('.card-detail > .text-parts > span')].map((span) => span.textContent);
    // A no-break space holds each dot to its part's last word (NEW-082).
    expect(parts).toEqual(['Swisher Sweets\u00a0· ', '2 flavors\u00a0· ', 'Sold by the 5-pack\u00a0· ', 'AW-SS']);
    expect(document.querySelector('.card-detail').textContent).toBe(cardDetail({ ...base, variants: ['Red', 'Grape'], variantAxis: 'Flavor', sellUnit: '5-pack' }));
    // The SKU is the code part: it never breaks at its hyphens, and its title
    // holds all of it (AW-304).
    const code = document.querySelector('.card-detail .sku-part');
    expect(code.textContent).toBe('AW-SS');
    expect(code.getAttribute('title')).toBe('AW-SS');
    expect(document.querySelectorAll('.card-detail .sku-part')).toHaveLength(1);
    expect(cardDetailParts({ ...base, variants: [] }, { sku: false })).toEqual(['Swisher Sweets']);
  });
});
