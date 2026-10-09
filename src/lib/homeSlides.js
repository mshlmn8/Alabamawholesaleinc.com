// The photos beside the home page's headline (HeroCarousel, AW-119): the
// rows staff keep in public.home_slides (Admin -> Homepage,
// supabase/migrations/20261011131000_home_slides.sql), or the photos bundled
// with the site (HERO_SLIDES in src/data/content.js) until those arrive and
// whenever they can't.
//
//   slideFromRow(row) -> { key, img, picture, alt, goCat, nicotineWarning } | null
//   useHomeSlides()   -> the slides to show
//   refreshHomeSlides() loads the table again (Admin -> Homepage, after a save)
//
// - The first paint shows the bundled slides, so the page's largest paint
//   never waits for the network. One load per session follows, the first
//   time the home page mounts.
// - Rows become the slides: an empty table (or one with every photo turned
//   off) means staff want no photos, so HeroCarousel renders nothing and the
//   hero's copy takes the whole width (.home-hero-media:empty).
// - A missing table (a database without 20261011131000: PGRST205 or 42P01),
//   any other error, a timeout or no backend keep the bundled slides.
// - A row's photo is a bundled hero file (hero_candy.jpg), drawn from its
//   responsive set like the bundled slides, or a product-images Storage
//   address (the CSP allows *.supabase.co only); anything else is dropped. A
//   department the site doesn't have becomes no link.

import { useEffect, useSyncExternalStore } from 'react';
import { HERO_SLIDES } from '../data/content.js';
import { NAV_ORDER } from '../data/products.js';
import { isMissingSchema } from '../pages/admin/adminData.js';
import { CATALOG_TIMEOUT_MS } from './catalog.jsx';
import { heroImage, productImage } from './images.js';
import { supabase as defaultClient } from './supabase.js';

export const HOME_SLIDES_COLUMNS = 'id,img,alt,go_cat,nicotine_warning,sort';
// A load that has not finished after this long is given up, like the catalog's.
export const HOME_SLIDES_TIMEOUT_MS = CATALOG_TIMEOUT_MS;

// The two kinds of photo a row may name, as the table's check has them
// (home_slides_img_chk).
export const BUNDLED_HERO_FILE = /^hero_[a-z0-9_]+\.(jpg|jpeg|png|webp)$/;
export const SLIDE_STORAGE_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\/\S+$/;
// The hero photos in this build of the site (src/assets), in HERO_SLIDES's
// order. Admin -> Homepage offers these; homeSlides.test.js checks they are
// the bundled slides' photos.
export const BUNDLED_HERO_FILES = Object.freeze(['hero_candy.jpg', 'hero_vape.jpg', 'hero_lighters.jpg', 'hero_gatorade.jpg']);

// A slide's photo as { img, picture }, or null when it names nothing the site
// can show.
export function slidePhoto(img) {
  const name = String(img ?? '').trim();
  let photo = null;
  if (BUNDLED_HERO_FILE.test(name)) photo = heroImage(name);
  else if (SLIDE_STORAGE_URL.test(name)) photo = productImage(name);
  return photo?.img || photo?.picture?.src ? photo : null;
}

// One home_slides row as a slide, or null to leave it out. `key` names the
// photo, so a bundled slide and the row for the same photo share it.
export function slideFromRow(row, { departments = NAV_ORDER } = {}) {
  const photo = slidePhoto(row?.img);
  if (!photo) return null;
  return {
    key: photo.img || photo.picture.src,
    img: photo.img,
    picture: photo.picture,
    alt: String(row.alt ?? '').trim(),
    goCat: departments.includes(row.go_cat) ? row.go_cat : null,
    nicotineWarning: row.nicotine_warning === true,
  };
}

// ---------------------------------------------------------------------------
// The store: one load per session, shared by every reader.
//   status 'bundled' (nothing loaded yet) | 'loading' | 'live' | 'missing'
//          (no table) | 'error' | 'static' (no backend)
// ---------------------------------------------------------------------------
const INITIAL = Object.freeze({ slides: HERO_SLIDES, source: 'bundled', status: 'bundled' });
let state = INITIAL;
let client = defaultClient;
let started = false;
let inflight = null;
let signature = null;
const listeners = new Set();

const setState = (next) => {
  state = next;
  for (const listener of listeners) listener();
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getHomeSlidesState = () => state;

// Loads the active rows once (or again, with force). Resolves to the state.
function load(force = false) {
  if (!client) {
    if (state.status !== 'static') setState({ ...state, status: 'static' });
    return Promise.resolve(state);
  }
  if (inflight) return inflight;
  if (started && !force) return Promise.resolve(state);
  started = true;
  const from = client;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), HOME_SLIDES_TIMEOUT_MS) : 0;
  if (state.source === 'bundled') setState({ ...state, status: 'loading' });
  const keep = (status) => setState({ ...state, status });
  const run = (async () => {
    try {
      let query = from.from('home_slides').select(HOME_SLIDES_COLUMNS).eq('active', true)
        .order('sort', { ascending: true }).order('id', { ascending: true });
      if (controller) query = query.abortSignal(controller.signal);
      const { data, error } = await query;
      if (from !== client) return state; // reset meanwhile (tests)
      if (error) keep(isMissingSchema(error) ? 'missing' : 'error');
      else {
        const rows = Array.isArray(data) ? data : [];
        const next = JSON.stringify(rows);
        // The same rows keep the same slides, so nothing re-renders.
        if (state.source === 'live' && next === signature) keep('live');
        else {
          signature = next;
          setState({ slides: rows.map((row) => slideFromRow(row)).filter(Boolean), source: 'live', status: 'live' });
        }
      }
    } catch {
      if (from === client) keep('error');
    } finally {
      clearTimeout(timer);
      if (from === client) inflight = null;
    }
    return state;
  })();
  inflight = run;
  return run;
}

// The slides to show: the bundled ones until the table's arrive. Only a new
// set of slides re-renders the page, not a status change.
const getSlides = () => state.slides;
export function useHomeSlides() {
  const slides = useSyncExternalStore(subscribe, getSlides, getSlides);
  useEffect(() => { load(); }, []);
  return slides;
}

// Loads the table again, e.g. after Admin -> Homepage saved a change, so the
// home page in this tab shows it.
export const refreshHomeSlides = () => load(true);

// Tests: back to the bundled slides, nothing loaded, with `client` (null for
// no backend; the app's Supabase client when left out).
export function resetHomeSlidesForTests({ client: next = defaultClient } = {}) {
  client = next;
  started = false;
  inflight = null;
  signature = null;
  setState(INITIAL);
}
