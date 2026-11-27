// A grid of brand tiles. Each tile opens that brand's products.

import { Picture } from './Picture.jsx';
import { brandPhoto } from '../lib/brands.js';
import { Link } from '../lib/router.js';

const tilePicture = (product) => {
  if (product?.picture?.src) return product.picture;
  if (product?.img) return { src: product.img };
  return null;
};

export function BrandList({ brands }) {
  return (
    <ul className="brand-row">
      {brands.map((brand) => {
        const picture = tilePicture(brandPhoto(brand));
        return (
          <li key={brand.slug}>
            <Link className="brand-tile" to={{ page: 'brand', slug: brand.slug }}>
              {picture && (
                <span className="brand-tile-photo">
                  <Picture picture={picture} alt="" sizes="48px" />
                </span>
              )}
              <span className="brand-tile-name">{brand.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
