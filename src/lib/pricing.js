// Prices for approved buyers (AW-003, AW-077, AW-351). List prices live only
// in Supabase: guests and signed-in accounts cannot read products.price, and
// nothing in the site's bundle carries a price. An approved buyer's prices
// come from one database function, my_prices() (supabase/migrations/
// 20261009100000_price_boundary.sql), which applies the buyer's tier on the
// server and rounds each unit price to cents exactly as the order trigger
// does. This module is the adapter over it; src/lib/prices.jsx loads it for
// the signed-in account (usePrices()).
//
// Money is added up in whole cents, so "each" x quantity on screen is always
// the line the server saves, and the estimate is the saved subtotal (AW-077).

import { formatMoney } from './format.js';
import { variantSlug } from './lines.js';

// "No such function": the live database before 20261009100000 has no
// my_prices(). PostgREST answers PGRST202; Postgres itself says 42883.
export const MISSING_FUNCTION_CODES = ['PGRST202', '42883'];

// Rows per request on the legacy path (Supabase's default row limit).
export const PRICE_PAGE_SIZE = 1000;
const MAX_PAGES = 50;

// Dollars to whole cents, and back. Prices are numeric(10,2), so x100 is an
// integer up to float noise, which Math.round removes.
export function toCents(amount) {
  if (amount == null || amount === '') return null;
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
export const fromCents = (cents) => (cents == null ? null : cents / 100);

const money = (amount) => fromCents(toCents(amount));

// A tier's unit price: the list price less discountPct percent, rounded to
// cents half up, the way Postgres rounds numeric
// (public.tier_unit_price: round(list * (1 - pct / 100.0), 2)). Worked in
// integers, so there is no float rounding: 45.10 at 5% is 42.845, which is
// 42.85 here and on the server (not 42.84, as toFixed would give).
export function tierUnitPrice(list, discountPct) {
  const listCents = toCents(list);
  if (listCents == null) return null;
  const pct = Math.round((Number(discountPct) || 0) * 100); // hundredths of a percent
  return fromCents(Math.round((listCents * (10000 - pct)) / 10000));
}

// unit x qty, in cents. Null when the line has no price.
export function lineTotal(unit, qty) {
  const cents = toCents(unit);
  if (cents == null) return null;
  return fromCents(cents * Math.round(Number(qty) || 0));
}

// The sum of the priced lines ({ price, qty }), in cents. Unpriced lines
// (price on request, no prices for this account, lines that can't be
// ordered) add nothing, as they add nothing to the saved subtotal.
export function sumLines(items) {
  let cents = 0;
  for (const item of items || []) {
    const unit = toCents(item?.price);
    if (unit != null) cents += unit * Math.round(Number(item.qty) || 0);
  }
  return fromCents(cents);
}

// my_prices()' payload in the shape the storefront uses:
//   { tier, tierLabel, discountPct, byId: Map(productId -> { list, unit, variants }) }
// where variants is a Map(variant slug -> { list, unit }). Null in, null out
// (an account that isn't approved gets no prices).
export function normalizePrices(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const byId = new Map();
  for (const [id, entry] of Object.entries(payload.products || {})) {
    const variants = new Map();
    for (const [label, own] of Object.entries(entry?.variants || {})) {
      variants.set(variantSlug(label), { list: money(own?.list), unit: money(own?.unit) });
    }
    byId.set(Number(id), { list: money(entry?.list), unit: money(entry?.unit), variants });
  }
  return {
    tier: payload.tier ?? null,
    tierLabel: payload.tier_label ?? null,
    discountPct: Number(payload.discount_pct) || 0,
    byId,
  };
}

// { list, unit } for a product (and variant), or null when there is none.
// A variant's own price wins over the product's. unit is null for a product
// without a price ("price on request").
export function priceFor(prices, productId, variant = null) {
  const entry = prices?.byId?.get(Number(productId));
  if (!entry) return null;
  const own = variant ? entry.variants?.get(variantSlug(variant)) : null;
  if (own) return { list: own.list, unit: own.unit };
  return { list: entry.list, unit: entry.unit };
}

// The price to show for a product before one of its variants is chosen,
// from each variant's unit price (null for "price on request"): { unit,
// from }. unit is the price every variant shares, or the lowest one with
// from true ("From $x") when they differ or only some have a price (AW-030).
// unit is null when none has a price.
export function variantPriceRange(units) {
  const cents = (units || []).map(toCents);
  const priced = cents.filter((c) => c != null);
  if (!priced.length) return { unit: null, from: false };
  const low = Math.min(...priced);
  const same = priced.length === cents.length && priced.every((c) => c === low);
  return { unit: fromCents(low), from: !same };
}

// The live database before 20261009100000 has no my_prices(), and there the
// price column and pricing_tiers are still readable, so the same prices are
// worked out here from them and the account's tier. Remove this path once
// that migration is applied everywhere.
async function loadLegacyPrices(client, { profile, signal, pageSize }) {
  if (profile?.status !== 'approved') return { ok: true, prices: null, source: 'legacy', error: null };
  const rows = [];
  let total = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = client.from('products').select('id,price', page === 0 ? { count: 'exact' } : undefined)
      .eq('active', true).order('id', { ascending: true })
      .range(rows.length, rows.length + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error) return { ok: false, prices: null, source: 'legacy', error };
    if (page === 0 && typeof count === 'number') total = count;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length === 0) break;
    if (total !== null ? rows.length >= total : batch.length < pageSize) break;
  }
  let tiersQuery = client.from('pricing_tiers').select('tier,discount_pct,label');
  if (signal) tiersQuery = tiersQuery.abortSignal(signal);
  const { data: tiers, error } = await tiersQuery;
  if (error) return { ok: false, prices: null, source: 'legacy', error };
  const tier = (tiers || []).find((t) => t.tier === profile.pricing_tier) || null;
  const discountPct = Number(tier?.discount_pct) || 0;
  const products = {};
  for (const row of rows) {
    products[row.id] = { list: row.price, unit: tierUnitPrice(row.price, discountPct), variants: {} };
  }
  const prices = normalizePrices({ tier: profile.pricing_tier ?? null, tier_label: tier?.label ?? null, discount_pct: discountPct, products });
  return { ok: true, prices, source: 'legacy', error: null };
}

