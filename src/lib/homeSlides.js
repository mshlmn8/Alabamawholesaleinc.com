// The photos beside the home page's headline (HeroCarousel, AW-119): the
// rows staff keep in public.home_slides (Admin -> Homepage,
// supabase/migrations/20261011131000_home_slides.sql), or the photos bundled
// with the site (HERO_SLIDES in src/data/content.js) until those arrive and
// whenever they can't.
//
//   slideFromRow(row) -> { key, img, picture, alt, goCat, nicotineWarning } | null
//   useHomeSlides()   -> { slides, pending }: the slides to show, and whether
//                        the first load is still within its first-paint budget
//   refreshHomeSlides() loads the table again (Admin -> Homepage, after a save)
//
// - The first load of a session gets HOME_SLIDES_FIRST_PAINT_MS (NEW-008).
//   Until it settles or that time is up, `pending` is true and HeroCarousel
//   holds the photos' box empty, so the bundled photos never show for a
//   moment only to be replaced by staff's. A load that settles in time shows
//   its rows straight away; one that doesn't leaves the bundled slides in
//   place (rows that arrive later still replace them). With no backend, and
//   on every later visit to the home page in the session (the store outlives
//   SPA navigation), nothing is pending. One load per session follows, the
//   first time the home page mounts.
// - Rows become the slides: an empty table (or one with every photo turned
//   off) means staff want no photos, so HeroCarousel shows an empty panel
//   where the photos were (NEW-008: the headline keeps its width, so
//   nothing moves).
// - A missing table (a database without 20261011131000: PGRST205 or 42P01),
//   any other error, a timeout or no backend keep the bundled slides.
// - Nothing is remembered between page loads: localStorage holds only the
//   cart and the age confirmation.
// - A row's photo is a bundled hero file (hero_candy.jpg), drawn from its
//   responsive set like the bundled slides, or a product-images Storage
//   address (the CSP allows *.supabase.co only); anything else is dropped. A
//   department the site doesn't have becomes no link.
// TODO(owner): Should the site remember staff's hero photo list for the rest of a browser tab (sessionStorage), so a reload shows them straight away? It would only help reloads within one tab. (NEW-008)

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
// How long the first load may hold the photos' box empty before the bundled
// slides show (NEW-008): short enough not to delay the page's largest paint
// much, long enough for a quick answer to skip the bundled photos altogether.
export const HOME_SLIDES_FIRST_PAINT_MS = 300;

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
//   pending: the first load may still answer within its first-paint budget
//            (only ever true before that load settles, and only with a backend)
// ---------------------------------------------------------------------------
const initialState = (from) => Object.freeze({ slides: HERO_SLIDES, source: 'bundled', status: 'bundled', pending: Boolean(from) });
let client = defaultClient;
let state = initialState(client);
let view = { slides: state.slides, pending: state.pending };
let started = false;
let inflight = null;
let budget = 0;
let signature = null;
const listeners = new Set();

const setState = (next) => {
  state = next;
  // A new object only when what the hero shows changes, so a status change
  // alone re-renders nothing.
  if (view.slides !== next.slides || view.pending !== next.pending) view = { slides: next.slides, pending: next.pending };
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
    if (state.status !== 'static' || state.pending) setState({ ...state, status: 'static', pending: false });
    return Promise.resolve(state);
  }
  if (inflight) return inflight;
  if (started && !force) return Promise.resolve(state);
  started = true;
  const from = client;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), HOME_SLIDES_TIMEOUT_MS) : 0;
  // The first-paint budget: past it, the bundled slides show while the load
  // goes on.
  if (state.pending && !budget) {
    budget = setTimeout(() => {
      budget = 0;
      if (from === client && state.pending) setState({ ...state, pending: false });
    }, HOME_SLIDES_FIRST_PAINT_MS);
  }
  if (state.source === 'bundled') setState({ ...state, status: 'loading' });
  // Every way a load ends settles the first paint too.
  const keep = (status) => setState({ ...state, status, pending: false });
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
          setState({ slides: rows.map((row) => slideFromRow(row)).filter(Boolean), source: 'live', status: 'live', pending: false });
        }
      }
    } catch {
      if (from === client) keep('error');
    } finally {
      clearTimeout(timer);
      if (from === client) {
        inflight = null;
        clearTimeout(budget);
        budget = 0;
      }
    }
    return state;
  })();
  inflight = run;
  return run;
}

// { slides, pending }: while pending (the first load, within its budget)
// the hero holds the photos' box empty; then the slides are the table's, or
// the bundled ones until those arrive. Only a change to either re-renders the
// page, not a status change.
const getView = () => view;
export function useHomeSlides() {
  const current = useSyncExternalStore(subscribe, getView, getView);
  useEffect(() => { load(); }, []);
  return current;
}

// Loads the table again, e.g. after Admin -> Homepage saved a change, so the
// home page in this tab shows it.
export const refreshHomeSlides = () => load(true);

// Tests: back to the bundled slides, nothing loaded, with `client` (null for
// no backend; the app's Supabase client when left out). With a client the
// first load is pending again.
export function resetHomeSlidesForTests({ client: next = defaultClient } = {}) {
  client = next;
  started = false;
  inflight = null;
  clearTimeout(budget);
  budget = 0;
  signature = null;
  setState(initialState(next));
}
