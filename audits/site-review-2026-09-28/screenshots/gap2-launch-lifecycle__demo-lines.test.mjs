import test from 'node:test';
import assert from 'node:assert/strict';
import { lineKey, parseLineKey, normalizeCart, resolveCartItems, resolveSkuLine, variantSku } from './src/lib/lines.js';
const P = [
  { id: 1, sku: 'AW-SS', name: 'Swisher Sweets cigarillos', variants: ['Diamond', 'Red'], price: 10 },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [], price: 5 },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'], price: 3 },
  { id: 30, sku: 'AW-SS-MINI', name: 'Mini', variants: ['Red'], price: 4 },
];
test('lineKey round-trips', () => { assert.equal(lineKey(1, 'White grape'), '1::white-grape'); assert.deepEqual(parseLineKey('1::white-grape'), { productId: 1, variantSlug: 'white-grape' }); });
test('legacy {id:qty} cart from the old site: multi-variant lines stay bare (blocking)', () => {
  const items = resolveCartItems(normalizeCart({ '1': 3, '14': 1, '20': 2 }, P), P);
  assert.deepEqual(items.map(i => [i.lineKey, i.needsVariant, i.qty]), [['1', true, 3], ['14', false, 1], ['20::only', false, 2]]);
});
test('non-object stored carts do not create lines', () => { assert.deepEqual(normalizeCart(null, P), {}); assert.deepEqual(normalizeCart([5], P), {}); });
test('SKU resolution prefers the longest base', () => { const r = resolveSkuLine(P, 'aw-ss-mini-red'); assert.equal(r.status, 'ok'); assert.equal(r.product.id, 30); });
test('bare SKU of a multi-variant product asks for a variant', () => { assert.equal(resolveSkuLine(P, 'AW-SS').status, 'choose-variant'); });
test('variant SKU suffix', () => { assert.equal(variantSku('AW-SS', 'White grape'), 'AW-SS-WHITE-GRAPE'); });
