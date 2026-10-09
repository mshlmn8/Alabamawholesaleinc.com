// Home page photo/video carousel with previous/next and pause controls.
//
// A slide whose photo fails to load leaves the carousel (AW-342), so the
// counter, the controls and autoplay only see slides with something to show;
// with none left the carousel is not rendered and New arrivals moves up. The
// failed slides come back when the connection does (the 'online' event).

import { useState, useEffect, useRef } from 'react';
import { Picture } from './Picture.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';

export function HeroCarousel({ slides }) {
  // The photos (slide.img) that failed to load.
  const [failed, setFailed] = useState(() => new Set());
  const markFailed = (img) => setFailed(prev => new Set(prev).add(img));
  useEffect(() => {
    if (!failed.size) return undefined;
    const retry = () => setFailed(new Set());
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failed]);
  const media = slides.filter(slide => (slide.img || slide.videoUrl) && !failed.has(slide.img));
  const count = media.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const videoRef = useRef(null);
  const safeIndex = count ? index % count : 0;
  const active = media[safeIndex];

  const go = (delta) => setIndex(i => (i + delta + count) % count);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.videoUrl) return undefined;
    if (paused) {
      video.pause();
      return undefined;
    }
    const play = video.play();
    if (play?.catch) play.catch(() => {});
    const onEnded = () => setIndex(i => (i + 1) % count);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('ended', onEnded);
      video.pause();
    };
  }, [active, paused, count]);

  useEffect(() => {
    if (paused || count < 2 || active?.videoUrl) return undefined;
    const id = window.setInterval(() => setIndex(i => (i + 1) % count), 4500);
    return () => window.clearInterval(id);
  }, [paused, count, active]);

  if (!active) return null;

  return (
    <section className="home-carousel" aria-roledescription="carousel" aria-label="Featured photos and videos">
      <div className="home-carousel-stage">
        {/* Photos render at their own pixel size (never enlarged). The first slide is
            the page's largest image, so it loads eagerly at high priority. */}
        {media.map((slide, i) => {
          const isActive = i === safeIndex;
          return (
            <div key={`${slide.img || ''}-${slide.videoUrl || i}`} className={`home-carousel-slide${isActive ? ' is-active' : ''}`} aria-hidden={!isActive}>
              {slide.videoUrl ? (
                <video
                  ref={isActive ? videoRef : null}
                  src={isActive ? slide.videoUrl : undefined}
                  poster={slide.img || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={slide.title || 'Featured video'}
                />
              ) : slide.picture ? (
                <Picture picture={slide.picture} alt={isActive ? (slide.title || '') : ''}
                         sizes={`(max-width: 37.5em) 100vw, ${slide.picture.width || 720}px`}
                         priority={i === 0} loading={i === 0 ? 'eager' : 'lazy'} onFail={() => markFailed(slide.img)} />
              ) : (
                <img src={slide.img} alt={isActive ? (slide.title || '') : ''} onError={() => markFailed(slide.img)} />
              )}
            </div>
          );
        })}
      </div>
      <div className="home-carousel-controls">
        <p aria-live="polite">{`Slide ${safeIndex + 1} of ${count}`}</p>
        <button className="button ghost sm" type="button" onClick={() => go(-1)} aria-label="Previous slide">Previous</button>
        <button className="button ghost sm" type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Play' : 'Pause'}</button>
        <button className="button ghost sm" type="button" onClick={() => go(1)} aria-label="Next slide">Next</button>
      </div>
      {/* The vape slide carries the FDA statement (AW-026). */}
      {active.nicotineWarning && <NicotineWarning />}
    </section>
  );
}
