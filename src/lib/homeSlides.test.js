// The hero photos from Admin -> Homepage (AW-119): a row becomes a slide (or
// is left out), the store starts with the bundled slides, loads the table
// once, takes its rows (none included) and keeps the bundled slides when the
// table is missing, fails or there is no backend. Rows are test values.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_SLIDES } from '../data/content.js';
import { heroImage } from './images.js';
import {
  BUNDLED_HERO_FILES, HOME_SLIDES_COLUMNS, HOME_SLIDES_TIMEOUT_MS, getHomeSlidesState, refreshHomeSlides, resetHomeSlidesForTests,
  slideFromRow, slidePhoto, useHomeSlides,
} from './homeSlides.js';

const STORAGE = 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-display.jpg';
const row = (id, extra = {}) => ({ id, img: 'hero_candy.jpg', alt: `Photo ${id}`, go_cat: 'CANDIES', nicotine_warning: false, sort: id * 10, ...extra });

// supabase-js's query builder, recording each request; `answer(n)` is the nth
// request's { data, error } (or a promise of one).
function fakeClient(answer) {
  const calls = [];
  const client = {
    calls,
    from: vi.fn((table) => {
      const q = { table, columns: null, filters: [], order: [], signal: null };
      calls.push(q);
      const builder = {
        select(columns) { q.columns = columns; return builder; },
        eq(column, value) { q.filters.push([column, value]); return builder; },
        order(column, options) { q.order.push([column, options?.ascending]); return builder; },
        abortSignal(signal) { q.signal = signal; return builder; },
        then(resolve, reject) { return Promise.resolve(answer(calls.length, q)).then(resolve, reject); },
      };
      return builder;
    }),
  };
  return client;
}
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(() => resetHomeSlidesForTests({ client: null }));
afterEach(() => {
  vi.useRealTimers();
  resetHomeSlidesForTests({ client: null });
});

describe('slideFromRow', () => {
  it('draws a bundled hero file from its responsive set, like the bundled slide for the same photo', () => {
    const slide = slideFromRow(row(1, { img: 'hero_vape.jpg', go_cat: 'NOVELTIES', nicotine_warning: true, alt: '  Vape advertisement ' }));
    expect(slide).toEqual({
      key: heroImage('hero_vape.jpg').img, img: heroImage('hero_vape.jpg').img, picture: heroImage('hero_vape.jpg').picture,
      alt: 'Vape advertisement', goCat: 'NOVELTIES', nicotineWarning: true,
    });
    expect(slide.key).toBe(HERO_SLIDES[1].img);
  });

  it('shows a product-images upload by its address', () => {
    const slide = slideFromRow(row(2, { img: STORAGE }));
    expect(slide.img).toBe(STORAGE);
    expect(slide.picture.src).toBe(STORAGE);
    expect(slide.key).toBe(STORAGE);
  });

  it('leaves out a row whose photo the site can’t show', () => {
    for (const img of ['https://example.com/a.jpg', 'http://abc.supabase.co/storage/v1/object/public/product-images/a.jpg',
      'https://abc.supabase.co/storage/v1/object/public/application-documents/a.jpg', 'kite.jpg', '../hero_candy.jpg', '', null, undefined]) {
      expect(slideFromRow(row(3, { img })), String(img)).toBeNull();
      expect(slidePhoto(img), String(img)).toBeNull();
    }
    expect(slideFromRow(null)).toBeNull();
  });

  it('links only to a department the site has, and warns only when the row says so', () => {
    expect(slideFromRow(row(4, { go_cat: 'EXOTICS' })).goCat).toBeNull();
    expect(slideFromRow(row(4, { go_cat: null })).goCat).toBeNull();
    expect(slideFromRow(row(4, { go_cat: 'DRINKS & BAGS' })).goCat).toBe('DRINKS & BAGS');
    expect(slideFromRow(row(4, { go_cat: 'EXOTICS' }), { departments: ['EXOTICS'] }).goCat).toBe('EXOTICS');
    expect(slideFromRow(row(4, { nicotine_warning: null })).nicotineWarning).toBe(false);
    expect(slideFromRow(row(4, { nicotine_warning: 'true' })).nicotineWarning).toBe(false);
  });

  it('offers the bundled slides’ own photos', () => {
    expect(BUNDLED_HERO_FILES.map((file) => heroImage(file).img)).toEqual(HERO_SLIDES.map((s) => s.img));
    // The migration's rows are today's slides.
    const seeded = [
      row(1, { img: 'hero_candy.jpg', alt: 'Display box of Turtles Bites chocolates', go_cat: 'CANDIES' }),
      row(2, { img: 'hero_vape.jpg', alt: 'Geek Bar Pulse X disposable vape advertisement', go_cat: 'NOVELTIES', nicotine_warning: true }),
      row(3, { img: 'hero_lighters.jpg', alt: 'BIC lighters in a counter display tray', go_cat: 'MERCHANDISE' }),
      row(4, { img: 'hero_gatorade.jpg', alt: 'Gatorade and G2 bottles', go_cat: 'DRINKS & BAGS' }),
    ].map((r) => slideFromRow(r));
    expect(seeded.map(({ img, picture, alt, goCat, nicotineWarning }) => ({ img, picture, alt, goCat, nicotineWarning: !!nicotineWarning })))
      .toEqual(HERO_SLIDES.map(({ img, picture, alt, goCat, nicotineWarning }) => ({ img, picture, alt, goCat, nicotineWarning: !!nicotineWarning })));
  });
});

