// Prices for approved buyers (AW-003, AW-077, AW-351). List prices live only
// in Supabase: guests and signed-in accounts cannot read products.price, and
// nothing in the site's bundle carries a price. An approved buyer's prices
// come from one database function, my_prices() (supabase/migrations/
// 20260928120000_price_boundary.sql), which applies the buyer's tier on the
// server and rounds each unit price to cents exactly as the order trigger
// does. This module is the adapter over it; src/lib/prices.jsx loads it for
// the signed-in account (usePrices()).
//
// Money is added up in whole cents, so "each" x quantity on screen is always
// the line the server saves, and the estimate is the saved subtotal (AW-077).

import { formatMoney } from './format.js';
import { variantSlug } from './lines.js';

// "No such function": the live database before 20260928120000 has no
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

// The live database before 20260928120000 has no my_prices(), and there the
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
// there is none. status is usePrices().status.
export const PRICE_LOADING = 'Loading price…';
export const PRICE_ON_REQUEST = 'Price on request';
export const PRICE_FAILED = 'Price didn’t load';

export function priceLabel(unit, status) {
  if (unit != null) return formatMoney(unit);
  if (status === 'loading') return PRICE_LOADING;
  if (status === 'error') return PRICE_FAILED;
  return PRICE_ON_REQUEST;
}

// The estimated total for an approved buyer's lines. When no line that can
// be ordered has a price yet, it says why instead of showing $0.00.
export function totalLabel(items, total, status) {
  const orderable = (items || []).filter((it) => !it.unavailable);
  if (!orderable.length || orderable.some((it) => it.price != null)) return formatMoney(total);
  if (status === 'loading') return 'Loading prices…';
  if (status === 'error') return 'Prices didn’t load';
  return PRICE_ON_REQUEST;
}
