// The photos beside the home hero (HomeHero, AW-004): one fixed-aspect stage
// that rotates the HERO_SLIDES photos, each slide linking to its department.
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
// - Previous/next on the photo, one dot per slide and a pause toggle, with no
//   separate control bar (AW-054); a sideways swipe on the photo changes
//   slides too (AW-161).
// - The vape slide shows the FDA statement under the photo (AW-026, PR #12).
//   The other slides keep its space, hidden, so the page doesn't move when
//   the slide changes.
// - A slide whose photo fails to load leaves the carousel (AW-342), so the
//   counter, the dots, the controls and autoplay only see slides with
//   something to show; with none left the carousel renders nothing and the
//   hero shows its copy alone. The failed slides come back when the
//   connection does (the window 'online' event).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { catLabel } from '../lib/format.js';
import { Link } from '../lib/router.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
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

export function HeroCarousel({ slides }) {
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

  return (
    <section className="home-carousel" aria-roledescription="carousel" aria-label="Featured departments"
             onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={onFocus} onBlur={onBlur}>
      {/* Read out when the visitor changes slides, not on every automatic turn. */}
      <p className="sr-only" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true">{`Slide ${safeIndex + 1} of ${count}`}</p>
      <div className="home-carousel-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp}
           onPointerCancel={onPointerCancel} onClickCapture={onClickCapture}>
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
          const label = catLabel(slide.goCat);
          const warm = isWarm(i);
          return (
            <div key={`hero-${index}`} className={`home-carousel-slide${isActive ? ' is-active' : ''}`}
                 role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${label}`}
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
              {isActive && slide.goCat && (
                <Link className="home-carousel-caption" to={{ page: 'category', category: slide.goCat }} draggable={false}>{`Shop ${label}`}</Link>
              )}
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
            <div className="home-carousel-dots">
              {media.map(({ slide, index }, i) => (
                <button key={`dot-${index}`} type="button" aria-label={`Show slide ${i + 1}: ${catLabel(slide.goCat)}`}
                        aria-current={i === safeIndex ? 'true' : undefined} onClick={() => show(i)}>
                  <span />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {media.some(({ slide }) => slide.nicotineWarning) && (
        <div className="home-carousel-warning" aria-hidden={active.nicotineWarning ? undefined : 'true'}>
          <NicotineWarning />
        </div>
      )}
    </section>
  );
}
