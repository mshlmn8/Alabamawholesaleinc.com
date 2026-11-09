// The four home-page groups and the listing page Show all opens for each.
// The product order is collectionList in merchandising.js.

export const COLLECTIONS = Object.freeze([
  {
    page: 'new-arrivals',
    title: 'New arrivals',
    eyebrow: 'FRESH INVENTORY',
    blurb: 'Products tagged new.',
    description: 'Wholesale products tagged new, for licensed retailers.',
  },
  {
    page: 'hot-sellers',
    title: 'Hot sellers',
    eyebrow: 'MOVING NOW',
    blurb: 'Bestsellers featured right now.',
    description: 'Bestsellers featured right now, for licensed retailers.',
  },
  {
    page: 'bestsellers',
    title: 'Bestsellers',
    eyebrow: 'PROVEN MOVERS',
    blurb: 'Every product tagged as a bestseller.',
    description: 'Every wholesale product tagged as a bestseller, for licensed retailers.',
  },
  {
    page: 'new-deals',
    title: 'New deals',
    eyebrow: 'CURRENT OFFERS',
    blurb: 'Products tagged as a current deal.',
    description: 'Wholesale products tagged as a current deal, for licensed retailers.',
  },
]);

export const collectionByPage = (page) => COLLECTIONS.find((c) => c.page === page) || null;
