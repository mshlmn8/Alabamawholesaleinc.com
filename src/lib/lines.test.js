// Cart and order line helpers (AW-209). Fixtures carry no prices.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AXIS, canonicalVariant, informativeVariant, isVariantAvailable, lineKey, linesFromOrder, matchVariant, normalizeCart,
  normalizeSku, parseLineKey, resolveCartItems, resolveSkuLine, variantAxis, variantCount, variantSku, requiresVariantChoice,
} from './lines.js';
import { SKU_ALIASES, VARIANT_ALIASES } from '../data/catalogAliases.js';
import { PRODUCTS } from '../data/products.js';

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

  it('carries each line’s department, for the quote form’s license fields (AW-014)', () => {
    const withCat = [{ ...P[0], cat: 'TOBACCO' }, { ...P[1], cat: 'CANDIES' }, { ...P[4], cat: 'NOVELTIES' }];
    const items = resolveCartItems({ 1: 1, '1::red': 1, 14: 1, 40: 1, 999: 1 }, withCat);
    expect(items.map((i) => [i.lineKey, i.cat])).toEqual([
      ['1', 'TOBACCO'], ['14', 'CANDIES'], ['40', 'NOVELTIES'], ['999', null], ['1::red', 'TOBACCO'],
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

// Corrected SKUs and variant labels keep resolving (AW-135, AW-138, AW-126).
// Each alias works both ways: the bundle has the new values, and the live
// catalog keeps the old ones until the owner applies
// 20260928122000_catalog_corrections.sql. The fixtures use the real product
// ids, because aliases are kept per product.
describe('catalog corrections (AW-135, AW-138, AW-126)', () => {
  // The old #60 label, rebuilt from its alias key so it is spelled out only there.
  const OLD_60_KEY = Object.keys(VARIANT_ALIASES[60])[0];
  const OLD_60_LABEL = `${OLD_60_KEY[0].toUpperCase()}${OLD_60_KEY.slice(1).replace(/-/g, ' ')}`;

  const NEW = [
    { id: 36, sku: 'AW-NOW-AND-LATER', name: 'Now and Later chews', variants: ['Grape', 'Cherry'] },
    { id: 60, sku: 'AW-GEEKBAR-15K', name: 'Geek Bar Pulse 15K', variants: ['Blue razz ice', 'F*** fab'] },
    { id: 62, sku: 'AW-FOGER-FULL-KIT', name: 'Foger kit', variants: ['Watermelon ice', 'Kiwi dragon berry', 'Mexico mango'] },
    { id: 122, sku: 'AW-4PK-TISSUES', name: 'Bath tissue 4-pack', variants: [] },
    { id: 130, sku: 'AW-BRILLO-BASICS', name: 'Brillo Basics all-purpose cleaner', variants: ['Yellow', 'Orange'] },
    { id: 171, sku: 'AW-HERSHEY', name: "Hershey's bars", variants: ['Cookies, regular', 'Cookies, king size'] },
    { id: 255, sku: 'AW-RAW-PAPERS', name: 'RAW rolling papers', variants: ['Classic 1 1/4', 'Classic king size slim'] },
    { id: 276, sku: 'AW-NOW-AND-LATER-GIANT', name: 'Now and Later Giant Chewy jar', variants: [] },
    { id: 329, sku: 'AW-RAW-TIPS', name: 'RAW tips', variants: [] },
    { id: 367, sku: 'AW-LOOSE-LEAFS-5PK', name: 'LooseLeaf wraps 5-pack', variants: ['Watermelon'] },
  ];
  // The same rows as the live database has them before the data migration.
  const LIVE_OLD = [
    { id: 36, sku: 'AW-NOW-AND-LATER', name: 'Now and Later chews', variants: ['Grape', 'Cherry'] },
    { id: 60, sku: 'AW-GEEKBAR-15K', name: 'Geek Bar Pulse 15K', variants: ['Blue razz ice', OLD_60_LABEL] },
    { id: 62, sku: 'AW-FOGER-FULL-KIT', name: 'Foger kit', variants: ['Watermelon ice Kiwi dragon berry', 'Mexico mango'] },
    { id: 122, sku: 'AW-4PK-TISSUES', name: 'Bath tissue 4-pack', variants: ['Case'] },
    { id: 130, sku: 'AW-BRILLO-BASICS-', name: 'Brillo Basics all-purpose cleaner', variants: ['Yellow', 'Orange'] },
    { id: 171, sku: 'AW-HERSHEY', name: "Hershey's bars", variants: ['Cookies reg', 'Cookies king'] },
    { id: 255, sku: 'AW-RAW-PAPERS', name: 'RAW rolling papers', variants: ['Classic 1 1/4', 'Classic king size slim'] },
    { id: 276, sku: 'AW-NOW-AND-LATER-', name: 'Now and Later Giant Chewy jar', variants: [] },
    { id: 329, sku: 'AW-RAW', name: 'RAW tips', variants: ['Tips'] },
    { id: 367, sku: 'AW-LOOSE-LEAFS-5P', name: 'LooseLeaf wraps 5-pack', variants: ['Watermelon'] },
  ];
  const ok = (res) => [res.status, res.product?.id, res.variant];

  it('normalizes typed codes: case, spaces, doubled and trailing hyphens', () => {
    expect(normalizeSku(' aw-brillo-basics--yellow ')).toBe('AW-BRILLO-BASICS-YELLOW');
    expect(normalizeSku('AW-BRILLO-BASICS-')).toBe('AW-BRILLO-BASICS');
    expect(normalizeSku('aw raw tips')).toBe('AW-RAW-TIPS');
  });

  it('builds variant SKUs without a doubled hyphen', () => {
    expect(variantSku('AW-BRILLO-BASICS-', 'Yellow')).toBe('AW-BRILLO-BASICS-YELLOW');
    expect(variantSku('AW-GEEKBAR-15K', 'F*** fab')).toBe('AW-GEEKBAR-15K-F-FAB');
    expect(variantSku('AW-HERSHEY', 'Cookies, king size')).toBe('AW-HERSHEY-COOKIES-KING-SIZE');
    expect(variantSku('AW-CABLES', 'iPhone (Lightning)')).toBe('AW-CABLES-IPHONE-LIGHTNING');
    expect(variantSku('AW-JOLLY-RANCHER-', null)).toBe('AW-JOLLY-RANCHER-');
  });

  it('finds a product by its old code, and by its new code while the live catalog has the old one', () => {
    for (const catalog of [NEW, LIVE_OLD]) {
      expect(ok(resolveSkuLine(catalog, 'AW-LOOSE-LEAFS-5P'))).toEqual(['ok', 367, 'Watermelon']);
      expect(ok(resolveSkuLine(catalog, 'AW-LOOSE-LEAFS-5PK'))).toEqual(['ok', 367, 'Watermelon']);
      expect(ok(resolveSkuLine(catalog, 'aw-loose-leafs-5p-watermelon'))).toEqual(['ok', 367, 'Watermelon']);
      expect(ok(resolveSkuLine(catalog, 'AW-LOOSE-LEAFS-5PK-WATERMELON'))).toEqual(['ok', 367, 'Watermelon']);
      expect(ok(resolveSkuLine(catalog, 'AW-RAW'))).toEqual(['ok', 329, catalog === NEW ? null : 'Tips']);
      expect(ok(resolveSkuLine(catalog, 'AW-RAW-TIPS'))).toEqual(['ok', 329, catalog === NEW ? null : 'Tips']);
      // AW-RAW is no bare prefix of the other RAW codes any more.
      expect(ok(resolveSkuLine(catalog, 'AW-RAW-PAPERS-CLASSIC-1-1-4'))).toEqual(['ok', 255, 'Classic 1 1/4']);
    }
  });

  it('reads the double-hyphen and trailing-hyphen codes (AW-135)', () => {
    for (const catalog of [NEW, LIVE_OLD]) {
      expect(ok(resolveSkuLine(catalog, 'AW-BRILLO-BASICS--YELLOW'))).toEqual(['ok', 130, 'Yellow']);
      expect(ok(resolveSkuLine(catalog, 'AW-BRILLO-BASICS-YELLOW'))).toEqual(['ok', 130, 'Yellow']);
      expect(resolveSkuLine(catalog, 'AW-BRILLO-BASICS').status).toBe('choose-variant');
      expect(resolveSkuLine(catalog, 'AW-BRILLO-BASICS-').status).toBe('choose-variant');
      // #276's old code ended in a hyphen; without it, it is #36's code.
      expect(ok(resolveSkuLine(catalog, 'AW-NOW-AND-LATER-'))).toEqual(['ok', 276, null]);
      expect(ok(resolveSkuLine(catalog, 'AW-NOW-AND-LATER-GIANT'))).toEqual(['ok', 276, null]);
      expect(resolveSkuLine(catalog, 'AW-NOW-AND-LATER')).toMatchObject({ status: 'choose-variant', product: { id: 36 } });
      expect(ok(resolveSkuLine(catalog, 'AW-NOW-AND-LATER-GRAPE'))).toEqual(['ok', 36, 'Grape']);
    }
  });

  it('reads old variant codes, including the old #60 flavor and a variant that was taken off', () => {
    expect(ok(resolveSkuLine(NEW, `AW-GEEKBAR-15K-${OLD_60_KEY.toUpperCase()}`))).toEqual(['ok', 60, 'F*** fab']);
    expect(ok(resolveSkuLine(LIVE_OLD, 'AW-GEEKBAR-15K-F-FAB'))).toEqual(['ok', 60, OLD_60_LABEL]);
    expect(ok(resolveSkuLine(NEW, 'AW-HERSHEY-COOKIES-KING'))).toEqual(['ok', 171, 'Cookies, king size']);
    expect(ok(resolveSkuLine(LIVE_OLD, 'AW-HERSHEY-COOKIES-KING-SIZE'))).toEqual(['ok', 171, 'Cookies king']);
    expect(ok(resolveSkuLine(NEW, 'AW-4PK-TISSUES-CASE'))).toEqual(['ok', 122, null]);
    expect(ok(resolveSkuLine(LIVE_OLD, 'AW-4PK-TISSUES'))).toEqual(['ok', 122, 'Case']);
  });

  it('matches variants by alias in both directions', () => {
    expect(matchVariant(NEW[1], OLD_60_KEY)).toEqual({ found: true, variant: 'F*** fab' });
    expect(matchVariant(LIVE_OLD[1], 'F*** fab')).toEqual({ found: true, variant: OLD_60_LABEL });
    expect(canonicalVariant(NEW[5], 'Cookies king')).toBe('Cookies, king size');
    expect(canonicalVariant(LIVE_OLD[5], 'cookies-king-size')).toBe('Cookies king');
    // A variant aliased to "no variant" on a product that has none now.
    expect(matchVariant(NEW[3], 'case')).toEqual({ found: true, variant: null });
    // ...and only there: with two or more variants it still needs a choice.
    expect(matchVariant({ ...NEW[3], variants: ['Big', 'Small'] }, 'case')).toEqual({ found: false, variant: null });
    // #62's merged chip has no single equivalent.
    expect(matchVariant(NEW[2], 'watermelon-ice-kiwi-dragon-berry').found).toBe(false);
    expect(matchVariant(NEW[1], 'no-such-flavor').found).toBe(false);
  });

  it('re-keys stored cart lines with old keys, and resolves them without flagging (AW-083)', () => {
    const stored = { [`60::${OLD_60_KEY}`]: 2, '130::yellow': 1, '171::cookies-king': 3, '122::case': 4, '329::tips': 5 };
    const cart = normalizeCart(stored, NEW);
    expect(cart).toEqual({ '60::f-fab': 2, '130::yellow': 1, '171::cookies-king-size': 3, 122: 4, 329: 5 });
    const items = resolveCartItems(stored, NEW);
    expect(items.map((i) => [i.lineKey, i.unavailable, i.needsVariant, i.name, i.sku])).toEqual([
      ['60::f-fab', null, false, 'Geek Bar Pulse 15K — F*** fab', 'AW-GEEKBAR-15K-F-FAB'],
      ['130::yellow', null, false, 'Brillo Basics all-purpose cleaner — Yellow', 'AW-BRILLO-BASICS-YELLOW'],
      ['171::cookies-king-size', null, false, "Hershey's bars — Cookies, king size", 'AW-HERSHEY-COOKIES-KING-SIZE'],
      ['122', null, false, 'Bath tissue 4-pack', 'AW-4PK-TISSUES'],
      ['329', null, false, 'RAW tips', 'AW-RAW-TIPS'],
    ]);
    // Normalizing again changes nothing.
    expect(normalizeCart(cart, NEW)).toBe(cart);
  });

  it('keeps lines keyed by the bundle’s new labels working against the live catalog’s old ones', () => {
    const stored = { '60::f-fab': 1, '171::cookies-king-size': 2, 122: 3, 329: 1, '130::yellow': 1 };
    expect(normalizeCart(stored, LIVE_OLD)).toEqual({ [`60::${OLD_60_KEY}`]: 1, '171::cookies-king': 2, '122::case': 3, '329::tips': 1, '130::yellow': 1 });
    const items = resolveCartItems(stored, LIVE_OLD);
    expect(items.every((i) => !i.unavailable && !i.needsVariant)).toBe(true);
    expect(items.find((i) => i.productId === 130).sku).toBe('AW-BRILLO-BASICS-YELLOW');
    expect(items.find((i) => i.productId === 171).variant).toBe('Cookies king');
  });

  it('flags a line saved with #62’s merged chip so the buyer chooses again', () => {
    const [item] = resolveCartItems({ '62::watermelon-ice-kiwi-dragon-berry': 2 }, NEW, { known: LIVE_OLD });
    expect(item).toMatchObject({ unavailable: 'variant', qty: 2, name: 'Foger kit — Watermelon ice Kiwi dragon berry' });
  });

  it('never shows the old #60 label for a line it cannot resolve', () => {
    const gone = [{ ...NEW[1], variants: ['Blue razz ice'] }];
    const [item] = resolveCartItems({ [`60::${OLD_60_KEY}`]: 1 }, gone, { known: NEW });
    expect(item).toMatchObject({ unavailable: 'variant', name: 'Geek Bar Pulse 15K — F*** fab' });
  });

  it('reorders an order saved with old SKUs and labels (AccountPage Reorder)', () => {
    const order = {
      order_items: [
        { product_id: 60, variant: OLD_60_LABEL, sku: `AW-GEEKBAR-15K-${OLD_60_KEY.toUpperCase()}`, qty: 2 },
        { product_id: 130, variant: null, sku: 'AW-BRILLO-BASICS--YELLOW', qty: 1 },
        { product_id: 171, variant: 'Cookies king', sku: 'AW-HERSHEY-COOKIES-KING', qty: 3 },
        { product_id: 122, variant: 'Case', sku: 'AW-4PK-TISSUES-CASE', qty: 4 },
        { product_id: 329, variant: 'Tips', sku: 'AW-RAW-TIPS', qty: 5 },
        { product_id: null, variant: null, sku: 'AW-LOOSE-LEAFS-5P-WATERMELON', product_name: 'LooseLeaf wraps 5-pack — Watermelon', qty: 6 },
        { product_id: 62, variant: 'Watermelon ice Kiwi dragon berry', sku: 'AW-FOGER-FULL-KIT-WATERMELON-ICE-KIWI-DRAGON-BERRY', qty: 1 },
      ],
    };
    expect(linesFromOrder(order, NEW)).toEqual({
      lines: [
        { productId: 60, variant: 'F*** fab', qty: 2 },
        { productId: 130, variant: 'Yellow', qty: 1 },
        { productId: 171, variant: 'Cookies, king size', qty: 3 },
        { productId: 122, variant: null, qty: 4 },
        { productId: 329, variant: null, qty: 5 },
        { productId: 367, variant: 'Watermelon', qty: 6 },
        { productId: 62, variant: null, qty: 1 },
      ],
      unavailable: [],
      needsVariant: 1,
    });
    // An order placed after the correction, reordered while the live catalog is still old.
    const newer = { order_items: [
      { product_id: 60, variant: 'F*** fab', sku: 'AW-GEEKBAR-15K-F-FAB', qty: 1 },
      { product_id: 171, variant: 'Cookies, king size', sku: 'AW-HERSHEY-COOKIES-KING-SIZE', qty: 1 },
    ] };
    expect(linesFromOrder(newer, LIVE_OLD).lines).toEqual([
      { productId: 60, variant: OLD_60_LABEL, qty: 1 },
      { productId: 171, variant: 'Cookies king', qty: 1 },
    ]);
  });
});

describe('the bundled catalog and its aliases', () => {
  it('finds every old code, and every old variant slug, on the product it became', () => {
    for (const [oldSku, newSku] of Object.entries(SKU_ALIASES)) {
      const res = resolveSkuLine(PRODUCTS, oldSku);
      expect([oldSku, res.product?.sku]).toEqual([oldSku, newSku]);
      expect(['ok', 'choose-variant']).toContain(res.status);
    }
    for (const [id, map] of Object.entries(VARIANT_ALIASES)) {
      const product = PRODUCTS.find((p) => p.id === Number(id));
      for (const [oldSlug, label] of Object.entries(map)) {
        expect([id, oldSlug, matchVariant(product, oldSlug)]).toEqual([id, oldSlug, { found: true, variant: label }]);
        // The old variant code too, e.g. AW-HERSHEY-COOKIES-KING.
        const res = resolveSkuLine(PRODUCTS, `${product.sku}-${oldSlug.toUpperCase()}`);
        expect([id, oldSlug, res.status, res.product?.id, res.variant]).toEqual([id, oldSlug, 'ok', product.id, label]);
      }
    }
  });
});

describe('stored keys that name the same line', () => {
  it('come back as one item with the quantities added, before storage is merged', () => {
    const products = [
      { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
      { id: 171, sku: 'AW-HERSHEY', name: "Hershey's bars", variants: ['Cookies reg', 'Cookies king'] },
    ];
    const items = resolveCartItems({ 20: 1, '20::only': 2, '171::cookies-king': 3, '171::cookies-king-size': 4 }, products);
    expect(items.map((i) => [i.lineKey, i.qty, i.variant])).toEqual([
      ['20::only', 3, 'Only'],
      ['171::cookies-king', 7, 'Cookies king'],
    ]);
    expect(normalizeCart({ 20: 1, '20::only': 2, '171::cookies-king': 3, '171::cookies-king-size': 4 }, products))
      .toEqual({ '20::only': 3, '171::cookies-king': 7 });
  });
});
