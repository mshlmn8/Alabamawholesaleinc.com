// Admin -> Pricing (AW-114): the pricing tiers' labels and discounts as
// edited. Pure functions only (pricingTiers.test.js); PricingSection.jsx
// renders and saves them.
//
//   draftOf(tier)                  { label, pct } as the boxes show them
//   validateTier(draft)            { label?, pct? } messages
//   tierChanges(tiers, drafts)     the tiers whose label or discount changed

export const TIER_LABEL_MAX = 60;
// 0 to 99.99, at most two decimals (pricing_tiers_discount_range,
// 20261010121000: 0 <= discount < 100; the column is numeric(5,2)).
const PCT = /^\d{1,2}(\.\d{1,2})?$/;

const trim = (value) => (value == null ? '' : String(value)).trim();

// A discount as its box shows it: 5 -> '5', 7.5 -> '7.5', 12.25 -> '12.25'.
export function pctText(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
}

// The discount box's text: { ok, pct }.
export function parsePct(raw) {
  const value = trim(raw).replace(/%$/, '').trim();
  if (!PCT.test(value)) return { ok: false, pct: null };
  return { ok: true, pct: Math.round(Number(value) * 100) / 100 };
}

export const draftOf = (tier) => ({ label: tier?.label ?? '', pct: pctText(tier?.discount_pct) });

// The checks a save must pass: { label?, pct? } (empty when fine).
export function validateTier(draft) {
  const errors = {};
  const label = trim(draft?.label);
  if (!label) errors.label = 'Enter the tier’s label.';
  else if (label.length > TIER_LABEL_MAX) errors.label = `Keep the label to ${TIER_LABEL_MAX} characters.`;
  if (!parsePct(draft?.pct).ok) errors.pct = 'Enter a discount from 0 to 99.99, with at most two decimals.';
  return errors;
}

// The tiers whose label or discount differs from the loaded row, in the
// table's order: [{ tier, label, discount_pct, before: { label,
// discount_pct } }]. A discount box that isn't a number yet counts as a
// change (discount_pct null), so the form is dirty and the save says why.
export function tierChanges(tiers = [], drafts = {}) {
  const changes = [];
  for (const tier of tiers) {
    const draft = drafts[tier.tier];
    if (!draft) continue;
    const label = trim(draft.label);
    const parsed = parsePct(draft.pct);
    const before = { label: tier.label ?? '', discount_pct: Number(tier.discount_pct) };
    const pctChanged = parsed.ok ? parsed.pct !== Math.round(before.discount_pct * 100) / 100 : true;
    if (label === trim(before.label) && !pctChanged) continue;
    changes.push({ tier: tier.tier, label, discount_pct: parsed.ok ? parsed.pct : null, before });
  }
  return changes;
}

// One change as the confirmation lists it.
export function changeText(change) {
  const parts = [];
  if (change.discount_pct !== change.before.discount_pct) parts.push(`discount ${pctText(change.before.discount_pct)}% to ${pctText(change.discount_pct)}%`);
  if (change.label !== change.before.label) parts.push(`label “${change.before.label}” to “${change.label}”`);
  return `${change.tier}: ${parts.join(', ')}`;
}
