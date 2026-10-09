// A product's photo on its card and its page: the responsive Picture, or
// "Photo coming soon" (AW-029) when there is no photo or it fails to load
// (AW-192). The sell-unit badge (.pack-badge) is hidden next to the
// placeholder in index.css. Lazy unless the caller says otherwise: the first
// row of a department page is eager, its first photo `priority` (AW-323).
// A photo other rows share (a sibling's size, pack or format) is described
// as representative (AW-136, photoAlt).
import { Picture } from './Picture.jsx';
import { MissingPhoto } from './MissingPhoto.jsx';
import { photoAlt } from '../lib/format.js';

export function ProductPhoto({ product, sizes, priority = false, loading = 'lazy' }) {
  if (!product.picture?.src) return <MissingPhoto name={product.name} />;
  return (
    <Picture picture={product.picture} alt={photoAlt(product)} sizes={sizes} priority={priority} loading={loading}
             fallback={<MissingPhoto name={product.name} />} />
  );
}
