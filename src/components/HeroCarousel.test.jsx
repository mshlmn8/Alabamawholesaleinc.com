// The home carousel drops slides whose photo fails to load (AW-342).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroCarousel } from './HeroCarousel.jsx';

const photo = (name) => ({ src: `/${name}--720x480.jpg`, srcSet: '', webpSrcSet: '', width: 720, height: 480 });
const SLIDES = [
  { title: 'One', img: '/one.jpg', picture: photo('one'), videoUrl: null },
  { title: 'Two', img: '/two.jpg', picture: photo('two'), videoUrl: null, nicotineWarning: true },
  { title: 'Three', img: '/three.jpg', picture: photo('three'), videoUrl: null },
  // A slide without a responsive set renders a plain <img>.
  { title: 'Four', img: '/four.jpg', picture: null, videoUrl: null },
];
const counter = () => screen.getByText(/^Slide \d of \d$/).textContent;
const photos = () => [...document.querySelectorAll('.home-carousel-slide img')];

beforeEach(() => {
  // Reduced motion: no autoplay while the test runs.
  vi.stubGlobal('matchMedia', (query) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe('HeroCarousel', () => {
  it('shows every slide with a photo', () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(counter()).toBe('Slide 1 of 4');
    expect(photos()).toHaveLength(4);
  });

  it('drops a slide whose photo fails, so the counter and controls skip it', () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.error(photos()[1]);
    expect(counter()).toBe('Slide 1 of 3');
    expect(photos().map((el) => el.getAttribute('src'))).toEqual(['/one--720x480.jpg', '/three--720x480.jpg', '/four.jpg']);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(counter()).toBe('Slide 2 of 3');
    expect(screen.getByRole('img', { name: 'Three' })).toBeTruthy();
    // The plain <img> slide fails the same way.
    fireEvent.error(photos()[2]);
    expect(counter()).toBe('Slide 2 of 2');
  });

  it('renders nothing when every photo fails, and comes back when the connection does', () => {
    const { container } = render(<HeroCarousel slides={SLIDES} />);
    while (photos().length) fireEvent.error(photos()[0]);
    expect(container.innerHTML).toBe('');
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(counter()).toBe('Slide 1 of 4');
    expect(photos()).toHaveLength(4);
  });
});
