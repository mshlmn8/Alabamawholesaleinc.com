// Live catalog rows in the shape the storefront uses (AW-204), shared by the
// CatalogProvider (src/lib/catalog.jsx) and the build, which describes each
// product page in its own head tags (scripts/build-route-heads.mjs, AW-181).
// No React and no Supabase client, so Vite's SSR loader can run it in Node.

import { productImage, sharedImageFiles } from './images.js';
import { PRODUCTS as STATIC_PRODUCTS } from '../data/products.js';
import { currentImageFile } from '../data/catalogAliases.js';

const STATIC_BY_ID = new Map(STATIC_PRODUCTS.map((p) => [Number(p.id), p]));

// Live rows in the shape the storefront uses. Rows saved before the product
// copy columns were filled (supabase/migrations/20260927120000_product_copy.sql
// adds them with '' as the default) take the bundled copy's description and
// sell unit for the same id, and a row without a variant axis (a database
// from before 20261009110000, or a row nobody set one on) takes the bundled
// copy's. Without unavailable_variants every variant is available, and
// without featured_rank a product has no homepage rank. A price
// that came along (select('*') on a database from before 20261009100000) is
// dropped: prices come only from usePrices(); so is the old flavors count
// (AW-332: variantCount() in lines.js counts the variants).
export function hydrateProducts(rows, bundled = STATIC_BY_ID) {
  // A row may still name a photo by a file name that has since changed
  // (AW-290; until 20261010131000_photo_filenames.sql is applied).
  const shared = sharedImageFiles(rows.map((row) => ({ img: currentImageFile(row?.img) })));
  return rows.map((row) => {
    const p = { ...row };
    delete p.price;
    delete p.flavors;
    const local = bundled.get(Number(p.id));
    const img = currentImageFile(p.img);
    return {
      ...p,
      variants: Array.isArray(p.variants) ? p.variants : [],
      variantAxis: p.variant_axis || p.variantAxis || local?.variantAxis || '',
      unavailableVariants: Array.isArray(p.unavailable_variants) ? p.unavailable_variants : [],
      // Staff can show no description at all (AW-023): an empty one alone
      // takes the bundled copy's, as rows saved before 20260927120000 have ''.
      description: p.description_hidden === true ? '' : (p.description || local?.description || ''),
      descriptionHidden: p.description_hidden === true,
      sellUnit: p.sell_unit || p.sellUnit || local?.sellUnit || '',
      // Staff's homepage rank (AW-119); null without one or before
      // 20261010120000. Read by src/lib/merchandising.js.
      featuredRank: Number.isInteger(p.featured_rank) ? p.featured_rank : null,
      // img is a filename in src/assets/products, or a full URL (e.g. Supabase Storage)
      ...productImage(img),
      // Another row uses the same photo file (AW-136).
      sharedPhoto: img != null && shared.has(String(img).trim()),
    };
  });
}