describe('useHomeSlides', () => {
  it('shows the bundled slides with no backend, and asks nothing', async () => {
    const { result } = renderHook(() => useHomeSlides());
    expect(result.current).toBe(HERO_SLIDES);
    await flush();
    expect(result.current).toBe(HERO_SLIDES);
    expect(getHomeSlidesState().status).toBe('static');
  });

  it('starts with the bundled slides, then shows the active rows in order, loading once per session', async () => {
    const client = fakeClient(() => ({ data: [row(7, { img: STORAGE, go_cat: null }), row(3, { img: 'hero_lighters.jpg' })], error: null }));
    resetHomeSlidesForTests({ client });
    const { result, rerender } = renderHook(() => useHomeSlides());
    // The first paint never waits for the network.
    expect(result.current).toBe(HERO_SLIDES);
    await flush();
    expect(result.current.map((s) => [s.img, s.alt, s.goCat])).toEqual([[STORAGE, 'Photo 7', null], [heroImage('hero_lighters.jpg').img, 'Photo 3', 'CANDIES']]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({
      table: 'home_slides', columns: HOME_SLIDES_COLUMNS, filters: [['active', true]], order: [['sort', true], ['id', true]],
    });
    expect(HOME_SLIDES_COLUMNS).toBe('id,img,alt,go_cat,nicotine_warning,sort');
    // Another home page in the same session reads the store.
    rerender();
    renderHook(() => useHomeSlides());
    await flush();
    expect(client.calls).toHaveLength(1);
  });

  it('shows no photos when staff turned every one off (an empty table)', async () => {
    resetHomeSlidesForTests({ client: fakeClient(() => ({ data: [], error: null })) });
    const { result } = renderHook(() => useHomeSlides());
    await flush();
    expect(result.current).toEqual([]);
    expect(getHomeSlidesState()).toMatchObject({ source: 'live', status: 'live' });
  });

  it('keeps the bundled slides while the table is missing (before 20261011131000)', async () => {
    for (const error of [{ code: 'PGRST205', message: 'Could not find the table' }, { code: '42P01', message: 'relation does not exist' }]) {
      resetHomeSlidesForTests({ client: fakeClient(() => ({ data: null, error })) });
      const { result } = renderHook(() => useHomeSlides());
      await flush();
      expect(result.current).toBe(HERO_SLIDES);
      expect(getHomeSlidesState().status).toBe('missing');
    }
  });

  it('keeps the bundled slides when the load fails, throws or times out', async () => {
    resetHomeSlidesForTests({ client: fakeClient(() => ({ data: null, error: { code: 'XX000', message: 'upstream' } })) });
    let hook = renderHook(() => useHomeSlides());
    await flush();
    expect(hook.result.current).toBe(HERO_SLIDES);
    expect(getHomeSlidesState().status).toBe('error');
    hook.unmount();

    resetHomeSlidesForTests({ client: fakeClient(() => Promise.reject(new TypeError('Failed to fetch'))) });
    hook = renderHook(() => useHomeSlides());
    await flush();
    expect(hook.result.current).toBe(HERO_SLIDES);
    hook.unmount();

    vi.useFakeTimers();
    let signal = null;
    resetHomeSlidesForTests({
      client: fakeClient((n, q) => new Promise((resolve) => {
        signal = q.signal;
        q.signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'AbortError: The operation was aborted.' } }));
      })),
    });
    hook = renderHook(() => useHomeSlides());
    await act(async () => { await vi.advanceTimersByTimeAsync(HOME_SLIDES_TIMEOUT_MS); });
    expect(signal.aborted).toBe(true);
    expect(hook.result.current).toBe(HERO_SLIDES);
    expect(getHomeSlidesState().status).toBe('error');
  });

  it('loads again on refreshHomeSlides(), keeping the same slides when nothing changed', async () => {
    let rows = [row(1), row(2, { img: 'hero_vape.jpg' })];
    const client = fakeClient(() => ({ data: rows, error: null }));
    resetHomeSlidesForTests({ client });
    const { result } = renderHook(() => useHomeSlides());
    await flush();
    const first = result.current;
    expect(first).toHaveLength(2);
    await act(async () => { await refreshHomeSlides(); });
    expect(client.calls).toHaveLength(2);
    expect(result.current).toBe(first);
    rows = [row(2, { img: 'hero_vape.jpg' })];
    await act(async () => { await refreshHomeSlides(); });
    expect(result.current.map((s) => s.alt)).toEqual(['Photo 2']);
  });
});