// The signed-in account's prices: { ok, prices, source: 'rpc' | 'legacy',
// error }. prices is null for an account that isn't approved. `profile` is
// used only on the legacy path. Never throws.
export async function loadPrices(client, { profile = null, signal = null, pageSize = PRICE_PAGE_SIZE } = {}) {
  if (!client) return { ok: false, prices: null, source: null, error: { message: 'No backend is configured.' } };
  try {
    // A read-only function, so a GET.
    let query = client.rpc('my_prices', {}, { get: true });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (!error) return { ok: true, prices: normalizePrices(data), source: 'rpc', error: null };
    if (!MISSING_FUNCTION_CODES.includes(error.code)) return { ok: false, prices: null, source: 'rpc', error };
    return await loadLegacyPrices(client, { profile, signal, pageSize });
  } catch (error) {
    return { ok: false, prices: null, source: 'rpc', error };
  }
}

// What an approved buyer sees where a unit price goes: the price, or why
// there is none. status is usePrices().status. With from (a product whose
// variants are priced differently, variantPriceRange()), "From $x".
export const PRICE_LOADING = 'Loading price…';
export const PRICE_ON_REQUEST = 'Price on request';
export const PRICE_FAILED = 'Price didn’t load';

export function priceLabel(unit, status, { from = false } = {}) {
  if (unit != null) return from ? `From ${formatMoney(unit)}` : formatMoney(unit);
  if (status === 'loading') return PRICE_LOADING;
  if (status === 'error') return PRICE_FAILED;
  return PRICE_ON_REQUEST;
}

// Where the price is set in price type (a card, the product page), a price
// that didn't load is a sentence in body type instead, never a word set as a
// price (NEW-054, the AW-133 rule); the site notice (pricesNotices.js) says
// why and offers Try again. PRICE_FAILED stays where a line of text says it.
export const PRICE_FAILED_SENTENCE = 'Your price didn’t load.';
export const priceDidNotLoad = (unit, status) => unit == null && status === 'error';

// The buyer's tier, for saying what the prices on screen are (AW-107,
// AW-265). Everything comes from my_prices() (or the legacy path above):
// App passes { tier, label, discountPct } from usePrices().prices, and
// there is no tier table here.
//   tierName('silver')                     'Silver'
//   pctText(5), pctText(2.5)               '5%', '2.5%'
//   tierDiscountText({ tier: 'silver', discountPct: 5 })
//                                          'Silver · 5% off list'
//   tierPriceNote(same)                    'Prices shown are your Silver
//                                          tier prices, 5% off list.'
// A tier without a discount is named alone ('Standard'). The tier's key is
// used rather than its label, which may already name the discount
// ('Silver (5% off)').
export function tierName(tier) {
  const text = String(tier ?? '').replace(/[-_]+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

export function pctText(pct) {
  const n = Number(pct);
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : '';
}

const discountOf = (priceTier) => {
  const n = Number(priceTier?.discountPct);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function tierDiscountText(priceTier) {
  if (!priceTier) return '';
  const name = tierName(priceTier.tier);
  const pct = discountOf(priceTier);
  if (!pct) return name;
  return [name, `${pctText(pct)} off list`].filter(Boolean).join(' · ');
}

// The one-line caption over an approved buyer's cards (category intro, the
// home rails). Without the tier (prices still loading) it says only that the
// prices are the account's.
export function tierPriceNote(priceTier) {
  const name = tierName(priceTier?.tier);
  if (!name) return 'Prices shown are your account prices.';
  const pct = discountOf(priceTier);
  return pct
    ? `Prices shown are your ${name} tier prices, ${pctText(pct)} off list.`
    : `Prices shown are your ${name} tier prices.`;
}

// The estimated total for an approved buyer's lines. When no line that
// counts toward it (one that can be ordered as it stands: not waiting for
// its variant, AW-103) has a price yet, it says why instead of showing $0.00;
// with no such line at all it is a dash (NEW-063), never $0.00.
export const NO_TOTAL = '—';
export function totalLabel(items, total, status) {
  const orderable = (items || []).filter((it) => !it.unavailable && !it.needsVariant);
  if (!orderable.length) return NO_TOTAL;
  if (orderable.some((it) => it.price != null)) return formatMoney(total);
  if (status === 'loading') return 'Loading prices…';
  if (status === 'error') return 'Prices didn’t load';
  return PRICE_ON_REQUEST;
}
