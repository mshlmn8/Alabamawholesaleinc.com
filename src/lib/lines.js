// Cart and order lines are keyed by product plus variant. A product with more
// than one variant cannot be added as a bare parent id.

export function variantList(product) {
  const raw = product?.variants;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

export function variantSlug(label) {
  const slug = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'variant';
}

export function lineKey(productId, variantLabel) {
  if (variantLabel == null || String(variantLabel).trim() === '') return String(productId);
  return `${productId}::${variantSlug(variantLabel)}`;
}

export function parseLineKey(key) {
  const raw = String(key);
  const sep = raw.indexOf('::');
  if (sep === -1) return { productId: Number(raw), variantSlug: null };
  return { productId: Number(raw.slice(0, sep)), variantSlug: raw.slice(sep + 2) || null };
}

export function requiresVariantChoice(product) {
  return variantList(product).length > 1;
}

export function variantSku(sku, variantLabel) {
  if (!variantLabel) return sku;
  const suffix = String(variantLabel).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return suffix ? `${sku}-${suffix}` : sku;
}

export function canonicalVariant(product, slugOrLabel) {
  if (!slugOrLabel) return null;
  const needle = variantSlug(slugOrLabel);
  return variantList(product).find((label) => variantSlug(label) === needle) || null;
}

export function normalizeSku(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-');
}

// Resolves a typed SKU against the catalog. Exact product codes win; otherwise
// BASE-SUFFIX is read as a variant SKU when the suffix names one of the base
// product's variants. `choice` carries the buyer's answers when a code is
// ambiguous: the catalog has a few duplicate SKUs, and a bare SKU of a
// multi-variant product still needs a variant.
export function resolveSkuLine(products, sku, choice = {}) {
  const code = normalizeSku(sku);
  if (!code) return { status: 'empty', code };
  const active = products.filter((p) => p.active !== false);

  let candidates = active
    .filter((p) => normalizeSku(p.sku) === code)
    .map((product) => ({ product, variant: null }));
  if (candidates.length === 0) {
    const hits = [];
    for (const product of active) {
      const base = normalizeSku(product.sku);
      if (!code.startsWith(`${base}-`)) continue;
      const variant = canonicalVariant(product, code.slice(base.length + 1));
      if (variant) hits.push({ product, variant });
    }
    // AW-SS-MINI-RED belongs to AW-SS-MINI, not to AW-SS with a "mini-red" variant.
    const longest = Math.max(0, ...hits.map((h) => normalizeSku(h.product.sku).length));
    candidates = hits.filter((h) => normalizeSku(h.product.sku).length === longest);
  }
  if (candidates.length === 0) return { status: 'not-found', code };

  let pick = candidates[0];
  if (candidates.length > 1) {
    pick = candidates.find((c) => Number(c.product.id) === Number(choice.productId));
    if (!pick) return { status: 'choose-product', code, candidates };
  }

  const variants = variantList(pick.product);
  let variant = pick.variant || (variants.length === 1 ? variants[0] : null);
  if (!variant && variants.length > 1) {
    variant = canonicalVariant(pick.product, choice.variant);
    if (!variant) return { status: 'choose-variant', code, product: pick.product, variants };
  }
  return { status: 'ok', code, product: pick.product, variant };
}

// Maps a saved order's lines back onto the current catalog. Products that are
// gone are reported by name. A multi-variant product whose saved variant no
// longer matches comes back as a bare line so the buyer chooses again in the
// cart, the same way an unfinished product-page add is handled.
export function linesFromOrder(order, products) {
  const lines = [];
  const unavailable = [];
  let needsVariant = 0;
  for (const item of order?.order_items || []) {
    const qty = Math.floor(Number(item.qty));
    if (!(qty > 0)) continue;
    let product = products.find((p) => Number(p.id) === Number(item.product_id)) || null;
    if (product?.active === false) product = null;
    let variant = null;
    if (product) {
      variant = canonicalVariant(product, item.variant);
      if (!variant) {
        const base = normalizeSku(product.sku);
        const code = normalizeSku(item.sku);
        if (code.startsWith(`${base}-`)) variant = canonicalVariant(product, code.slice(base.length + 1));
      }
    } else if (item.product_id == null) {
      const res = resolveSkuLine(products, item.sku);
      if (res.status === 'ok') ({ product, variant } = res);
    }
    if (!product) {
      unavailable.push(item.product_name || item.sku || 'Unknown item');
      continue;
    }
    const variants = variantList(product);
    if (!variant && variants.length === 1) variant = variants[0];
    if (!variant && variants.length > 1) needsVariant += 1;
    lines.push({ productId: product.id, variant, qty });
  }
  return { lines, unavailable, needsVariant };
}

// Re-keys stored lines to their canonical key: a bare id of a one-variant
// product gets its variant, and variant slugs follow the catalog's labels.
// Lines the catalog does not know (a product that was deactivated or has not
// loaded yet, a variant that was renamed) are kept as they are, so the cart
// can flag them instead of dropping them without a word (AW-083). Returns the
// same object when nothing changes.
export function normalizeCart(cart, products) {
  const source = cart && typeof cart === 'object' && !Array.isArray(cart) ? cart : {};
  const next = {};
  const add = (key, n) => { next[key] = (next[key] || 0) + n; };
  for (const [key, qty] of Object.entries(source)) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) continue;
    const { productId, variantSlug: slug } = parseLineKey(key);
    const product = products.find((p) => Number(p.id) === productId);
    const variants = variantList(product);
    const variant = !product || product.active === false ? null
      : slug ? canonicalVariant(product, slug) : (variants.length === 1 ? variants[0] : null);
    const known = product && product.active !== false && (slug ? !!variant : variants.length <= 1);
    add(known ? lineKey(product.id, variant) : key, n);
  }
  const same = Object.keys(source).length === Object.keys(next).length
    && Object.entries(next).every(([key, qty]) => source[key] === qty);
  return same ? source : next;
}

