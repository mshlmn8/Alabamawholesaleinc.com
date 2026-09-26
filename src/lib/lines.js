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
        qty: n,
        img: product.img,
        listPrice: Number(product.price),
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
      qty: n,
      img: product.img,
      listPrice: Number(product.price),
    }];
  });
}
