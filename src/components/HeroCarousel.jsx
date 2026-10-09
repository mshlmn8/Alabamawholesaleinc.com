// The photos beside the home hero (HomeHero, AW-004): one fixed-aspect stage
// that rotates the hero photos (Admin -> Homepage's, or the bundled
// HERO_SLIDES; AW-119), each slide linking to its department when it has one.
//
// - The stage keeps one aspect ratio and clips, and a photo is never drawn
//   larger than its own size, so no slide spills over the controls or the
//   next section (AW-036).
// - Autoplay starts only after the visitor's first interaction with the page,
//   so the first load's largest paint stays on slide 1 or the heading
//   (AW-177). It never runs with reduced motion; it pauses while the pointer
//   is over the carousel, while focus is inside it and while the tab is
//   hidden; and it stops for good once the visitor changes slides or presses
//   pause (AW-168).
// - Only slide 1 loads with the page. The next one follows once the page and
//   slide 1's photo have loaded, or the visitor interacts, and a slide's
//   neighbours once it has been shown (AW-321).
// - Previous/next and a pause toggle on the photo, one dot per slide
//   (AW-054); a sideways swipe on the carousel changes slides too (AW-161).
// - A band under the photo (NEW-055) holds the vape slide's FDA statement
//   (AW-026, PR #12) and, on every other slide, the dots, plus the slide's
//   "Shop …" link in the compact layout, so they no longer cover the photo.
//   On the vape slide the statement has the band, and the dots (and the
//   link) stay on the photo. The band keeps one height on every slide, so the
//   page doesn't move when the slide changes. Where the statement goes is a
//   question for counsel (the TODO(owner) at the band, AW-026).
// - While the first load of staff's photos is pending (NEW-008) the
//   carousel is an empty box the size of the bundled one, so the bundled
//   photos never flash before staff's; with no photos at all (staff turned
//   every one off) it is an empty panel of that size, so the hero's copy
//   keeps its width and nothing below it moves.
// - A slide whose photo fails to load leaves the carousel (AW-342), so the
//   counter, the dots, the controls and autoplay only see slides with
//   something to show; with none left the carousel renders nothing and the
//   hero shows its copy alone. The failed slides come back when the
//   connection does (the window 'online' event).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HERO_SLIDES } from '../data/content.js';
import { catLabel } from '../lib/format.js';
import { Link } from '../lib/router.js';
import { MOBILE_QUERY, useMediaQuery } from '../lib/useMediaQuery.js';
import { Icon } from './Icon.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';
import { Picture } from './Picture.jsx';

export const AUTOPLAY_MS = 6000;
// A swipe is a mostly sideways move of more than this many pixels.
export const SWIPE_MIN_PX = 40;
// The first of these anywhere on the page is the visitor's first interaction
// (scrolling with the wheel or a finger included).
const INTERACTIONS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Whether the tab is showing: autoplay waits while it is in the background.
const subscribeVisibility = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isPageVisible = () => !document.hidden;
const usePageVisible = () => useSyncExternalStore(subscribeVisibility, isPageVisible, () => true);

const pageLoaded = () => typeof document !== 'undefined' && document.readyState === 'complete';

// The view after moving to slide `to` (wrapped round). The slide is
// remembered as shown, so its neighbours load.
const moveTo = (view, to, count) => {
  const index = ((to % count) + count) % count;
  return { index, seen: view.seen.includes(index) ? view.seen : [...view.seen, index] };
};

// A slide's photo, by which a failed one is remembered: its JPEG, or the
// picture's src for a slide without one.
const photoKey = (slide) => slide.img || slide.picture?.src || null;

// What a slide and its dot are called after their number: the department it
// links to, or, for a slide without a link (Admin -> Homepage's "No link",
// AW-119), its photo's alt text.
const nameOf = (slide) => {
  const name = slide.goCat ? catLabel(slide.goCat) : String(slide.alt || '').trim();
  return name ? `: ${name}` : '';
};

// The band under the photo (NEW-055): there is one when there are dots to
// show (more than one slide) or a slide with the FDA statement.
const bandOf = (slides) => ({ controls: slides.length > 1, warning: slides.some((slide) => slide.nicotineWarning) });

