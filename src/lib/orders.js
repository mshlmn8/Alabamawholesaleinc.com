// Quote submission. Prices and totals are calculated inside submit_quote.
// The browser sends product id, variant label, and quantity only.

import { supabase } from './supabase.js';

function isMissingQuoteSignature(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`;
  return error?.code === 'PGRST202' || /could not find the function|schema cache|42883|PGRST202/i.test(text);
}

export const submitOrder = async ({ refNum, formData, items }) => {
  if (!supabase) {
    const err = new Error('Quote requests can’t be saved right now.');
    err.code = 'unavailable';
    throw err;
  }

  const payload = {
    p_ref_num: refNum,
    p_business: formData.business,
    p_contact: formData.contact,
    p_email: formData.email,
    p_phone: formData.phone,
    p_delivery: formData.delivery,
    p_preferred_date: formData.preferredDate || null,
    p_notes: formData.notes || null,
    p_ship_street: formData.shipStreet,
    p_ship_city: formData.shipCity,
    p_ship_state: formData.shipState,
    p_ship_zip: formData.shipZip,
    p_items: items.map((it) => ({
      product_id: it.productId,
      variant: it.variant || null,
      qty: it.qty,
    })),
  };
  const licensed = {
    ...payload,
    p_license_no: formData.licenseNo || null,
    p_resale_cert: formData.resaleCert || null,
    p_purchasers_21: Boolean(formData.purchasers21),
  };
  let { data, error } = await supabase.rpc('submit_quote', licensed);
  if (error && isMissingQuoteSignature(error)) {
    // Live database still has the previous submit_quote. Keep the license
    // answers in the notes until the owner applies the new migration.
    const licenseNote = [
      formData.licenseNo ? `State tobacco/retail license #: ${formData.licenseNo}` : '',
      formData.resaleCert ? `Sales-tax / resale certificate #: ${formData.resaleCert}` : '',
      formData.purchasers21 ? 'Confirmed: valid tobacco retail license and purchasers are 21+.' : '',
    ].filter(Boolean).join('\n');
    const fallback = {
      ...payload,
      p_notes: [payload.p_notes, licenseNote].filter(Boolean).join('\n') || null,
    };
    ({ data, error } = await supabase.rpc('submit_quote', fallback));
  }
  if (error) throw error;
  if (!data?.id) throw new Error('The quote was not saved.');
  return { source: 'supabase', ok: true, order: data };
};
