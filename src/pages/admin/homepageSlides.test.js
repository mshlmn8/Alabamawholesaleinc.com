// Admin -> Homepage's hero photo form and order (AW-119): drafts, checks
// that match the table's, the columns a save writes, and the writes a move
// needs.
import { describe, expect, it } from 'vitest';
import { HERO_SLIDES } from '../../data/content.js';
import { heroImage } from '../../lib/images.js';
import {
  ALT_MAX, BUNDLED_HERO_FILES, draftFromSlide, emptySlideDraft, homeImagePath, isBundledHero, isSlidePhoto, moveSlide, nextSlideSort,
  orderSlides, slideChanged, slidePatch, slideValues, validateSlide,
} from './homepageSlides.js';

const STORAGE = 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-display.jpg';
const DEPTS = ['TOBACCO', 'CANDIES', 'DRINKS & BAGS'];
const row = (id, sort, extra = {}) => ({ id, img: 'hero_candy.jpg', alt: `Photo ${id}`, go_cat: 'CANDIES', nicotine_warning: false, sort, active: true, ...extra });

describe('photos', () => {
  it('accepts a bundled hero file or a product-images upload, as the table does', () => {
    expect(BUNDLED_HERO_FILES.map((f) => heroImage(f).img)).toEqual(HERO_SLIDES.map((s) => s.img));
    for (const img of ['hero_candy.jpg', 'hero_new_one.webp', 'hero_x.jpeg', 'hero_y.png', STORAGE, ` ${STORAGE} `]) expect(isSlidePhoto(img), img).toBe(true);
    for (const img of ['', 'kite.jpg', 'Hero_candy.jpg', 'hero_candy.gif', '../hero_candy.jpg', 'https://example.com/a.jpg',
      'https://abc.supabase.co/storage/v1/object/public/application-documents/a.jpg', 'https://abc.supabase.co/storage/v1/render/image/public/product-images/a.jpg',
      'http://abc.supabase.co/storage/v1/object/public/product-images/a.jpg', `${STORAGE} x`]) {
      expect(isSlidePhoto(img), img).toBe(false);
    }
    expect(isBundledHero('hero_vape.jpg')).toBe(true);
    expect(isBundledHero(STORAGE)).toBe(false);
  });

  it('puts an upload under home/ with the product editor’s file-name rule', () => {
    expect(homeImagePath({ name: 'Counter Display (2).PNG', type: 'image/png' }, 1760000000000)).toBe('home/1760000000000-counter-display-2.png');
    expect(homeImagePath({ name: '???.webp', type: 'image/webp' }, 5)).toBe('home/5-photo.webp');
  });
});

describe('the form', () => {
  it('drafts a row, and a new photo starts shown with no link', () => {
    expect(draftFromSlide(row(3, 30, { go_cat: null, nicotine_warning: true, active: false }))).toEqual({
      id: 3, img: 'hero_candy.jpg', alt: 'Photo 3', goCat: '', nicotineWarning: true, active: false,
    });
    expect(emptySlideDraft()).toEqual({ id: null, img: '', alt: '', goCat: '', nicotineWarning: false, active: true });
  });

  it('needs a photo the site can show and a description of at most 200 characters', () => {
    expect(validateSlide({ ...emptySlideDraft() }, { departments: DEPTS }).errors).toEqual({
      img: 'Choose a bundled photo, upload one, or paste an uploaded photo’s address.',
      alt: 'Describe what the photo shows.',
    });
    expect(validateSlide({ ...emptySlideDraft(), img: 'https://example.com/a.jpg', alt: '  ' }, { departments: DEPTS }).errors).toEqual({
      img: 'Use a bundled hero photo or the address of a photo uploaded here (other sites’ addresses are blocked).',
      alt: 'Describe what the photo shows.',
    });
    expect(validateSlide({ ...emptySlideDraft(), img: STORAGE, alt: 'a'.repeat(ALT_MAX + 1) }, { departments: DEPTS }).errors)
      .toEqual({ alt: 'Keep the description to 200 characters (it has 201).' });
    expect(validateSlide({ ...emptySlideDraft(), img: STORAGE, alt: ` ${'a'.repeat(ALT_MAX)} ` }, { departments: DEPTS }).ok).toBe(true);
  });

  it('links only to a department in the list, or keeps the one the photo already had', () => {
    const draft = { ...emptySlideDraft(), img: 'hero_vape.jpg', alt: 'Vape', goCat: 'EXOTICS' };
    expect(validateSlide(draft, { departments: DEPTS }).errors).toEqual({ goCat: 'Choose a department from the list, or No link.' });
    expect(validateSlide(draft, { departments: DEPTS, original: { ...draft } }).ok).toBe(true);
    expect(validateSlide({ ...draft, goCat: '' }, { departments: DEPTS }).ok).toBe(true);
  });

  it('saves trimmed values, and an update only what changed', () => {
    const original = draftFromSlide(row(4, 40));
    const draft = { ...original, alt: '  Photo 4, edited ', goCat: '', nicotineWarning: true };
    expect(slideValues(draft)).toEqual({ img: 'hero_candy.jpg', alt: 'Photo 4, edited', go_cat: null, nicotine_warning: true, active: true });
    expect(slidePatch(draft, original)).toEqual({ alt: 'Photo 4, edited', go_cat: null, nicotine_warning: true });
    expect(slideChanged(draft, original)).toBe(true);
    expect(slideChanged({ ...original, alt: ' Photo 4 ' }, original)).toBe(false);
    expect(slideChanged(null, original)).toBe(false);
  });
});

describe('the order', () => {
  it('follows sort, then id', () => {
    expect(orderSlides([row(3, 20), row(1, 20), row(2, 10)]).map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it('moves a photo by swapping its sort with its neighbour’s', () => {
    const rows = [row(1, 10), row(2, 20), row(3, 30)];
    expect(moveSlide(rows, 2, -1)).toEqual([{ id: 2, sort: 10 }, { id: 1, sort: 20 }]);
    expect(moveSlide(rows, 2, 1)).toEqual([{ id: 2, sort: 30 }, { id: 3, sort: 20 }]);
    expect(moveSlide(rows, 1, -1)).toBeNull();
    expect(moveSlide(rows, 3, 1)).toBeNull();
    expect(moveSlide(rows, 9, 1)).toBeNull();
  });

  it('numbers every photo again when two share a sort, so the move shows', () => {
    const rows = [row(1, 0), row(2, 0), row(3, 0)];
    expect(moveSlide(rows, 3, -1)).toEqual([{ id: 1, sort: 10 }, { id: 3, sort: 20 }, { id: 2, sort: 30 }]);
    // More photos than fit 10 apart: closer, never past 999.
    const many = Array.from({ length: 150 }, (_, i) => row(i + 1, 5));
    const updates = moveSlide(many, 150, -1);
    expect(Math.max(...updates.map((u) => u.sort))).toBeLessThanOrEqual(999);
    expect(new Set(updates.map((u) => u.sort)).size).toBe(updates.length);
  });

  it('adds a new photo last, within the table’s 0 to 999', () => {
    expect(nextSlideSort([])).toBe(10);
    expect(nextSlideSort([row(1, 10), row(2, 40)])).toBe(50);
    expect(nextSlideSort([row(1, 995)])).toBe(999);
  });
});
