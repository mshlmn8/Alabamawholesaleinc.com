// One brand's products. The home strip and the brands page both open it.

import { Breadcrumbs, HOME_CRUMB } from '../components/Breadcrumbs.jsx';
import { BackToTop } from '../components/BackToTop.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { PricingNotice } from '../components/PricingNotice.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { brandBySlug } from '../lib/brands.js';
import { productCount } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { Link } from '../lib/router.js';

export function BrandPage({ slug, products, profile, account, isApprovedBuyer, onLoginClick, onApplyClick, ...cardProps }) {
  const brand = brandBySlug(products, slug);
  const items = [...(brand?.products || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
  return (
    <section className="support-page collection-page">
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Brands', to: '/brands' }, { label: brand?.label || 'Brand' }]} />
        <h1>{brand?.label || 'Brand'}</h1>
        {brand && <p>{`${productCount(items.length)} for licensed retailers.`}</p>}
      </div>
      <PricingNotice profile={profile} account={account} isApprovedBuyer={isApprovedBuyer} onLoginClick={onLoginClick} onApplyClick={onApplyClick} />
      {items.length > 0 ? (
        <>
          <h2 className="sr-only">Products</h2>
          <div className="card-grid category-card-grid">
            {items.map((p, i) => (
              <ProductCard key={p.id} p={p} {...cardProps} profile={profile} account={account} isApprovedBuyer={isApprovedBuyer}
                           onLoginClick={onLoginClick} eager={i < 3} priority={i === 0} sizes={SIZES.categoryCard} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="No products for this brand" className="is-boxed" actions={<Link className="button" to="/brands">All brands</Link>}>
          Browse the other brands in the meantime.
        </EmptyState>
      )}
      <BackToTop />
    </section>
  );
}