// The carousel's box with nothing in it (NEW-008): the stage at its aspect
// ratio and the band as the bundled slides have it, its statement there but
// hidden. `kind` 'pending' is plain (the photos are on their way); 'empty'
// (no photos) is a decorative panel. Hidden from assistive technology.
function HeroReserve({ slides, kind }) {
  const band = bandOf(slides);
  return (
    <div className={`home-carousel is-${kind}`} aria-hidden="true">
      <div className="home-carousel-stage" />
      {(band.controls || band.warning) && (
        <div className="home-carousel-band">
          {band.controls && <div className="home-carousel-controls" />}
          {band.warning && <div className="home-carousel-warning" aria-hidden="true"><NicotineWarning /></div>}
        </div>
      )}
    </div>
  );
}

// `pending`: the slides may still change (useHomeSlides), so only their box
// shows. No slides: the empty panel, sized as the bundled carousel the page
// first painted. Otherwise the carousel.
export function HeroCarousel({ slides, pending = false }) {
  if (pending) return <HeroReserve slides={slides} kind="pending" />;
  if (!slides.length) return <HeroReserve slides={HERO_SLIDES} kind="empty" />;
  return <Carousel slides={slides} />;
}

function Carousel({ slides }) {
  // The photos that failed to load (AW-342), by photoKey.
  const [failed, setFailed] = useState(() => new Set());
  const markFailed = (key) => setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  useEffect(() => {
    if (!failed.size) return undefined;
    const retry = () => setFailed(new Set());
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failed]);
  // The slides with a photo that hasn't failed, each keyed by its place in `slides`.
  const media = slides.map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => photoKey(slide) && !failed.has(photoKey(slide)));
  const count = media.length;
  const [view, setView] = useState({ index: 0, seen: [] });
  const [paused, setPaused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [loaded, setLoaded] = useState(pageLoaded);
  const [firstShown, setFirstShown] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const compact = useMediaQuery(MOBILE_QUERY);
  const visible = usePageVisible();
  const swipeStart = useRef(null);
  const swiped = useRef(false);

  const safeIndex = count ? view.index % count : 0;
  const active = media[safeIndex]?.slide;
  const rotating = count > 1 && interacted && !paused && !reducedMotion && !hovered && !focused && visible;

  useEffect(() => {
    if (interacted) return undefined;
    const onInteract = () => setInteracted(true);
    for (const type of INTERACTIONS) window.addEventListener(type, onInteract, { passive: true, once: true });
    return () => {
      for (const type of INTERACTIONS) window.removeEventListener(type, onInteract);
    };
  }, [interacted]);

  useEffect(() => {
    if (loaded) return undefined;
    const onLoad = () => setLoaded(true);
    window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, [loaded]);

  useEffect(() => {
    if (!rotating) return undefined;
    const id = window.setInterval(() => setView((v) => moveTo(v, v.index + 1, count)), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [rotating, count]);

  if (!active) return null;
  const band = bandOf(media.map(({ slide }) => slide));
  // The shown slide's link: on the photo, or in the band under it in the
  // compact layout, where on the photo it covered the packshot's logo
  // (NEW-055). The vape slide's band is its statement's, so its link stays
  // on the photo.
  const captionInBand = compact && band.controls && !active.nicotineWarning;
  const caption = active.goCat
    ? <Link className="home-carousel-caption" to={{ page: 'category', category: active.goCat }} draggable={false}>{`Shop ${catLabel(active.goCat)}`}</Link>
    : null;

  // Slide 1 always; the next one once the page and slide 1's photo have
  // loaded (the app often mounts after the page's load event), or once the
  // visitor has interacted; every slide shown so far, and its neighbours.
  const ready = interacted || (loaded && firstShown);
  const onFirstPhoto = () => setFirstShown(true);
  const near = (i, j) => i === j || i === (j + 1) % count || j === (i + 1) % count;
  const isWarm = (i) => i === 0 || i === safeIndex || (ready && i === 1 % count) || view.seen.some((s) => near(i, s % count));

  // Previous, next, a dot or a swipe: the visitor took over, so autoplay stops.
  const go = (delta) => {
    setPaused(true);
    setView((v) => moveTo(v, v.index + delta, count));
  };
  const show = (i) => {
    setPaused(true);
    setView((v) => moveTo(v, i, count));
  };

  const onPointerDown = (e) => {
    swiped.current = false;
    if (!e.isPrimary || e.button !== 0) return;
    swipeStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) <= SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
  };
  const onPointerCancel = () => { swipeStart.current = null; };
  // The click that ends a swipe doesn't follow the slide's link. A new
  // pointer press or focus move clears a swipe that ended without a click.
  const onClickCapture = (e) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const onFocus = () => {
    swiped.current = false;
    setFocused(true);
  };
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  // The swipe handlers are on the whole carousel: in the band, the link's
  // stretched area still covers the photo (index.css).
  return (
    <section className={`home-carousel${active.nicotineWarning ? ' is-warning' : ''}`} aria-roledescription="carousel" aria-label="Featured departments"
             onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={onFocus} onBlur={onBlur}
             onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onClickCapture={onClickCapture}>
      {/* Read out when the visitor changes slides, not on every automatic turn. */}
      <p className="sr-only" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">{`Slide ${safeIndex + 1} of ${count}`}</p>
      <div className="home-carousel-stage">
        {/* The rotation control comes first in the tab order (AW-168). */}
        {count > 1 && !reducedMotion && (
          <button className="icon-btn home-carousel-toggle" type="button" aria-label="Pause slideshow" aria-pressed={paused}
                  onClick={() => setPaused((value) => !value)}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
        )}
        {/* Photos render at no more than their own pixel size. Slide 1 is the
            page's largest image, so it loads eagerly at high priority. */}
        {media.map(({ slide, index }, i) => {
          const isActive = i === safeIndex;
          const warm = isWarm(i);
          return (
            <div key={`hero-${index}`} className={`home-carousel-slide${isActive ? ' is-active' : ''}`}
                 role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}${nameOf(slide)}`}
                 aria-hidden={isActive ? undefined : 'true'}>
              {warm && slide.picture?.src && (
                <Picture picture={slide.picture} alt={slide.alt || ''} draggable={false}
                         sizes={`(max-width: 37.5em) 100vw, ${slide.picture.width || 720}px`}
                         priority={i === 0} loading={i === 0 ? 'eager' : 'lazy'} onFail={() => markFailed(photoKey(slide))}
                         onLoad={i === 0 ? onFirstPhoto : undefined} onError={i === 0 ? onFirstPhoto : undefined} />
              )}
              {warm && !slide.picture?.src && (
                <img src={slide.img} alt={slide.alt || ''} draggable={false}
                     onLoad={i === 0 ? onFirstPhoto : undefined}
                     onError={() => { if (i === 0) onFirstPhoto(); markFailed(photoKey(slide)); }} />
              )}
              {/* Only the shown slide holds a link, so hidden slides have
                  nothing to focus. */}
              {isActive && !captionInBand && caption}
            </div>
          );
        })}
        {count > 1 && (
          <>
            <button className="icon-btn home-carousel-prev" type="button" aria-label="Previous slide" onClick={() => go(-1)}>
              <Icon name="chevron-left" />
            </button>
            <button className="icon-btn home-carousel-next" type="button" aria-label="Next slide" onClick={() => go(1)}>
              <Icon name="chevron-right" />
            </button>
          </>
        )}
      </div>
      {/* The band (NEW-055): the controls and the statement share one cell,
          so it is as tall as the taller of the two on every slide. The
          statement comes last, so on the vape slide it is on top; hidden on
          the others, it lets clicks through to the controls. */}
      {(band.controls || band.warning) && (
        <div className="home-carousel-band">
          {band.controls && (
            <div className="home-carousel-controls">
              {captionInBand && caption}
              <div className="home-carousel-dots">
                {media.map(({ slide, index }, i) => (
                  <button key={`dot-${index}`} type="button" aria-label={`Show slide ${i + 1}${nameOf(slide)}`}
                          aria-current={i === safeIndex ? 'true' : undefined} onClick={() => show(i)}>
                    <span />
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* TODO(owner): Do the hero slides and product photos count as advertisements under 21 CFR 1143.3 (warning in the upper portion of the ad, at least 20% of its area)? The vape slide shows the verbatim warning under the photo until counsel answers. (AW-026) */}
          {band.warning && (
            <div className="home-carousel-warning" aria-hidden={active.nicotineWarning ? undefined : 'true'}>
              <NicotineWarning />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
