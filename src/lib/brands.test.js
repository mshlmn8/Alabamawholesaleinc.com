import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { brandBySlug, brandGroups, brandPhoto, catalogBrands, homeBrands, HOME_BRAND_COUNT } from './brands.js';

describe('catalogBrands', () => {
  const brands = catalogBrands(PRODUCTS);

  it('names every stocked brand once, and leaves out Assorted and delisted lines', () => {
    const labels = brands.map((b) => b.label);
    expect(labels).toContain('Swisher Sweets');
    expect(labels).not.toContain('Assorted');
    expect(labels).not.toContain('Shroom Puff');
    expect(labels).not.toContain('Wava');
    expect(new Set(brands.map((b) => b.slug)).size).toBe(brands.length);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('finds a brand by any spelling of its slug', () => {
    expect(brandBySlug(PRODUCTS, 'Swisher-Sweets')?.label).toBe('Swisher Sweets');
    expect(brandBySlug(PRODUCTS, 'no-such-brand')).toBeNull();
    expect(brandBySlug(PRODUCTS, '---')).toBeNull();
  });
});

describe('homeBrands', () => {
  it('shows a short list, the biggest brands that have a photo first', () => {
    const shown = homeBrands(PRODUCTS);
    expect(shown).toHaveLength(HOME_BRAND_COUNT);
    expect(shown.every((b) => brandPhoto(b))).toBe(true);
    const counts = shown.map((b) => b.products.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('brandGroups', () => {
  it('groups letters, and names that do not start with a letter last', () => {
    const groups = brandGroups([
      { label: '4K\'s', slug: '4ks' },
      { label: 'Ajax', slug: 'ajax' },
      { label: 'BIC', slug: 'bic' },
    ]);
    expect(groups.map(([letter]) => letter)).toEqual(['A', 'B', '#']);
  });
});
