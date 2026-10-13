// Orders that are new since an admin's last visit (AW-111).
//
// Opening Admin -> Orders calls admin_mark_orders_seen() (20261010122000),
// which stores now and returns the previous visit: the orders placed after
// that are marked New until the next visit. A print view of an order is part
// of the same visit. The header's count (useAdminUnseen.js) is the orders
// placed after the stored visit.
//
// Without the function (the live database before the October 2026 update)
// the marker counts from the first time Orders was opened in this tab: a
// module-level time, never localStorage (which holds only the cart and the
// age confirmation).
//
// A tiny emitter tells the header to count again at once: after a visit is
// stored, and when Orders sees an order it didn't have.

import { useEffect, useState } from 'react';
import { isMissingSchema } from './adminData.js';

let firstView = null;
let markMissing = false;
let viewsMissing = false;
const listeners = new Set();

export function onOrdersActivity(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function ordersActivity() {
  for (const listener of [...listeners]) listener();
}
export function resetOrdersSeenForTests() {
  firstView = null;
  markMissing = false;
  viewsMissing = false;
  listeners.clear();
}

// The first time Orders was opened in this tab.
export function firstOrdersView(now = () => new Date().toISOString()) {
  if (!firstView) firstView = now();
  return firstView;
}

// Records a visit and returns { since, stored }: the previous visit (or,
// on the first visit ever and without the function, the first view in this
// tab), and whether the database has the visit.
export async function markOrdersSeen(client) {
  const fallback = firstOrdersView();
  if (!client || markMissing) return { since: fallback, stored: false };
  let result;
  try {
    result = await client.rpc('admin_mark_orders_seen');
  } catch (error) {
    result = { error };
  }
  if (result?.error) {
    if (isMissingSchema(result.error)) markMissing = true;
    return { since: fallback, stored: false };
  }
  ordersActivity();
  return { since: result.data || fallback, stored: true };
}

// Placed after `since`.
export function isNewSince(order, since) {
  if (!since) return false;
  const placed = Date.parse(order?.created_at);
  const seen = Date.parse(since);
  return !Number.isNaN(placed) && !Number.isNaN(seen) && placed > seen;
}

// The previous visit while `active` (the Orders section is on screen); a new
// visit starts each time it becomes active. null until it is known.
export function useOrdersSeen(active, client) {
  const [since, setSince] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    markOrdersSeen(client).then((result) => {
      if (!cancelled) setSince(result.since);
    });
    return () => {
      cancelled = true;
      setSince(null);
    };
  }, [active, client]);
  return active ? since : null;
}

// How many orders were placed after this admin's stored visit: 0 before the
// first one, null when it can't be told (no table: no badge).
export async function countUnseen(client, adminId) {
  if (!client || !adminId || viewsMissing) return null;
  try {
    const view = await client.from('admin_order_views').select('seen_at').eq('admin_id', adminId).maybeSingle();
    if (view.error) {
      if (isMissingSchema(view.error)) viewsMissing = true;
      return null;
    }
    const seenAt = view.data?.seen_at;
    if (!seenAt) return 0;
    const { count, error } = await client.from('orders').select('id', { count: 'exact', head: true }).gt('created_at', seenAt);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}
