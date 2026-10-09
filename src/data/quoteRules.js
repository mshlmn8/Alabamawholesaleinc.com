// Rules the quote form shares with submit_quote
// (supabase/migrations/20261009130000_submit_quote_v3.sql). The server
// enforces them; the form mirrors them so a buyer finds out before sending.
// Each value must equal its twin in that function: change both together
// (the SQL side in a new migration). The tobacco license rule (AW-014) is
// src/lib/regulated.js, whose test reads it from the same migration.

// The states the delivery routes cover, as the site already says; delivery
// to any other state is refused (will-call is fine from anywhere).
// TODO(owner): confirm route states: do the delivery routes cover exactly Alabama, Mississippi and Georgia? Mirrors v_route_states in submit_quote. (AW-198)
export const DELIVERY_ROUTE_STATES = ['AL', 'MS', 'GA'];

const listStates = (states) => (states.length > 1
  ? `${states.slice(0, -1).join(', ')} and ${states[states.length - 1]}`
  : states.join(''));

// One sentence for the hint under the ship-to State (AW-078) and for
// submit_quote's delivery_state refusal (src/lib/orders.js).
export const DELIVERY_STATE_NOTE = `Delivery routes cover ${listStates(DELIVERY_ROUTE_STATES)}. For another state, choose will-call pickup.`;

// The route state a value names ('al' and ' AL ' work too), upper-case, or
// null for any other text.
export function routeStateCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return DELIVERY_ROUTE_STATES.includes(code) ? code : null;
}
