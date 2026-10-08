// Rules the quote form shares with submit_quote
// (supabase/migrations/20260928123000_submit_quote_v2.sql). The server
// enforces them; the form mirrors them so a buyer finds out before sending.
// Each value must equal its twin in that function: change both together
// (the SQL side in a new migration).

// Who is asked for the store's license details (AW-014), for a cart with a
// line in AGE_RESTRICTED_DEPARTMENTS when the visitor isn't an approved buyer:
//   'off'       the fields are not shown
//   'optional'  shown; the details are stored when given
//   'required'  shown and required; set v_require_license to true in
//               submit_quote at the same time, so the server refuses them too
// TODO(owner): Should guests (and accounts not approved yet) have to give the store's tobacco/retail license number, resale certificate number and the attestation to quote tobacco or novelty items, or should those carts require signing in as an approved buyer? Until you decide, the fields are optional. Mirrors v_require_license in submit_quote. (AW-014)
export const LICENSE_FIELDS_FOR_GUESTS = 'optional';

// Departments whose lines count as age-restricted for the license fields.
// TODO(owner): Which departments count as age-restricted for the license fields (for now Tobacco and Novelties, where the vapes are)? Mirrors v_restricted_departments in submit_quote. (AW-014)
export const AGE_RESTRICTED_DEPARTMENTS = ['TOBACCO', 'NOVELTIES'];

// The statement a guest confirms with the license details, as AW-014 words it.
// TODO(owner): What exact wording should the license attestation have (legal review)? This is the review's suggested wording. (AW-014)
export const LICENSE_ATTESTATION = 'I confirm this business holds a valid tobacco retail license and all purchasers are 21+';

// The states the delivery routes cover, as the site already says; delivery
// to any other state is refused (will-call is fine from anywhere).
// TODO(owner): confirm route states: do the delivery routes cover exactly Alabama, Mississippi and Georgia? Mirrors v_route_states in submit_quote. (AW-198)
export const DELIVERY_ROUTE_STATES = ['AL', 'MS', 'GA'];
