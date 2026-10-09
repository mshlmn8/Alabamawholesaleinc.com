// Readable labels for an account's status, role and pricing tier (AW-149):
// one map each, so no screen shows the raw database value ('pending',
// 'customer', 'silver'). Pure and Node-safe (accountLabels.test.js).
//
//   ACCOUNT_STATUS_LABELS / accountStatusLabel(status)  what the buyer reads
//                     (My account, /apply; the sign-in dialog and the
//                     storefront's account notices should use it too)
//   ADMIN_STATUS_LABELS / adminStatusLabel(status)      the admin screens
//   ROLE_LABELS / roleLabel(role)
//   tierLabel(tier)   the tier key, capitalised: 'silver' -> 'Silver'
//
// A value without a label (a status or role added later) is shown
// capitalised rather than hidden. A tier's label never states a discount:
// the discount is a business fact that lives in pricing_tiers.

export const ACCOUNT_STATUS_LABELS = Object.freeze({
  pending: 'Pending approval',
  approved: 'Approved',
  suspended: 'On hold',
});
export const ADMIN_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  approved: 'Approved',
  suspended: 'Suspended',
});
export const ROLE_LABELS = Object.freeze({
  customer: 'Customer',
  admin: 'Admin',
});

// 'out_for_delivery' -> 'Out for delivery'; '' for nothing.
function capitalised(value) {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}
const labelIn = (labels) => (value) => (Object.hasOwn(labels, String(value ?? '')) ? labels[value] : capitalised(value));

export const accountStatusLabel = labelIn(ACCOUNT_STATUS_LABELS);
export const adminStatusLabel = labelIn(ADMIN_STATUS_LABELS);
export const roleLabel = labelIn(ROLE_LABELS);
export const tierLabel = (tier) => capitalised(tier);
