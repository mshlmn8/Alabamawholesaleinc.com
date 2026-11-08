// The product's tag, shown the same way on every card and product page.
import { tagClass, tagLabel } from '../lib/productTags.js';

export function ProductTag({ tag }) {
  const label = tagLabel(tag);
  if (!label) return null;
  return <span className={tagClass(tag)}>{label}</span>;
}
