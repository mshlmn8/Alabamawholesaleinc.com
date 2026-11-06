// The home page opens on the new-product carousel. The page's h1 stays for
// the document outline, visually hidden: the cream headline, pitch and
// calls to action are not shown. The carousel is keyed by its slides, so a
// different set starts again at slide 1.

import { HOME_HERO } from '../data/content.js';
import { HeroCarousel } from './HeroCarousel.jsx';

const slidesKey = (slides) => slides.map((s) => s.key || s.img || s.picture?.src || '').join('\n');

export function HomeHero({ slides = [], pending = false }) {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <h1 id="home-hero-title" className="sr-only">{HOME_HERO.title}</h1>
      <div className="home-hero-media">
        <HeroCarousel key={slidesKey(slides)} slides={slides} pending={pending} label="New products" />
      </div>
    </section>
  );
}
