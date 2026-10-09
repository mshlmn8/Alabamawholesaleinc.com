// The home page's split hero (AW-004), as in the approved 2A concept: a cream
// copy panel with the page's only h1, the pitch (the meta description, word
// for word) and the calls to action, beside the photo carousel. The copy
// comes first in the page; on wide screens the photos sit on the left.
// The headline and whether the photos keep rotating wait on the owner
// (TODO(owner) at HOME_HERO in src/data/content.js).

import { HERO_SLIDES, HOME_HERO } from '../data/content.js';
import { Link } from '../lib/router.js';
import { HeroCarousel } from './HeroCarousel.jsx';

export function HomeHero({ signedIn = false, onApplyClick }) {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy">
        <p className="eyebrow">{HOME_HERO.eyebrow}</p>
        <h1 id="home-hero-title">{HOME_HERO.title}</h1>
        <p className="home-hero-text">{HOME_HERO.text}</p>
        {/* Guests are asked to apply, with the label the trade bar and the
            menu use; signed-in visitors go to the catalog or their account. */}
        <div className="home-hero-actions">
          {signedIn ? (
            <>
              <Link className="button" to="/catalog">Browse the catalog</Link>
              <Link className="button ghost" to="/account">Go to my account</Link>
            </>
          ) : (
            <>
              <button className="button" type="button" onClick={onApplyClick}>Apply for a trade account</button>
              <Link className="button ghost" to="/catalog">Browse the catalog</Link>
            </>
          )}
        </div>
      </div>
      <div className="home-hero-media">
        <HeroCarousel slides={HERO_SLIDES} />
      </div>
    </section>
  );
}
