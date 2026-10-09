// A product's photo on its card and its page: the responsive Picture, or
// "Photo coming soon" (AW-029) when there is no photo or it fails to load
// (AW-192). The sell-unit badge (.pack-badge) is hidden next to the
// placeholder in index.css.
import { Picture } from './Picture.jsx';
import { MissingPhoto } from './MissingPhoto.jsx';

export function ProductPhoto({ product, sizes, priority = false }) {
  if (!product.picture?.src) return <MissingPhoto name={product.name} />;
  return (
    <Picture picture={product.picture} alt={product.name} sizes={sizes} priority={priority}
             fallback={<MissingPhoto name={product.name} />} />
  );
}
