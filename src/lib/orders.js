// Order submission helper. Writes to Supabase when configured; otherwise falls
// back to Netlify Forms (which captures the lead even without a database).

import { supabase } from './supabase.js';

export const submitOrder = async ({ profile, refNum, formData, items, totalUnits, subtotal }) => {
  if (!supabase) return { source: 'netlify', ok: true }; // caller handles Netlify path

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      ref_num: refNum,
      user_id: profile?.id || null,
      business: formData.business,
      contact: formData.contact,
      email: formData.email,
      phone: formData.phone,
      delivery: formData.delivery,
      preferred_date: formData.preferredDate || null,
      notes: formData.notes || null,
      total_units: totalUnits,
      subtotal: subtotal ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  if (items.length) {
    const rows = items.map(it => ({
      order_id: order.id,
      product_id: it.id,
      product_name: it.name,
      sku: it.sku,
      qty: it.qty,
      unit_price: profile ? it.price : null,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(rows);
    if (itemsErr) throw itemsErr;
  }

  return { source: 'supabase', ok: true, order };
};
