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
