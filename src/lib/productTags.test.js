import { describe, expect, it } from 'vitest';
import { tagClass, tagLabel } from './productTags.js';

describe('product tags', () => {
  it('names each tag as a product feature', () => {
    expect(tagLabel('NEW')).toBe('New');
    expect(tagLabel('DEAL')).toBe('Deal');
    expect(tagLabel('BESTSELLER')).toBe('Bestseller');
    expect(tagLabel('PREMIUM')).toBe('Featured');
    expect(tagLabel(null)).toBe('');
    expect(tagLabel('')).toBe('');
  });

  it('gives each tag its own chip class', () => {
    expect(tagClass('NEW')).toBe('card-tag new');
    expect(tagClass('DEAL')).toBe('card-tag deal');
    expect(tagClass('BESTSELLER')).toBe('card-tag bestseller');
    expect(tagClass('PREMIUM')).toBe('card-tag featured');
  });
});
