// The home hero's photo carousel (AW-036, AW-054, AW-161, AW-168, AW-177,
// AW-321, AW-342), the band under it (NEW-055) and its box while staff's
// photos load or when there are none (NEW-008), with fake timers and the
// real router.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SLIDES } from '../data/content.js';
import { NICOTINE_WARNING_TEXT } from './NicotineWarning.jsx';
import { navigate } from '../lib/router.js';
import { MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { AUTOPLAY_MS, HeroCarousel, SWIPE_MIN_PX } from './HeroCarousel.jsx';

const photo = (name) => ({ img: `/${name}.jpg`, picture: { src: `/${name}.jpg`, width: 700, height: 440 } });
const SLIDES = [
  { ...photo('candy'), alt: 'Display box of chocolates', title: 'Marketing line one', goCat: 'CANDIES' },
  { ...photo('vape'), alt: 'Vape advertisement', title: 'Marketing line two', goCat: 'NOVELTIES', nicotineWarning: true },
  { ...photo('lighters'), alt: 'Lighters in a tray', title: 'Marketing line three', goCat: 'MERCHANDISE' },
  { ...photo('drinks'), alt: 'Sports drink bottles', title: 'Marketing line four', goCat: 'DRINKS & BAGS' },
];

const carousel = () => document.querySelector('.home-carousel');
const stage = () => document.querySelector('.home-carousel-stage');
const activeSlide = () => document.querySelector('.home-carousel-slide.is-active').getAttribute('aria-label');
const counter = () => document.querySelector('.home-carousel > p.sr-only');
const toggle = () => screen.queryByRole('button', { name: 'Pause slideshow' });
const interact = () => act(() => { window.dispatchEvent(new Event('pointerdown')); });
const tick = (n = 1) => act(() => { vi.advanceTimersByTime(AUTOPLAY_MS * n); });
const swipe = (fromX, toX, { dy = 0 } = {}) => {
  fireEvent.pointerDown(stage(), { isPrimary: true, pointerId: 7, button: 0, clientX: fromX, clientY: 100 });
  fireEvent.pointerUp(stage(), { isPrimary: true, pointerId: 7, button: 0, clientX: toX, clientY: 100 + dy });
};

// A window.matchMedia for jsdom (which has none) that reports reduced motion,
// or the compact layout.
const matching = (...queries) => vi.stubGlobal('matchMedia', vi.fn((media) => ({
  media, matches: queries.includes(media), addEventListener() {}, removeEventListener() {},
})));
const reduceMotion = () => matching('(prefers-reduced-motion: reduce)');
const compactLayout = () => matching(MOBILE_QUERY);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('slides', () => {
  it('labels each slide as a group "N of 4: department", hides the others, and links only the shown one', () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(carousel().getAttribute('aria-roledescription')).toBe('carousel');
    expect(carousel().getAttribute('aria-label')).toBe('Featured departments');
    const groups = [...document.querySelectorAll('.home-carousel-slide')];
    expect(groups.map((g) => [g.getAttribute('role'), g.getAttribute('aria-roledescription'), g.getAttribute('aria-label')])).toEqual([
      ['group', 'slide', '1 of 4: Candies'],
      ['group', 'slide', '2 of 4: Novelties & Vapes'],
      ['group', 'slide', '3 of 4: Merchandise'],
      ['group', 'slide', '4 of 4: Drinks & Bags'],
    ]);
    expect(groups.map((g) => g.getAttribute('aria-hidden'))).toEqual([null, 'true', 'true', 'true']);
    // Hidden slides hold nothing focusable.
    for (const g of groups.slice(1)) expect(g.querySelector('a, button, [tabindex]')).toBeNull();
    const link = screen.getByRole('link', { name: 'Shop Candies' });
    expect(link.getAttribute('href')).toBe('/category/candies');
    expect(link.getAttribute('draggable')).toBe('false');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('describes each photo with its alt text, never the slide title', () => {
    render(<HeroCarousel slides={SLIDES} />);
    const img = document.querySelector('.home-carousel-slide.is-active img');
    expect(img.getAttribute('alt')).toBe('Display box of chocolates');
    expect(img.getAttribute('draggable')).toBe('false');
    expect(carousel().textContent).not.toMatch(/Marketing line/);
    for (const el of document.querySelectorAll('[alt], [aria-label]')) {
      expect(`${el.getAttribute('alt')} ${el.getAttribute('aria-label')}`).not.toMatch(/Marketing line/);
    }
  });

  it('shows the FDA statement under the vape slide and keeps its space, hidden, on the others', () => {
    render(<HeroCarousel slides={SLIDES} />);
    const band = document.querySelector('.home-carousel-warning');
    expect(band.textContent).toBe(NICOTINE_WARNING_TEXT);
    expect(band.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    expect(document.querySelector('.home-carousel-warning')).toBe(band);
    expect(band.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getByRole('note').textContent).toBe(NICOTINE_WARNING_TEXT);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(band.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no warning band when no slide needs one', () => {
    render(<HeroCarousel slides={SLIDES.map((slide) => ({ ...slide, nicotineWarning: false }))} />);
    expect(document.querySelector('.home-carousel-warning')).toBeNull();
  });
});

describe('loading (AW-321)', () => {
  it('renders a photo only for slide 1 until the page and that photo load, then the next one, then neighbours of each shown slide', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    render(<HeroCarousel slides={SLIDES} />);
    const withImg = () => [...document.querySelectorAll('.home-carousel-slide')].map((s) => Boolean(s.querySelector('img')));
    expect(withImg()).toEqual([true, false, false, false]);
    const first = document.querySelector('.home-carousel-slide img');
    expect(first.getAttribute('loading')).toBe('eager');
    expect(first.getAttribute('fetchpriority')).toBe('high');

    act(() => { window.dispatchEvent(new Event('load')); });
    expect(withImg()).toEqual([true, false, false, false]);
    fireEvent.load(first);
    expect(withImg()).toEqual([true, true, false, false]);
    expect(document.querySelectorAll('.home-carousel-slide img')[1].getAttribute('loading')).toBe('lazy');
    expect(document.querySelectorAll('.home-carousel-slide img')[1].hasAttribute('fetchpriority')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(withImg()).toEqual([true, true, true, false]);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(withImg()).toEqual([true, true, true, true]);
  });

  it('waits for slide 1\'s photo when the app mounts after the page\'s load event, and counts a failed photo as done', () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(document.readyState).toBe('complete');
    const withImg = () => [...document.querySelectorAll('.home-carousel-slide')].map((s) => Boolean(s.querySelector('img')));
    expect(withImg()).toEqual([true, false, false, false]);
    fireEvent.error(document.querySelector('.home-carousel-slide img'));
    // The failed slide leaves (AW-342); the new first slide and the next one load.
    expect(withImg()).toEqual([true, true, false]);
  });

  it('warms the next slide on the first interaction even before the page has loaded', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    render(<HeroCarousel slides={SLIDES} />);
    expect(document.querySelectorAll('.home-carousel-slide img')).toHaveLength(1);
    act(() => { window.dispatchEvent(new Event('keydown')); });
    expect([...document.querySelectorAll('.home-carousel-slide')].map((s) => Boolean(s.querySelector('img')))).toEqual([true, true, false, false]);
  });
});

describe('autoplay (AW-177, AW-168)', () => {
  it('does not start before the first interaction with the page, then turns every AUTOPLAY_MS', () => {
    render(<HeroCarousel slides={SLIDES} />);
    tick(3);
    expect(activeSlide()).toBe('1 of 4: Candies');
    interact();
    tick();
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    tick(3);
    expect(activeSlide()).toBe('1 of 4: Candies');
  });

  it('pauses while the pointer is over the carousel', () => {
    render(<HeroCarousel slides={SLIDES} />);
    interact();
    fireEvent.mouseEnter(carousel());
    tick(2);
    expect(activeSlide()).toBe('1 of 4: Candies');
    fireEvent.mouseLeave(carousel());
    tick();
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
  });

  it('pauses while focus is inside the carousel, and resumes when it leaves', () => {
    render(<><HeroCarousel slides={SLIDES} /><button type="button">Outside</button></>);
    interact();
    act(() => screen.getByRole('button', { name: 'Next slide' }).focus());
    tick(2);
    expect(activeSlide()).toBe('1 of 4: Candies');
    // Moving between the carousel's own controls keeps it paused.
    act(() => screen.getByRole('button', { name: 'Previous slide' }).focus());
    tick();
    expect(activeSlide()).toBe('1 of 4: Candies');
    act(() => screen.getByRole('button', { name: 'Outside' }).focus());
    tick();
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
  });

  it('waits while the tab is hidden', () => {
    render(<HeroCarousel slides={SLIDES} />);
    interact();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    tick(2);
    expect(activeSlide()).toBe('1 of 4: Candies');
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    tick();
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
  });

  it('stops for good once the visitor changes slides, until they press the toggle again', () => {
    render(<HeroCarousel slides={SLIDES} />);
    interact();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    tick(3);
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    tick();
    expect(activeSlide()).toBe('3 of 4: Merchandise');
  });

  it('pauses with one toggle: a fixed name, aria-pressed and a pause or play icon, first in the tab order', () => {
    render(<HeroCarousel slides={SLIDES} />);
    interact();
    const focusable = [...carousel().querySelectorAll('a, button')];
    expect(focusable[0]).toBe(toggle());
    const icon = () => toggle().querySelector('svg path').getAttribute('d');
    const pauseIcon = icon();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(icon()).not.toBe(pauseIcon);
    tick(3);
    expect(activeSlide()).toBe('1 of 4: Candies');
  });

  it('never runs with reduced motion, and offers no toggle', () => {
    reduceMotion();
    render(<HeroCarousel slides={SLIDES} />);
    expect(toggle()).toBeNull();
    interact();
    tick(3);
    expect(activeSlide()).toBe('1 of 4: Candies');
    expect(counter().getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
  });
});

describe('controls (AW-054, AW-168)', () => {
  it('has a dot per slide, aria-current on the shown one', () => {
    render(<HeroCarousel slides={SLIDES} />);
    const dots = () => [...document.querySelectorAll('.home-carousel-dots button')];
    expect(dots().map((d) => d.getAttribute('aria-label'))).toEqual([
      'Show slide 1: Candies', 'Show slide 2: Novelties & Vapes', 'Show slide 3: Merchandise', 'Show slide 4: Drinks & Bags',
    ]);
    expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual(['true', null, null, null]);
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 3: Merchandise' }));
    expect(activeSlide()).toBe('3 of 4: Merchandise');
    expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual([null, null, 'true', null]);
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('names a slide without a department link, and its dot, by the photo’s alt text (AW-119)', () => {
    const slides = [SLIDES[0], { ...SLIDES[2], goCat: null, alt: '  Counter display  ' }, { ...SLIDES[3], goCat: null, alt: '' }];
    render(<HeroCarousel slides={slides} />);
    expect([...document.querySelectorAll('.home-carousel-slide')].map((g) => g.getAttribute('aria-label')))
      .toEqual(['1 of 3: Candies', '2 of 3: Counter display', '3 of 3']);
    expect([...document.querySelectorAll('.home-carousel-dots button')].map((d) => d.getAttribute('aria-label')))
      .toEqual(['Show slide 1: Candies', 'Show slide 2: Counter display', 'Show slide 3']);
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 2: Counter display' }));
    // No department: no caption link.
    expect(document.querySelector('.home-carousel-slide.is-active a')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('wraps round with previous and next', () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(activeSlide()).toBe('4 of 4: Drinks & Bags');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe('1 of 4: Candies');
  });

  it('says "Slide N of 4" in an always-present line, read out only while autoplay is not turning', () => {
    render(<HeroCarousel slides={SLIDES} />);
    const line = counter();
    expect(line.textContent).toBe('Slide 1 of 4');
    expect(line.getAttribute('aria-live')).toBe('polite');
    interact();
    expect(line.getAttribute('aria-live')).toBe('off');
    tick();
    expect(counter()).toBe(line);
    expect(line.textContent).toBe('Slide 2 of 4');
    expect(line.getAttribute('aria-live')).toBe('off');
    fireEvent.mouseEnter(carousel());
    expect(line.getAttribute('aria-live')).toBe('polite');
    fireEvent.mouseLeave(carousel());
    expect(line.getAttribute('aria-live')).toBe('off');
    fireEvent.click(toggle());
    expect(line.getAttribute('aria-live')).toBe('polite');
  });

  it('shows nothing, and no controls, for a single photo or none', () => {
    const { unmount } = render(<HeroCarousel slides={SLIDES.slice(0, 1)} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Shop Candies' })).toBeTruthy();
    unmount();
    const { container } = render(<HeroCarousel slides={[{ goCat: 'CANDIES', img: null, picture: null }]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the band under the photo (NEW-055)', () => {
  const band = () => document.querySelector('.home-carousel-band');
  const caption = () => document.querySelector('.home-carousel-caption');

  it('holds the dots under the photo, and the hidden statement in the same cell', () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(stage().querySelector('.home-carousel-dots')).toBeNull();
    const controls = band().querySelector('.home-carousel-controls');
    expect(controls.querySelectorAll('.home-carousel-dots button')).toHaveLength(4);
    // The controls first, the statement last (on top on the vape slide).
    expect([...band().children].map((el) => el.className)).toEqual(['home-carousel-controls', 'home-carousel-warning']);
    expect(carousel().classList.contains('is-warning')).toBe(false);
    // The previous/next and pause controls stay on the photo.
    for (const name of ['Previous slide', 'Next slide', 'Pause slideshow']) expect(stage().contains(screen.getByRole('button', { name }))).toBe(true);
  });

  it('marks the vape slide, whose statement has the band and whose dots go back on the photo (index.css)', () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(carousel().classList.contains('is-warning')).toBe(true);
    expect(band().querySelector('.home-carousel-warning').hasAttribute('aria-hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(carousel().classList.contains('is-warning')).toBe(false);
  });

  it('keeps the slide\'s link on the photo outside the compact layout', () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(document.querySelector('.home-carousel-slide.is-active').contains(caption())).toBe(true);
    expect(band().contains(caption())).toBe(false);
  });

  it('moves the link into the band in the compact layout, except on the vape slide', () => {
    compactLayout();
    render(<HeroCarousel slides={SLIDES} />);
    const controls = band().querySelector('.home-carousel-controls');
    expect(within(controls).getByRole('link', { name: 'Shop Candies' }).getAttribute('href')).toBe('/category/candies');
    expect(document.querySelector('.home-carousel-slide.is-active a')).toBeNull();
    // Before the dots, so the tab order follows the page: toggle, previous, next, link, dots.
    expect([...controls.children].map((el) => el.className)).toEqual(['home-carousel-caption', 'home-carousel-dots']);
    expect([...carousel().querySelectorAll('a, button')].slice(0, 4).map((el) => el.getAttribute('aria-label') || el.textContent))
      .toEqual(['Pause slideshow', 'Previous slide', 'Next slide', 'Shop Candies']);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    const vape = document.querySelector('.home-carousel-slide.is-active');
    expect(within(vape).getByRole('link', { name: 'Shop Novelties & Vapes' })).toBeTruthy();
    expect(controls.querySelector('a')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(within(controls).getByRole('link', { name: 'Shop Merchandise' })).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('follows the band\'s link on a tap, but not with the click that ends a swipe started on it', () => {
    compactLayout();
    render(<HeroCarousel slides={SLIDES} />);
    const link = () => screen.getByRole('link', { name: /^Shop / });
    fireEvent.pointerDown(link(), { isPrimary: true, pointerId: 5, button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(link(), { isPrimary: true, pointerId: 5, button: 0, clientX: 150, clientY: 100 });
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    fireEvent.click(link());
    expect(window.location.pathname).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    fireEvent.pointerDown(link(), { isPrimary: true, pointerId: 6, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(link(), { isPrimary: true, pointerId: 6, button: 0, clientX: 50, clientY: 50 });
    fireEvent.click(link());
    expect(window.location.pathname).toBe('/category/merchandise');
  });

  it('has a band for the dots without any statement, none for one plain photo, and only the statement for one vape photo', () => {
    const plain = SLIDES.map((slide) => ({ ...slide, nicotineWarning: false }));
    const { unmount } = render(<HeroCarousel slides={plain} />);
    expect(band().querySelector('.home-carousel-warning')).toBeNull();
    expect(band().querySelectorAll('.home-carousel-dots button')).toHaveLength(4);
    unmount();
    const one = render(<HeroCarousel slides={plain.slice(0, 1)} />);
    expect(band()).toBeNull();
    one.unmount();
    compactLayout();
    render(<HeroCarousel slides={SLIDES.slice(1, 2)} />);
    expect([...band().children].map((el) => el.className)).toEqual(['home-carousel-warning']);
    expect(carousel().classList.contains('is-warning')).toBe(true);
    expect(document.querySelector('.home-carousel-slide.is-active a').textContent).toBe('Shop Novelties & Vapes');
  });
});

describe('while staff\'s photos load, and with none (NEW-008)', () => {
  it('holds the carousel\'s box empty while pending: no photo, nothing to focus, hidden from assistive technology', () => {
    const { container } = render(<HeroCarousel slides={SLIDES} pending />);
    const box = container.firstElementChild;
    expect(box.className).toBe('home-carousel is-pending');
    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect(box.querySelector('img, a, button, [tabindex]')).toBeNull();
    // The stage and the band as the carousel has them, the statement hidden.
    expect([...box.children].map((el) => el.className)).toEqual(['home-carousel-stage', 'home-carousel-band']);
    expect([...box.querySelector('.home-carousel-band').children].map((el) => [el.className, el.getAttribute('aria-hidden')]))
      .toEqual([['home-carousel-controls', null], ['home-carousel-warning', 'true']]);
    expect(box.querySelector('.home-carousel-warning').textContent).toBe(NICOTINE_WARNING_TEXT);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('sizes the pending box as the slides it waits on', () => {
    const { container } = render(<HeroCarousel slides={SLIDES.slice(0, 1)} pending />);
    expect(container.querySelector('.home-carousel-band')).toBeNull();
    expect(container.querySelector('.home-carousel-stage')).toBeTruthy();
  });

  it('shows the carousel once no longer pending, at slide 1 with its photo', () => {
    const { rerender } = render(<HeroCarousel slides={SLIDES} pending />);
    rerender(<HeroCarousel slides={SLIDES} />);
    expect(activeSlide()).toBe('1 of 4: Candies');
    expect(document.querySelector('.home-carousel-slide.is-active img').getAttribute('alt')).toBe('Display box of chocolates');
  });

  it('is an empty decorative panel, the bundled carousel\'s size, when there are no photos', () => {
    const { container } = render(<HeroCarousel slides={[]} />);
    const panel = container.firstElementChild;
    expect(panel.className).toBe('home-carousel is-empty');
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.querySelector('img, a, button, [tabindex]')).toBeNull();
    // Reserved as the bundled slides need: dots and the vape slide's statement.
    expect(HERO_SLIDES.length).toBeGreaterThan(1);
    expect(HERO_SLIDES.some((slide) => slide.nicotineWarning)).toBe(true);
    expect([...panel.querySelector('.home-carousel-band').children].map((el) => el.className)).toEqual(['home-carousel-controls', 'home-carousel-warning']);
  });
});

describe('failed photos (AW-342)', () => {
  const img = (i = 0) => document.querySelectorAll('.home-carousel-slide img')[i];
  const dotLabels = () => [...document.querySelectorAll('.home-carousel-dots button')].map((d) => d.getAttribute('aria-label'));

  it('drops a slide whose photo fails, so the counter, the dots and the controls skip it', () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    fireEvent.error(document.querySelector('.home-carousel-slide.is-active img'));
    expect(counter().textContent).toBe('Slide 2 of 3');
    expect(activeSlide()).toBe('2 of 3: Merchandise');
    expect(dotLabels()).toEqual(['Show slide 1: Candies', 'Show slide 2: Merchandise', 'Show slide 3: Drinks & Bags']);
    // The vape slide is gone, and with it the FDA band's slot.
    expect(document.querySelector('.home-carousel-warning')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(activeSlide()).toBe('3 of 3: Drinks & Bags');
  });

  it('moves to the next slide when the shown first photo fails', () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.error(img());
    expect(counter().textContent).toBe('Slide 1 of 3');
    expect(activeSlide()).toBe('1 of 3: Novelties & Vapes');
  });

  it('drops a plain <img> slide (no responsive set) the same way', () => {
    render(<HeroCarousel slides={SLIDES.map((slide) => ({ ...slide, picture: null }))} />);
    expect(img().getAttribute('src')).toBe('/candy.jpg');
    fireEvent.error(img());
    expect(counter().textContent).toBe('Slide 1 of 3');
  });

  it('renders nothing when every photo fails, and comes back when the connection does', () => {
    const { container } = render(<HeroCarousel slides={SLIDES} />);
    while (img()) fireEvent.error(img());
    expect(container.innerHTML).toBe('');
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(counter().textContent).toBe('Slide 1 of 4');
    expect(img()).toBeTruthy();
  });
});

describe('swipe (AW-161)', () => {
  it('moves to the next slide on a swipe left and back on a swipe right, and stops autoplay', () => {
    render(<HeroCarousel slides={SLIDES} />);
    interact();
    swipe(300, 300 - SWIPE_MIN_PX - 20);
    expect(activeSlide()).toBe('2 of 4: Novelties & Vapes');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    swipe(100, 220);
    expect(activeSlide()).toBe('1 of 4: Candies');
    tick(3);
    expect(activeSlide()).toBe('1 of 4: Candies');
  });

  it('ignores short, mostly vertical and cancelled moves', () => {
    render(<HeroCarousel slides={SLIDES} />);
    swipe(300, 300 - SWIPE_MIN_PX);
    swipe(300, 200, { dy: 140 });
    fireEvent.pointerDown(stage(), { isPrimary: true, pointerId: 3, button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerCancel(stage(), { isPrimary: true, pointerId: 3 });
    fireEvent.pointerUp(stage(), { isPrimary: true, pointerId: 3, button: 0, clientX: 100, clientY: 100 });
    // A second finger is not a swipe.
    fireEvent.pointerDown(stage(), { isPrimary: false, pointerId: 4, button: 0, clientX: 300, clientY: 100 });
    fireEvent.pointerUp(stage(), { isPrimary: false, pointerId: 4, button: 0, clientX: 100, clientY: 100 });
    expect(activeSlide()).toBe('1 of 4: Candies');
  });

  it('does not follow the slide link with the click that ends a swipe, but does with the next one', () => {
    render(<HeroCarousel slides={SLIDES} />);
    swipe(300, 150);
    const link = screen.getByRole('link', { name: 'Shop Novelties & Vapes' });
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/');
    fireEvent.pointerDown(link, { isPrimary: true, pointerId: 8, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(link, { isPrimary: true, pointerId: 8, button: 0, clientX: 50, clientY: 50 });
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/category/novelties');
  });
});
