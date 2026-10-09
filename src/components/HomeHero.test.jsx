// The home page's split hero (AW-004, AW-169): its h1, the pitch, the calls
// to action for guests and signed-in visitors, and the photos beside it
// (the bundled ones, or those the home page passes, AW-119; their box while
// pending and an empty panel with none, NEW-008).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SLIDES, HOME_HERO, HOME_PITCH } from '../data/content.js';
import { HOME_DESCRIPTION } from '../lib/meta.js';
import { navigate } from '../lib/router.js';
import { HomeHero } from './HomeHero.jsx';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('HomeHero', () => {
  it('has one h1 naming the business, with the meta description as its pitch', () => {
    render(<HomeHero onApplyClick={() => {}} />);
    const h1s = document.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('Wholesale for licensed retailers.');
    expect(screen.getByRole('region', { name: HOME_HERO.title })).toBeTruthy();
    expect(document.querySelector('.home-hero-copy .eyebrow').textContent).toBe('WHOLESALE DISTRIBUTOR · BIRMINGHAM, AL');
    expect(document.querySelector('.home-hero-text').textContent).toBe(HOME_PITCH);
    expect(HOME_DESCRIPTION).toBe(HOME_PITCH);
  });

  it('asks a guest to apply, with the trade bar label, and offers the catalog', () => {
    const onApplyClick = vi.fn();
    render(<HomeHero onApplyClick={onApplyClick} />);
    const actions = document.querySelector('.home-hero-actions');
    expect([...actions.children].map((el) => [el.tagName, el.className, el.textContent])).toEqual([
      ['BUTTON', 'button', 'Apply for a trade account'],
      ['A', 'button ghost', 'Browse the catalog'],
    ]);
    expect(actions.querySelector('a').getAttribute('href')).toBe('/catalog');
    fireEvent.click(screen.getByRole('button', { name: 'Apply for a trade account' }));
    expect(onApplyClick).toHaveBeenCalledTimes(1);
  });

  it('sends a signed-in visitor to the catalog or their account, with no apply button', () => {
    render(<HomeHero signedIn onApplyClick={() => {}} />);
    const actions = document.querySelector('.home-hero-actions');
    expect([...actions.children].map((el) => [el.tagName, el.className, el.textContent, el.getAttribute('href')])).toEqual([
      ['A', 'button', 'Browse the catalog', '/catalog'],
      ['A', 'button ghost', 'Go to my account', '/account'],
    ]);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
  });

  it('puts the copy before the photos in the page', () => {
    render(<HomeHero onApplyClick={() => {}} />);
    expect([...document.querySelector('.home-hero').children].map((el) => el.className)).toEqual(['home-hero-copy', 'home-hero-media']);
  });

  it('describes each hero photo with its alt text, never the unshown slide copy', () => {
    expect(HERO_SLIDES.map((s) => s.alt)).toEqual([
      'Display box of Turtles Bites chocolates',
      'Geek Bar Pulse X disposable vape advertisement',
      'BIC lighters in a counter display tray',
      'Gatorade and G2 bottles',
    ]);
    expect(HERO_SLIDES.map((s) => s.goCat)).toEqual(['CANDIES', 'NOVELTIES', 'MERCHANDISE', 'DRINKS & BAGS']);
    render(<HomeHero onApplyClick={() => {}} />);
    const img = document.querySelector('.home-carousel-slide.is-active img');
    expect(img.getAttribute('alt')).toBe(HERO_SLIDES[0].alt);
    const hero = document.querySelector('.home-hero');
    for (const slide of HERO_SLIDES) {
      for (const field of ['eyebrow', 'title', 'sub', 'cta1', 'cta2']) {
        expect(hero.textContent, field).not.toContain(slide[field]);
        expect(hero.innerHTML, field).not.toContain(slide[field].replace(/&/g, '&amp;'));
      }
    }
  });
});

describe('HomeHero photos (AW-119)', () => {
  const photo = (name) => ({ key: `/${name}.jpg`, img: `/${name}.jpg`, picture: { src: `/${name}.jpg`, width: 700, height: 440 } });
  const SLIDES = [
    { ...photo('one'), alt: 'Photo one', goCat: 'CANDIES' },
    { ...photo('two'), alt: 'Photo two', goCat: 'TOBACCO' },
    { ...photo('three'), alt: 'Photo three', goCat: 'GROCERY' },
  ];
  const active = () => document.querySelector('.home-carousel-slide.is-active').getAttribute('aria-label');

  it('shows the slides it is given', () => {
    render(<HomeHero onApplyClick={() => {}} slides={SLIDES} />);
    expect([...document.querySelectorAll('.home-carousel-slide')].map((s) => s.getAttribute('aria-label')))
      .toEqual(['1 of 3: Candies', '2 of 3: Tobacco', '3 of 3: Grocery']);
  });

  it('starts again at slide 1 when the photos change, and keeps its place when only their text does', () => {
    const { rerender } = render(<HomeHero onApplyClick={() => {}} slides={SLIDES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 3: Grocery' }));
    expect(active()).toBe('3 of 3: Grocery');
    // The same photos with new alt text: the same carousel.
    rerender(<HomeHero onApplyClick={() => {}} slides={SLIDES.map((s) => ({ ...s, alt: `${s.alt}, edited` }))} />);
    expect(active()).toBe('3 of 3: Grocery');
    expect(document.querySelector('.home-carousel-slide.is-active img').getAttribute('alt')).toBe('Photo three, edited');
    // Another set: back to slide 1.
    rerender(<HomeHero onApplyClick={() => {}} slides={[SLIDES[2], SLIDES[0]]} />);
    expect(active()).toBe('1 of 2: Grocery');
  });

  it('keeps the photos\' column as an empty panel when there are no photos, so the copy keeps its width (NEW-008)', () => {
    render(<HomeHero onApplyClick={() => {}} slides={[]} />);
    const media = document.querySelector('.home-hero-media');
    expect([...media.children].map((el) => [el.className, el.getAttribute('aria-hidden')])).toEqual([['home-carousel is-empty', 'true']]);
    expect(media.querySelector('img, a, button')).toBeNull();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });

  it('holds the photos\' box empty while they are pending, then shows them in the same carousel (NEW-008)', () => {
    const { rerender } = render(<HomeHero onApplyClick={() => {}} slides={SLIDES} pending />);
    expect(document.querySelector('.home-hero-media > .home-carousel.is-pending')).toBeTruthy();
    expect(document.querySelector('.home-hero-media img')).toBeNull();
    rerender(<HomeHero onApplyClick={() => {}} slides={SLIDES} />);
    expect(document.querySelector('.home-carousel.is-pending')).toBeNull();
    expect(active()).toBe('1 of 3: Candies');
  });
});
