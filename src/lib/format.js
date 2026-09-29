// Display formatting shared by the storefront, account, admin and support
// pages, so every page shows money and labels the same way (AW-184, AW-330).

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// Both digit limits are set: older Safari throws when only the maximum is
// lower than the currency's default minimum.
const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Prices, line totals and order totals: $1,807.66.
export const formatMoney = (n) => USD.format(Number(n));

// Round amounts in marketing and policy copy: $1,500.
export const formatMoneyShort = (n) => USD_WHOLE.format(Number(n));

// Department keys are the catalog's upper-case `cat` values.
const CAT_LABEL = {
  'TOBACCO': 'Tobacco', 'NOVELTIES': 'Novelties & Vapes', 'MERCHANDISE': 'Merchandise',
  'CANDIES': 'Candies', 'DRINKS & BAGS': 'Drinks & Bags', 'FOOD STUFF': 'Food Stuff',
  'GROCERY': 'Grocery', 'MOTOR OIL': 'Motor Oil'
};
export const catLabel = (c) => CAT_LABEL[c] || c;

// Two-letter placeholder for products without a photo.
export const initials = (name) => {
  const p = String(name).split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
};
