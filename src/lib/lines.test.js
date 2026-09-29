// Cart and order line helpers (AW-209). Fixtures carry no prices.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AXIS, informativeVariant, isVariantAvailable, lineKey, parseLineKey, normalizeCart, resolveCartItems, resolveSkuLine,
  variantAxis, variantCount, variantSku, requiresVariantChoice,
} from './lines.js';

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
    expect(items.filter((i) => i.unavailable).every((i) => !i.needsVariant)).toBe(true);
    // The catalog carries no prices (AW-003), so neither do resolved lines.
    expect(items.every((i) => !('price' in i) && !('listPrice' in i))).toBe(true);
    expect(resolveCartItems({ 12345: 1 }, P)[0]).toMatchObject({ name: 'Product #12345', sku: '', unavailable: 'product' });
    // While the live catalog loads, lines it may still know wait.
    expect(resolveCartItems(cart, P, { settled: false }).map((i) => i.lineKey)).toEqual(['14']);
  });

  it('returns the same object when nothing changes', () => {
    const cart = { 14: 2, '1::red': 1 };
    expect(normalizeCart(cart, P)).toBe(cart);
  });
});

describe('variants (AW-332, AW-128, AW-233, AW-030, AW-031)', () => {
  it('counts variants from the list itself', () => {
    expect(P.map(variantCount)).toEqual([2, 0, 1, 1, 0]);
    expect(variantCount({ variants: [' Red ', '', 'Blue'] })).toBe(2);
    expect(variantCount({ variants: null })).toBe(0);
    expect(variantCount(null)).toBe(0);
  });

  it('names the axis, with a neutral default', () => {
    expect(variantAxis({ variantAxis: 'Flavor' })).toEqual({ label: 'Flavor', noun: 'flavor', plural: 'flavors' });
    expect(variantAxis({ variantAxis: 'Size' })).toEqual({ label: 'Size', noun: 'size', plural: 'sizes' });
    expect(variantAxis({ variantAxis: 'Variety' })).toEqual({ label: 'Variety', noun: 'variety', plural: 'varieties' });
    expect(variantAxis({ variantAxis: ' format ' }).label).toBe('Format');
    expect(variantAxis({ variantAxis: 'Scent' })).toBe(DEFAULT_AXIS);
    expect(variantAxis({})).toEqual({ label: 'Variety', noun: 'variant', plural: 'variants' });
    expect(variantAxis(null)).toBe(DEFAULT_AXIS);
  });

  it('checks availability by label, like line keys', () => {
    const p = { variants: ['1 gal', '2gal', '5 gal'], unavailableVariants: ['5 Gal'] };
    expect(isVariantAvailable(p, '1 gal')).toBe(true);
    expect(isVariantAvailable(p, '5 gal')).toBe(false);
    expect(isVariantAvailable(p, null)).toBe(true);
    expect(isVariantAvailable({ variants: ['Red'] }, 'Red')).toBe(true);
    expect(isVariantAvailable({ variants: ['Red'], unavailableVariants: null }, 'Red')).toBe(true);
  });

  it('shows a lone variant only when the name doesn’t already say it', () => {
    expect(informativeVariant({ name: 'Garcia y Vega cigars', variants: ['Green'] })).toBe('Green');
    expect(informativeVariant({ name: 'RAW tips', variants: ['Tips'] })).toBeNull();
    expect(informativeVariant({ name: 'High Hemp organic wraps', variants: ['Organic'] })).toBeNull();
    expect(informativeVariant({ name: 'Rips bags', variants: ['Grape'] })).toBe('Grape');
    expect(informativeVariant(P[0])).toBeNull();
    expect(informativeVariant(P[1])).toBeNull();
  });

  it('flags a line whose variant is marked not available, and carries the sell unit', () => {
    const products = [
      { id: 356, sku: 'AW-GAS', name: 'Gas cans', variants: ['1 gal', '5 gal'], unavailableVariants: ['5 gal'], sellUnit: '' },
      { id: 242, sku: 'AW-TUBES', name: 'Tubes', variants: [], sellUnit: 'box of 200' },
    ];
    const items = resolveCartItems({ '356::1-gal': 1, '356::5-gal': 2, 242: 3 }, products);
    // (Integer keys come first in a JS object.)
    expect(items.map((i) => [i.lineKey, i.unavailable, i.name, i.sku, i.sellUnit])).toEqual([
      ['242', null, 'Tubes', 'AW-TUBES', 'box of 200'],
      ['356::1-gal', null, 'Gas cans — 1 gal', 'AW-GAS-1-GAL', ''],
      ['356::5-gal', 'variant', 'Gas cans — 5 gal', 'AW-GAS-5-GAL', ''],
    ]);
    expect(items[2]).toMatchObject({ variant: '5 gal', needsVariant: false });
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
