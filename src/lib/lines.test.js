// Cart and order line helpers (AW-209). Fixtures carry no prices.
import { describe, expect, it } from 'vitest';
import { lineKey, parseLineKey, normalizeCart, resolveCartItems, resolveSkuLine, variantSku, requiresVariantChoice } from './lines.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
  { id: 30, sku: 'AW-SS-MINI', name: 'Mini', variants: ['Red'] },
  { id: 40, sku: 'AW-OFF', name: 'Off', variants: [], active: false },
];

describe('line keys', () => {
  it('round-trips product id and variant slug', () => {
    expect(lineKey(1, 'White grape')).toBe('1::white-grape');
    expect(parseLineKey('1::white-grape')).toEqual({ productId: 1, variantSlug: 'white-grape' });
    expect(lineKey(14, null)).toBe('14');
    expect(parseLineKey('14')).toEqual({ productId: 14, variantSlug: null });
  });

  it('builds variant SKUs from the base SKU', () => {
    expect(variantSku('AW-SS', 'White grape')).toBe('AW-SS-WHITE-GRAPE');
    expect(variantSku('AW-SS', null)).toBe('AW-SS');
  });

  it('only multi-variant products require a choice', () => {
    expect(requiresVariantChoice(P[0])).toBe(true);
    expect(requiresVariantChoice(P[1])).toBe(false);
    expect(requiresVariantChoice(P[2])).toBe(false);
  });
});

describe('stored carts', () => {
  it('keeps multi-variant lines from a legacy {id: qty} cart bare so the buyer must choose', () => {
    const items = resolveCartItems(normalizeCart({ 1: 3, 14: 1, 20: 2 }, P), P);
    expect(items.map((i) => [i.lineKey, i.needsVariant, i.qty])).toEqual([
      ['1', true, 3],
      ['14', false, 1],
      ['20::only', false, 2],
    ]);
  });

  it('ignores non-object carts and bad quantities', () => {
    expect(normalizeCart(null, P)).toEqual({});
    expect(normalizeCart([5], P)).toEqual({});
    expect(normalizeCart({ 14: 0, 20: -1, 1: 'x' }, P)).toEqual({});
  });

  it('keeps lines the catalog does not know instead of dropping them (AW-083)', () => {
    expect(normalizeCart({ 999: 2, 40: 1, '1::purple': 1, 20: 1 }, P)).toEqual({ 999: 2, 40: 1, '1::purple': 1, '20::only': 1 });
  });

  it('flags lines that can no longer be ordered once the catalog is final (AW-083)', () => {
    const cart = { 14: 1, 999: 2, 40: 1, '1::purple': 3 };
    const known = [{ id: 999, sku: 'AW-OLD', name: 'Old product', variants: [] }];
    const items = resolveCartItems(cart, P, { known });
    expect(items.map((i) => [i.lineKey, i.unavailable, i.name, i.sku, i.qty])).toEqual([
      ['14', null, 'Kite', 'AW-KITE', 1],
      ['40', 'product', 'Off', 'AW-OFF', 1],
      ['999', 'product', 'Old product', 'AW-OLD', 2],
      ['1::purple', 'variant', 'Cigarillos — Purple', 'AW-SS', 3],
    ]);
    expect(items.filter((i) => i.unavailable).every((i) => i.listPrice === null && !i.needsVariant)).toBe(true);
    expect(resolveCartItems({ 12345: 1 }, P)[0]).toMatchObject({ name: 'Product #12345', sku: '', unavailable: 'product' });
    // While the live catalog loads, lines it may still know wait.
    expect(resolveCartItems(cart, P, { settled: false }).map((i) => i.lineKey)).toEqual(['14']);
  });

  it('returns the same object when nothing changes', () => {
    const cart = { 14: 2, '1::red': 1 };
    expect(normalizeCart(cart, P)).toBe(cart);
  });
});

describe('SKU entry', () => {
  it('prefers the longest matching base SKU', () => {
    const r = resolveSkuLine(P, 'aw-ss-mini-red');
    expect(r.status).toBe('ok');
    expect(r.product.id).toBe(30);
  });

  it('asks for a variant when a multi-variant product is entered by its bare SKU', () => {
    expect(resolveSkuLine(P, 'AW-SS').status).toBe('choose-variant');
  });

  it('reports empty input', () => {
    expect(resolveSkuLine(P, '  ').status).toBe('empty');
  });
});
