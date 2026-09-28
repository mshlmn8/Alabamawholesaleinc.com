// Display-only tier discounts. Saved quotes ignore this and price on the server
// (submit_quote reads products.price and pricing_tiers).

export const TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 };

export const priceForProfile = (listPrice, profile) => {
  if (profile?.status !== 'approved' || listPrice == null) return null;
  return Number(listPrice) * (1 - (TIER_DISCOUNT[profile.pricing_tier] || 0));
};
