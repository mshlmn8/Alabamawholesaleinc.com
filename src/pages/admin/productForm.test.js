// The product editor's form (AW-023, AW-116): drafts, checks and the writes a
// save sends. Rows and prices are test values.
import { describe, expect, it } from 'vitest';
import {
  NEW_SUB, OPTIONAL_COLUMNS, draftChanged, draftFromRow, duplicateDraft, emptyDraft, errorFields, parsePrice, parseRank,
  patchFromDraft, photoProblem, productImagePath, productValues, validateProduct, variantPriceChanges,
} from './productForm.js';
import { departmentsFor } from '../../lib/departments.js';

const KITE = {
  id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe Tobacco', sku: 'AW-KITE', tag: null, active: true,
  description: '', sell_unit: '', variants: ['Red', 'Blue'], variant_axis: 'Color', unavailable_variants: ['Blue'], img: 'kite.jpg',
  stock_status: 'in_stock', featured_rank: null,
};
const SWISHER = { id: 1, name: 'Swisher', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', sku: 'AW-SS', variants: [], active: true };
const ROWS = [SWISHER, KITE];
const departments = departmentsFor(ROWS);
const check = (draft, extra = {}) => validateProduct(draft, { rows: ROWS, departments, ...extra });
const kite = () => draftFromRow(KITE, 12.5, { Red: 13 });

describe('draftFromRow', () => {
  it('holds the price as text, the variants with their flags and own prices, and the rank as text', () => {
    const draft = kite();
    expect(draft).toMatchObject({ id: 2, name: 'Kite', priceText: '12.50', rankText: '', stockStatus: 'in_stock', active: true, variantAxis: 'Color' });
    expect(draft.variants).toEqual([
      { key: 'v1', label: 'Red', original: 'Red', unavailable: false, priceText: '13.00', hadPrice: true },
      { key: 'v2', label: 'Blue', original: 'Blue', unavailable: true, priceText: '', hadPrice: false },
    ]);
    expect(draftFromRow({ ...KITE, featured_rank: 4, stock_status: 'weird' }, null).rankText).toBe('4');
    expect(draftFromRow({ ...KITE, stock_status: 'weird' }, null)).toMatchObject({ priceText: '', stockStatus: 'in_stock' });
  });

  it('starts a new product active, in stock, with no price, and a copy with " (copy)", no SKU and no rank', () => {
    expect(emptyDraft()).toMatchObject({ id: null, name: '', sku: '', priceText: '', active: true, stockStatus: 'in_stock', variants: [] });
    const copy = duplicateDraft({ ...KITE, featured_rank: 2 }, 12.5, { Red: 13 });
    expect(copy).toMatchObject({ id: null, name: 'Kite (copy)', sku: '', rankText: '', priceText: '12.50', img: 'kite.jpg' });
    expect(copy.variants.every((v) => v.original === null && !v.hadPrice)).toBe(true);
    // Its variant prices are written as new rows for the new product.
    expect(variantPriceChanges(copy, null, 99)).toEqual({ deletes: [], upserts: [{ product_id: 99, variant: 'Red', price: 13 }] });
  });
});

describe('validateProduct (AW-116)', () => {
  it('passes a loaded product unchanged', () => {
    expect(check(kite())).toEqual({ ok: true, errors: {} });
  });

  it.each([
    ['a blank name', { name: '   ' }, 'name', 'Enter the product name.'],
    ['a blank brand', { brand: '' }, 'brand', 'Enter the brand.'],
    ['a name over 200 characters', { name: 'x'.repeat(201) }, 'name', 'Keep the product name to 200 characters.'],
    ['an unknown department', { cat: 'FURNITURE' }, 'cat', 'Choose a department.'],
    ['no sub-line', { sub: '' }, 'sub', 'Choose a sub-line, or New sub-line… to add one.'],
    ['a new sub-line with no name', { sub: NEW_SUB, newSub: ' ' }, 'newSub', 'Enter the new sub-line’s name.'],
    ['a blank SKU', { sku: ' ' }, 'sku', 'Enter the SKU.'],
    ['a SKU with other characters', { sku: 'AW_KITE!' }, 'sku', expect.stringMatching(/^Use 2 to 41 capital letters/)],
    ['another product’s SKU, in lower case', { sku: ' aw-ss ' }, 'sku', 'That SKU is already used by another product.'],
    ['a price of -5', { priceText: '-5' }, 'price', expect.stringMatching(/^Enter the price as an amount from 0 to 99999\.99/)],
    ['a price of 99999999', { priceText: '99999999' }, 'price', expect.stringMatching(/^Enter the price/)],
    ['a price with three decimals', { priceText: '1.005' }, 'price', expect.stringMatching(/^Enter the price/)],
    ['a price written as an exponent', { priceText: '1e3' }, 'price', expect.stringMatching(/^Enter the price/)],
    ['a rank of 0', { rankText: '0' }, 'rank', 'Enter a whole number from 1 to 999, or leave it blank.'],
    ['a rank of 1000', { rankText: '1000' }, 'rank', 'Enter a whole number from 1 to 999, or leave it blank.'],
    ['a rank of 2.5', { rankText: '2.5' }, 'rank', 'Enter a whole number from 1 to 999, or leave it blank.'],
    ['an unknown stock status', { stockStatus: 'gone' }, 'stockStatus', 'Choose a stock status.'],
    ['an unknown tag', { tag: 'HOT' }, 'tag', 'Choose a tag from the list.'],
    ['two variants and no axis', { variantAxis: '' }, 'variantAxis', 'Choose what the variants differ by.'],
    ['a photo address that isn’t https', { img: 'http://example.test/a.jpg' }, 'img', expect.stringMatching(/^Enter a photo file name/)],
    ['a script as the photo', { img: 'javascript:alert(1)' }, 'img', expect.stringMatching(/^Enter a photo file name/)],
    // The CSP allows images from the site and *.supabase.co only (AW-205).
    ['a photo on another host', { img: 'https://cdn.example.test/a.jpg' }, 'img', expect.stringMatching(/^Enter a photo file name/)],
    ['a Supabase address outside public Storage', { img: 'https://abc.supabase.co/rest/v1/a.jpg' }, 'img', expect.stringMatching(/^Enter a photo file name/)],
  ])('refuses %s', (label, change, field, message) => {
    const { ok, errors } = check({ ...kite(), ...change });
    expect(ok).toBe(false);
    expect(errors).toEqual({ [field]: message });
  });

  it.each([
    ['a blank price: price on request', { priceText: '  ' }],
    ['0', { priceText: '0' }],
    ['99999.99', { priceText: '99999.99' }],
    ['a rank of 1', { rankText: '1' }],
    ['a rank of 999', { rankText: ' 999 ' }],
    ['a blank rank', { rankText: '' }],
    ['its own SKU in lower case', { sku: 'aw-kite' }],
    ['an existing sub-line typed as new', { sub: NEW_SUB, newSub: 'pipe tobacco' }],
    ['a public Supabase Storage address', { img: 'https://abc.supabase.co/storage/v1/object/public/product-images/products/2/1-kite.jpg' }],
    ['no photo', { img: '' }],
  ])('accepts %s', (label, change) => {
    expect(check({ ...kite(), ...change })).toEqual({ ok: true, errors: {} });
  });

  it('never makes NaN of a price: blank is null, anything else is an amount or refused', () => {
    expect(parsePrice('')).toEqual({ ok: true, price: null });
    expect(parsePrice(' 12.5 ')).toEqual({ ok: true, price: 12.5 });
    for (const raw of ['abc', '.', '-0', 'NaN', 'Infinity', '12,50']) expect(parsePrice(raw)).toEqual({ ok: false, price: null });
    expect(productValues({ ...kite(), priceText: '' }).price).toBeNull();
    expect(Number.isNaN(productValues({ ...kite(), priceText: 'abc' }).price)).toBe(false);
    expect(parseRank('')).toEqual({ ok: true, rank: null });
    expect(parseRank('7')).toEqual({ ok: true, rank: 7 });
  });

  it('refuses a blank variant, one listed twice (whatever its case or punctuation), and a bad variant price', () => {
    const draft = kite();
    draft.variants = [
      { ...draft.variants[0], label: 'King size' },
      { ...draft.variants[1], label: 'king-size' },
      { key: 'v3', label: ' ', original: null, unavailable: false, priceText: '-1', hadPrice: false },
    ];
    const { errors } = check(draft);
    expect(errors).toEqual({
      'variant:v2': 'Listed twice: “King size” is the same variant.',
      'variant:v3': 'Enter the variant’s name, or remove it.',
      'variantPrice:v3': 'Enter an amount such as 12.50, or leave it blank.',
    });
    expect(errorFields(errors, draft)).toEqual(['variant:v2', 'variant:v3', 'variantPrice:v3']);
    // Without product_variant_prices there is no variant price to check.
    expect(check(draft, { variantPrices: false }).errors).not.toHaveProperty('variantPrice:v3');
  });

  it('skips the checks of columns the database doesn’t have yet', () => {
    const draft = { ...kite(), rankText: 'x', stockStatus: '', variantAxis: '' };
    expect(Object.keys(check(draft).errors).sort()).toEqual(['rank', 'stockStatus', 'variantAxis']);
    expect(check(draft, { columns: new Set(['id', 'name']) })).toEqual({ ok: true, errors: {} });
  });

  it('lists the fields in form order', () => {
    const { errors } = check({ ...kite(), name: '', priceText: 'x', sku: '' });
    expect(errorFields(errors, kite())).toEqual(['name', 'sku', 'price']);
  });
});

describe('patchFromDraft', () => {
  it('sends only the columns that changed, trimmed and parsed, and never flavors', () => {
    const original = kite();
    expect(patchFromDraft(original, original)).toEqual({});
    const draft = { ...original, name: ' Kite pipe tobacco ', priceText: '13', sku: 'aw-kite-2 ', tag: 'NEW' };
    expect(patchFromDraft(draft, original)).toEqual({ name: 'Kite pipe tobacco', price: 13, sku: 'AW-KITE-2', tag: 'NEW' });
    // A price typed another way is no change; a cleared one is "price on request".
    expect(patchFromDraft({ ...original, priceText: '12.5' }, original)).toEqual({});
    expect(patchFromDraft({ ...original, priceText: '' }, original)).toEqual({ price: null });
    const all = patchFromDraft(draft, null);
    expect(Object.keys(all).sort()).toEqual(['active', 'brand', 'cat', 'description', 'description_hidden', 'featured_rank', 'img', 'name', 'price', 'sell_unit',
      'sku', 'stock_status', 'sub', 'tag', 'unavailable_variants', 'variant_axis', 'variants'].sort());
    expect(all).not.toHaveProperty('flavors');
    expect(all).not.toHaveProperty('id');
  });

  it('writes the variants in order, the ones that can’t be ordered, and the axis only for two or more', () => {
    const original = kite();
    const moved = { ...original, variants: [original.variants[1], { ...original.variants[0], unavailable: true }] };
    expect(patchFromDraft(moved, original)).toEqual({ variants: ['Blue', 'Red'], unavailable_variants: ['Blue', 'Red'] });
    const one = { ...original, variants: [original.variants[0]] };
    expect(patchFromDraft(one, original)).toEqual({ variants: ['Red'], variant_axis: null, unavailable_variants: [] });
  });

  it('saves a new sub-line as typed, or as the department spells it', () => {
    expect(patchFromDraft({ ...kite(), sub: NEW_SUB, newSub: ' Pipe accessories ' }, kite(), { departments })).toEqual({ sub: 'Pipe accessories' });
    expect(patchFromDraft({ ...kite(), sub: NEW_SUB, newSub: 'PIPE TOBACCO' }, kite(), { departments })).toEqual({});
  });

  it('leaves out the optional columns the database doesn’t have', () => {
    expect(OPTIONAL_COLUMNS).toEqual(['stock_status', 'featured_rank', 'variant_axis', 'unavailable_variants', 'description_hidden']);
    const draft = { ...kite(), name: 'Kite 2', rankText: '3', stockStatus: 'low', descriptionHidden: true };
    const legacy = new Set(['id', 'name', 'brand', 'cat', 'sub', 'sku', 'tag', 'active', 'variants', 'img']);
    expect(patchFromDraft(draft, kite(), { columns: legacy })).toEqual({ name: 'Kite 2' });
    expect(Object.keys(patchFromDraft(draft, null, { columns: legacy }))).not.toEqual(expect.arrayContaining(['stock_status']));
    expect(Object.keys(patchFromDraft(draft, null, { columns: legacy }))).not.toContain('description_hidden');
    // The price is never a selected column, and is always written.
    expect(patchFromDraft({ ...draft, priceText: '1' }, kite(), { columns: legacy })).toEqual({ name: 'Kite 2', price: 1 });
  });
});

describe('“Show no description” (AW-023)', () => {
  it('loads, compares and saves description_hidden, keeping the text', () => {
    const original = draftFromRow({ ...KITE, description: 'Wrong text', description_hidden: false }, 12.5);
    expect(original.descriptionHidden).toBe(false);
    expect(draftFromRow(KITE, null).descriptionHidden).toBe(false);
    expect(draftFromRow({ ...KITE, description_hidden: true }, null).descriptionHidden).toBe(true);
    const hidden = { ...original, descriptionHidden: true };
    expect(draftChanged(hidden, original)).toBe(true);
    expect(patchFromDraft(hidden, original)).toEqual({ description_hidden: true });
    expect(productValues(hidden)).toMatchObject({ description: 'Wrong text', description_hidden: true });
    expect(patchFromDraft(hidden, original, { columns: new Set(['id', 'name', 'description', 'description_hidden']) })).toEqual({ description_hidden: true });
    // A copy keeps it.
    expect(duplicateDraft({ ...KITE, description_hidden: true }, null).descriptionHidden).toBe(true);
    expect(emptyDraft().descriptionHidden).toBe(false);
  });
});

describe('variantPriceChanges', () => {
  it('upserts a new or changed own price and deletes the row of a variant removed, renamed or cleared', () => {
    const original = kite();
    expect(variantPriceChanges(original, original, 2)).toEqual({ deletes: [], upserts: [] });
    const changed = { ...original, variants: [{ ...original.variants[0], priceText: '14' }, { ...original.variants[1], priceText: '9.5' }] };
    expect(variantPriceChanges(changed, original, 2)).toEqual({
      deletes: [], upserts: [{ product_id: 2, variant: 'Red', price: 14 }, { product_id: 2, variant: 'Blue', price: 9.5 }],
    });
    const renamed = { ...original, variants: [{ ...original.variants[0], label: 'red' }, original.variants[1]] };
    expect(variantPriceChanges(renamed, original, 2)).toEqual({ deletes: ['Red'], upserts: [{ product_id: 2, variant: 'red', price: 13 }] });
    const cleared = { ...original, variants: [{ ...original.variants[0], priceText: '' }, original.variants[1]] };
    expect(variantPriceChanges(cleared, original, 2)).toEqual({ deletes: ['Red'], upserts: [] });
    const removed = { ...original, variants: [original.variants[1]] };
    expect(variantPriceChanges(removed, original, 2)).toEqual({ deletes: ['Red'], upserts: [] });
  });
});

describe('draftChanged', () => {
  it('counts a real change, not a price or text typed another way', () => {
    const original = kite();
    expect(draftChanged(original, original)).toBe(false);
    expect(draftChanged({ ...original, priceText: '12.5', name: 'Kite ' }, original)).toBe(false);
    expect(draftChanged({ ...original, priceText: '13' }, original)).toBe(true);
    expect(draftChanged({ ...original, priceText: 'abc' }, original)).toBe(true);
    expect(draftChanged({ ...original, active: false }, original)).toBe(true);
    expect(draftChanged({ ...original, variants: [...original.variants].reverse() }, original)).toBe(true);
    expect(draftChanged(null, original)).toBe(false);
  });
});

describe('photos', () => {
  it('takes a JPEG, PNG or WebP of at most 5 MB', () => {
    expect(photoProblem({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull();
    expect(photoProblem({ type: 'image/webp', size: 10 })).toBeNull();
    expect(photoProblem({ type: 'image/gif', size: 10 })).toBe('Choose a JPEG, PNG or WebP photo.');
    expect(photoProblem({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('Choose a photo of at most 5 MB.');
    expect(photoProblem(null)).toBe('Choose a photo file.');
  });

  it('uploads to products/<id>/<time>-<name>.<ext>', () => {
    expect(productImagePath(2, { name: 'Kite Front (1).JPG', type: 'image/jpeg' }, 1700000000000)).toBe('products/2/1700000000000-kite-front-1.jpg');
    expect(productImagePath(null, { name: '???.png', type: 'image/png' }, 5)).toBe('products/new/5-photo.png');
  });
});
