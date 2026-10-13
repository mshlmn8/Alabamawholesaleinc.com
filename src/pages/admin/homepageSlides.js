// Admin -> Homepage's hero photos (AW-119): a public.home_slides row as
// edited, its checks, what a save writes, and the writes a reorder needs.
// Pure functions only (homepageSlides.test.js); HomepageSection.jsx renders
// and saves them. The table's own checks (20261011131000_home_slides.sql)
// are the same.
//
//   draftFromSlide(row) / emptySlideDraft()   the form's draft
//   validateSlide(draft, { departments })     { ok, errors: { img?, alt?, goCat? } }
//   slideValues(draft)                        the columns a save writes
//   slideChanged(draft, original)             unsaved changes?
//   orderSlides(rows)                         rows in the home page's order
//   moveSlide(rows, id, delta)                [{ id, sort }] updates, or null
//   nextSlideSort(rows)                       the sort of a photo added last
//   homeImagePath(file, now)                  home/<time>-<name>.<ext>

import { BUNDLED_HERO_FILE, BUNDLED_HERO_FILES, SLIDE_STORAGE_URL } from '../../lib/homeSlides.js';
import { PHOTO_URL, photoFileName } from './productForm.js';

export { BUNDLED_HERO_FILES };
export const SLIDE_COLUMNS = 'id,img,alt,go_cat,nicotine_warning,sort,active,updated_at';
export const ALT_MAX = 200;
export const MAX_SORT = 999;
export const SORT_STEP = 10;

const trim = (value) => (value == null ? '' : String(value)).trim();

// A photo the table accepts and the site's CSP loads: a bundled hero file, or
// a product-images Storage address (also a valid product photo address).
export const isBundledHero = (img) => BUNDLED_HERO_FILE.test(trim(img));
export const isSlidePhoto = (img) => isBundledHero(img) || (SLIDE_STORAGE_URL.test(trim(img)) && PHOTO_URL.test(trim(img)));

export function draftFromSlide(row) {
  return {
    id: row?.id ?? null,
    img: trim(row?.img),
    alt: row?.alt == null ? '' : String(row.alt),
    goCat: row?.go_cat ? String(row.go_cat) : '',
    nicotineWarning: row?.nicotine_warning === true,
    active: row ? row.active !== false : true,
  };
}

export const emptySlideDraft = () => draftFromSlide(null);

// The checks a save must pass. `departments` are the department keys the
// select offers; a slide whose department has gone may keep it.
export function validateSlide(draft, { departments = [], original = null } = {}) {
  const errors = {};
  const img = trim(draft.img);
  if (!img) errors.img = 'Choose a bundled photo, upload one, or paste an uploaded photo’s address.';
  else if (!isSlidePhoto(img)) errors.img = 'Use a bundled hero photo or the address of a photo uploaded here (other sites’ addresses are blocked).';
  const alt = trim(draft.alt);
  if (!alt) errors.alt = 'Describe what the photo shows.';
  else if (alt.length > ALT_MAX) errors.alt = `Keep the description to ${ALT_MAX} characters (it has ${alt.length}).`;
  if (draft.goCat && !departments.includes(draft.goCat) && draft.goCat !== original?.goCat) errors.goCat = 'Choose a department from the list, or No link.';
  return { ok: Object.keys(errors).length === 0, errors };
}

// The order fields appear in on the form.
export const SLIDE_FIELDS = ['img', 'alt', 'goCat'];

// The columns a save writes (sort is set by the list, not the form).
export function slideValues(draft) {
  return {
    img: trim(draft.img),
    alt: trim(draft.alt),
    go_cat: draft.goCat || null,
    nicotine_warning: !!draft.nicotineWarning,
    active: !!draft.active,
  };
}

// Only the columns that changed, for an update.
export function slidePatch(draft, original) {
  const next = slideValues(draft);
  const before = slideValues(original);
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => before[key] !== value));
}

export const slideChanged = (draft, original) => !!draft && !!original && Object.keys(slidePatch(draft, original)).length > 0;

// The home page's order: sort, then id.
export const orderSlides = (rows = []) => [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || Number(a.id) - Number(b.id));

// The updates that move photo `id` one place up (delta -1) or down (+1) in
// the home page's order: its sort and its neighbour's swap. When the two
// share a sort (rows added in SQL), every photo is numbered again in the new
// order, 10 apart (closer when there are more than 99), so the move shows.
// null when it can't move that way.
export function moveSlide(rows, id, delta) {
  const ordered = orderSlides(rows);
  const from = ordered.findIndex((r) => r.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= ordered.length) return null;
  const a = ordered[from];
  const b = ordered[to];
  if ((a.sort ?? 0) !== (b.sort ?? 0)) return [{ id: a.id, sort: b.sort ?? 0 }, { id: b.id, sort: a.sort ?? 0 }];
  const moved = [...ordered];
  moved.splice(from, 1);
  moved.splice(to, 0, a);
  const step = Math.max(1, Math.min(SORT_STEP, Math.floor(MAX_SORT / moved.length)));
  return moved.map((r, i) => ({ id: r.id, sort: (i + 1) * step })).filter((u, i) => u.sort !== (moved[i].sort ?? 0));
}

// A new photo goes last.
export function nextSlideSort(rows = []) {
  const top = rows.reduce((max, r) => Math.max(max, Number(r.sort) || 0), 0);
  return rows.length ? Math.min(MAX_SORT, top + SORT_STEP) : SORT_STEP;
}

// Where an uploaded hero photo goes in the product-images bucket.
export const homeImagePath = (file, now = Date.now()) => `home/${photoFileName(file, now)}`;
