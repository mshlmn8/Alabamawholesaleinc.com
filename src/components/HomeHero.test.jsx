// The home page opens on the new-product carousel. The h1 stays in the
// document, visually hidden. Slides are the ones the page passes.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_HERO } from '../data/content.js';
import { navigate } from '../lib/router.js';
import { HomeHero } from './HomeHero.jsx';

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('HomeHero', () => {
  it('keeps one h1, hidden, and shows no headline box', () => {
    render(<HomeHero />);
    const h1s = document.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(HOME_HERO.title);
    expect(h1s[0].className).toBe('sr-only');
    expect(screen.getByRole('region', { name: HOME_HERO.title })).toBeTruthy();
    expect(document.querySelector('.home-hero-copy, .home-hero-actions, .home-hero-text')).toBeNull();
    expect(document.querySelector('.home-hero').textContent).not.toMatch(/WHOLESALE DISTRIBUTOR|Apply for a trade account|Browse the catalog/);
  });

  it('is the carousel, named New products', () => {
    render(<HomeHero slides={[{ key: 'a', img: '/a.jpg', picture: { src: '/a.jpg', width: 400, height: 400 }, alt: 'Tueni chews', caption: 'Tueni chews', to: { page: 'product', productId: 184 } }]} />);
    expect([...document.querySelector('.home-hero').children].map((el) => el.className)).toEqual(['sr-only', 'home-hero-media']);
    expect(document.querySelector('.home-carousel').getAttribute('aria-label')).toBe('New products');
    expect(screen.getByRole('link', { name: 'Shop Tueni chews' }).getAttribute('href')).toBe('/product/184');
  });
});

describe('HomeHero slides', () => {
  const photo = (name) => ({ key: `/${name}.jpg`, img: `/${name}.jpg`, picture: { src: `/${name}.jpg`, width: 700, height: 440 } });
  const SLIDES = [
    { ...photo('one'), alt: 'Photo one', goCat: 'CANDIES' },
    { ...photo('two'), alt: 'Photo two', goCat: 'TOBACCO' },
    { ...photo('three'), alt: 'Photo three', goCat: 'GROCERY' },
  ];
  const active = () => document.querySelector('.home-carousel-slide.is-active').getAttribute('aria-label');

  it('shows the slides it is given', () => {
    render(<HomeHero slides={SLIDES} />);
    expect([...document.querySelectorAll('.home-carousel-slide')].map((s) => s.getAttribute('aria-label')))
      .toEqual(['1 of 3: Candies', '2 of 3: Tobacco', '3 of 3: Grocery']);
  });

  it('starts again at slide 1 when the photos change, and keeps its place when only their text does', () => {
    const { rerender } = render(<HomeHero slides={SLIDES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show slide 3: Grocery' }));
    expect(active()).toBe('3 of 3: Grocery');
    rerender(<HomeHero slides={SLIDES.map((s) => ({ ...s, alt: `${s.alt}, edited` }))} />);
    expect(active()).toBe('3 of 3: Grocery');
    expect(document.querySelector('.home-carousel-slide.is-active img').getAttribute('alt')).toBe('Photo three, edited');
    rerender(<HomeHero slides={[SLIDES[2], SLIDES[0]]} />);
    expect(active()).toBe('1 of 2: Grocery');
  });

  it('keeps an empty panel when there are no products', () => {
    render(<HomeHero slides={[]} />);
    const media = document.querySelector('.home-hero-media');
    expect([...media.children].map((el) => [el.className, el.getAttribute('aria-hidden')])).toEqual([['home-carousel is-empty', 'true']]);
    expect(media.querySelector('img, a, button')).toBeNull();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });

  it('holds the photos\' box empty while they are pending, then shows them', () => {
    const { rerender } = render(<HomeHero slides={SLIDES} pending />);
    expect(document.querySelector('.home-hero-media > .home-carousel.is-pending')).toBeTruthy();
    expect(document.querySelector('.home-hero-media img')).toBeNull();
    rerender(<HomeHero slides={SLIDES} />);
    expect(document.querySelector('.home-carousel.is-pending')).toBeNull();
    expect(active()).toBe('1 of 3: Candies');
  });
});
