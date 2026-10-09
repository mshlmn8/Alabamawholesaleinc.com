// Admin -> Pricing (AW-114): the pricing tiers' discounts as edited. Pure
// functions only (pricingTiers.test.js); PricingSection.jsx renders and
// saves them. A tier's label isn't edited (NEW-078): no page shows it, as
// every tier name buyers and staff see comes from its key (tierName in
// src/lib/pricing.js, tierLabel in src/lib/accountLabels.js), because a
// label can state a discount ('Silver (5% off)') that has since changed.
//
//   draftOf(tier)                  { pct } as the box shows it
//   validateTier(draft)            { pct? } messages
//   tierChanges(tiers, drafts)     the tiers whose discount changed

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

export const draftOf = (tier) => ({ pct: pctText(tier?.discount_pct) });

// The checks a save must pass: { pct? } (empty when fine).
export function validateTier(draft) {
  const errors = {};
  if (!parsePct(draft?.pct).ok) errors.pct = 'Enter a discount from 0 to 99.99, with at most two decimals.';
  return errors;
}

// The tiers whose discount differs from the loaded row, in the table's
// order: [{ tier, discount_pct, before: { discount_pct } }]. A discount box
// that isn't a number yet counts as a change (discount_pct null), so the
// form is dirty and the save says why.
export function tierChanges(tiers = [], drafts = {}) {
  const changes = [];
  for (const tier of tiers) {
    const draft = drafts[tier.tier];
    if (!draft) continue;
    const parsed = parsePct(draft.pct);
    const before = { discount_pct: Number(tier.discount_pct) };
    if (parsed.ok && parsed.pct === Math.round(before.discount_pct * 100) / 100) continue;
    changes.push({ tier: tier.tier, discount_pct: parsed.ok ? parsed.pct : null, before });
  }
  return changes;
}

// One change as the confirmation lists it.
export const changeText = (change) => `${change.tier}: discount ${pctText(change.before.discount_pct)}% to ${pctText(change.discount_pct)}%`;
