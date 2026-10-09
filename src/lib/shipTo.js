// The ship-to address a signed-in buyer last used (AW-102), for checkout to
// start from. Nothing new is stored for it: it is read from the buyer's own
// newest delivery order (orders.ship_* and delivery exist on every database
// since 20260925120000), and localStorage still holds only the cart and the
// age flag. Row-level security lets a buyer read only their own orders; the
// query names the account anyway.
//
//   loadLastShipTo(client, userId, { signal })
//       { shipStreet, shipCity, shipState, shipZip }, or null: no backend,
//       no such order, an address that isn't whole, or any error (it never
//       throws, and says nothing; the form keeps what it has)
//   loadAccountShipTo(userId, { signal })
//       the same against the site's Supabase client (what App passes to
//       QuotePage)
//
// How the address goes into the form, never over typed text, is
// applyShipTo() in src/lib/quoteForm.js.

import { supabase } from './supabase.js';

export const SHIP_TO_COLUMNS = 'ship_street,ship_city,ship_state,ship_zip';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// An order row's address in the form's fields, or null unless it is whole
// and in the shapes the form accepts (a 2-letter state, a ZIP or ZIP+4): a
// part of one would mix with the store address already in the form.
export function shipToFromOrder(row) {
  const shipTo = {
    shipStreet: text(row?.ship_street),
    shipCity: text(row?.ship_city),
    shipState: text(row?.ship_state).toUpperCase(),
    shipZip: text(row?.ship_zip),
  };
  if (!shipTo.shipStreet || !shipTo.shipCity) return null;
  if (!/^[A-Z]{2}$/.test(shipTo.shipState) || !/^[0-9]{5}(-[0-9]{4})?$/.test(shipTo.shipZip)) return null;
  return shipTo;
}

export async function loadLastShipTo(client, userId, { signal = null } = {}) {
  if (!client || !userId) return null;
  try {
    let query = client.from('orders').select(SHIP_TO_COLUMNS)
      .eq('user_id', userId)
      .eq('delivery', 'delivery')
      .not('ship_street', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error || !Array.isArray(data) || !data.length) return null;
    return shipToFromOrder(data[0]);
  } catch {
    return null;
  }
}

export const loadAccountShipTo = (userId, options) => loadLastShipTo(supabase, userId, options);
