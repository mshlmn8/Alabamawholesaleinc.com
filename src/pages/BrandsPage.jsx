// Every brand in the catalog, A to Z. The home page shows a few of them;
// Show all opens this page. A brand opens its own products.

import { BackToTop } from '../components/BackToTop.jsx';
import { BrandList } from '../components/BrandList.jsx';
import { brandGroups, catalogBrands } from '../lib/brands.js';
import { PageHead } from './support/SupportShell.jsx';

export function BrandsPage({ products }) {
  const groups = brandGroups(catalogBrands(products));
  return (
    <section className="support-page brands-page">
      <PageHead crumb="Brands" title="Brands">
        <p>Every brand stocked for licensed retailers.</p>
      </PageHead>
      {groups.map(([letter, brands]) => {
        const id = letter === '#' ? 'brands-num' : `brands-${letter}`;
        return (
          <section key={letter} aria-labelledby={id}>
            <h2 className="brand-letter" id={id}>{letter}</h2>
            <BrandList brands={brands} />
          </section>
        );
      })}
      <BackToTop />
    </section>
  );
}