// 'white-grape' -> 'White grape', for a variant the catalog no longer lists.
const labelFromSlug = (slug) => {
  const text = String(slug).replace(/-+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

// A line the cart keeps but cannot order (AW-083): its product is no longer
// in the catalog ('product') or its variant is not offered any more
// ('variant'). `known` supplies the name of a product that has left the
// live catalog (the bundled catalog still lists it).
function unavailableLine(key, productId, qty, product, variantLabel, reason) {
  const name = product ? product.name : `Product #${productId}`;
  return {
    lineKey: key,
    productId,
    variant: null,
    needsVariant: false,
    unavailable: reason,
    name: variantLabel ? `${name} — ${variantLabel}` : name,
    sku: product?.sku || '',
    qty,
    img: product?.img || null,
  };
}

// The cart's lines against the catalog, in stored order. Each item is
// { lineKey, productId, variant, needsVariant, unavailable, name, sku, qty,
// img }. Prices are not part of the catalog (AW-003); cart.js adds them.
//   needsVariant  a bare line of a product with several variants (a reorder
//                 that lost its variant); the buyer chooses one
//   unavailable   null, or 'product' / 'variant' for a line that can no
//                 longer be ordered (AW-083)
// Options:
//   settled  false while the live catalog is still loading: lines it may yet
//            know are left out for now instead of being flagged
//   known    other product lists to take an unavailable product's name from
export function resolveCartItems(cart, products, { settled = true, known = [] } = {}) {
  const find = (list, id) => list.find((p) => Number(p.id) === id) || null;
  return Object.entries(cart || {}).flatMap(([key, qty]) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return [];
    const { productId, variantSlug: slug } = parseLineKey(key);
    const listed = find(products, productId);
    const product = listed?.active === false ? null : listed;
    if (!product) {
      if (!settled) return [];
      const old = listed || find(known, productId);
      const label = slug ? ((old && canonicalVariant(old, slug)) || labelFromSlug(slug)) : null;
      return [unavailableLine(key, productId, n, old, label, 'product')];
    }
    const variants = variantList(product);
    if (variants.length > 1 && !slug) {
      return [{
        lineKey: key,
        productId: product.id,
        variant: null,
        needsVariant: true,
        unavailable: null,
        name: product.name,
        sku: product.sku,
        qty: n,
        img: product.img,
      }];
    }
    const variant = slug ? canonicalVariant(product, slug) : (variants.length === 1 ? variants[0] : null);
    if (slug && !variant) {
      if (!settled) return [];
      const old = find(known, productId);
      return [unavailableLine(key, product.id, n, product, (old && canonicalVariant(old, slug)) || labelFromSlug(slug), 'variant')];
    }
    return [{
      lineKey: lineKey(product.id, variant),
      productId: product.id,
      variant,
      needsVariant: false,
      unavailable: null,
      name: variant ? `${product.name} — ${variant}` : product.name,
      sku: variantSku(product.sku, variant),
      qty: n,
      img: product.img,
    }];
  });
}
