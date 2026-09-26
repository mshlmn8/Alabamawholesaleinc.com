// Quote submission. Prices and totals are calculated inside submit_quote.
// The browser sends product id, variant label, and quantity only.

import { supabase } from './supabase.js';

export const submitOrder = async ({ refNum, formData, items }) => {
  if (!supabase) {
    const err = new Error('Quote requests can’t be saved right now.');
    err.code = 'unavailable';
    throw err;
  }

  const { data, error } = await supabase.rpc('submit_quote', {
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
  });
  if (error) throw error;
  if (!data?.id) throw new Error('The quote was not saved.');
  return { source: 'supabase', ok: true, order: data };
};
