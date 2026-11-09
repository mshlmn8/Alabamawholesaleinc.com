// A home-page group's full list (new arrivals, hot sellers, bestsellers,
// new deals). The home row shows a few cards; Show all opens this page.

import { collectionByPage } from '../lib/collections.js';
import { productCount } from '../lib/format.js';
import { SIZES } from '../lib/images.js';
import { collectionList } from '../lib/merchandising.js';
import { Link } from '../lib/router.js';
import { BackToTop } from '../components/BackToTop.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { PricingNotice } from '../components/PricingNotice.jsx';
import { ProductCard } from '../components/ProductCard.jsx';
import { PageHead } from './support/SupportShell.jsx';

export function CollectionPage({ page, products, profile, account, isApprovedBuyer, onLoginClick, onApplyClick, ...cardProps }) {
  const collection = collectionByPage(page);
  const items = collectionList(products, page);
  return (
    <section className="support-page collection-page">
      <PageHead crumb={collection.title} eyebrow={collection.eyebrow} title={collection.title}>
        <p>{`${productCount(items.length)}. ${collection.blurb}`}</p>
      </PageHead>
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
        <EmptyState title="No products in this list yet" className="is-boxed" actions={<Link className="button" to="/catalog">Browse the catalog</Link>}>
          Browse the whole catalog in the meantime.
        </EmptyState>
      )}
      <BackToTop />
    </section>
  );
}
