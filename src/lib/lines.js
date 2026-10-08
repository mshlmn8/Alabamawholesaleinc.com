// Cart and order lines are keyed by product plus variant. A product with more
// than one variant cannot be added as a bare parent id.

export function variantList(product) {
  const raw = product?.variants;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v && typeof v === 'object' ? v.label || v.name || '' : v).trim()).filter(Boolean);
}

// Per-variant price when the owner has supplied one. Otherwise the parent list
// price, so nothing on the page changes until those prices exist.
// TODO(owner): Supply the price and availability for each size and pack-count variant. (AW-030)
export function variantPrice(product, label) {
  const table = product?.variantPrices || product?.variant_prices;
  if (label && table && typeof table === 'object' && !Array.isArray(table)) {
    const raw = table[label];
    const n = Number(raw);
    if (raw != null && raw !== '' && Number.isFinite(n)) return n;
  }
  return Number(product?.price);
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

export function normalizeCart(cart, products) {
  const source = cart && typeof cart === 'object' ? cart : {};
  const next = {};
  for (const [key, qty] of Object.entries(source)) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) continue;
    const { productId, variantSlug: slug } = parseLineKey(key);
    const product = products.find((p) => Number(p.id) === productId);
    if (!product || product.active === false) continue;
    const variants = variantList(product);
    if (variants.length > 1 && !slug) {
      next[key] = n;
      continue;
    }
    const variant = slug ? canonicalVariant(product, slug) : (variants.length === 1 ? variants[0] : null);
    if (slug && !variant) continue;
    const canonical = lineKey(product.id, variant);
    next[canonical] = (next[canonical] || 0) + n;
  }
  const same = Object.keys(source).length === Object.keys(next).length
    && Object.entries(next).every(([key, qty]) => source[key] === qty);
  return same ? source : next;
}

export function resolveCartItems(cart, products) {
  return Object.entries(cart || {}).flatMap(([key, qty]) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return [];
    const { productId, variantSlug: slug } = parseLineKey(key);
    const product = products.find((p) => Number(p.id) === productId);
    if (!product || product.active === false) return [];
    const variants = variantList(product);
    if (variants.length > 1 && !slug) {
      return [{
        lineKey: key,
        productId: product.id,
        variant: null,
        needsVariant: true,
        name: product.name,
        sku: product.sku,
        cat: product.cat,
        sub: product.sub,
        qty: n,
        img: product.img,
        listPrice: variantPrice(product, null),
        sellUnit: product.sellUnit || '',
      }];
    }
    const variant = slug ? canonicalVariant(product, slug) : (variants.length === 1 ? variants[0] : null);
    if (slug && !variant) return [];
    return [{
      lineKey: lineKey(product.id, variant),
      productId: product.id,
      variant,
      needsVariant: false,
      name: variant ? `${product.name} — ${variant}` : product.name,
      sku: variantSku(product.sku, variant),
      cat: product.cat,
      sub: product.sub,
      qty: n,
      img: product.img,
      listPrice: variantPrice(product, variant),
      sellUnit: product.sellUnit || '',
    }];
  });
}
