// Trade-account dashboard: profile summary + order history.

import React, { useEffect, useState } from 'react';
import { ChevronRight, Package, Clock, CheckCircle, XCircle } from 'lucide-react';
import { C, body, display, mono } from '../../data/theme.js';
import { supabase } from '../../lib/supabase.js';

const STATUS_META = {
  new:        { label: 'New',        color: '#1E1B5C', icon: Clock },
  contacted:  { label: 'Contacted',  color: '#DB6433', icon: Clock },
  fulfilled:  { label: 'Fulfilled',  color: '#1F7A47', icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  color: '#6B6B6B', icon: XCircle },
};

export function AccountPage({ profile, goHome }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase || !profile) return;
    supabase
      .from('orders')
      .select('id, ref_num, status, total_units, subtotal, created_at, order_items(id, product_name, sku, qty, unit_price)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setOrders(data || []);
      });
  }, [profile?.id]);

  if (!profile) {
    return (
      <section className="px-3 md:px-6 lg:px-10 py-16 text-center">
        <p style={{ color: C.muted }}>Sign in to view your account.</p>
      </section>
    );
  }

  return (
    <section className="px-3 md:px-6 lg:px-10 py-5 md:py-10" style={{ ...body }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2 text-[11px] md:text-xs uppercase mb-5"
             style={{ ...mono, letterSpacing: '0.12em', fontWeight: 600 }}>
          <button onClick={goHome} className="hover:text-[#DB6433]" style={{ color: C.muted }}>Home</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <span style={{ color: C.navy }}>My Account</span>
        </div>

        <h1 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-3xl md:text-5xl leading-tight mb-2">
          {profile.business || profile.name}
        </h1>
        <p className="text-sm" style={{ color: C.muted }}>{profile.email}</p>

        <div className="grid md:grid-cols-3 gap-3 md:gap-4 mt-6 md:mt-8">
          <Card label="Account status" value={profile.status} accent={profile.status === 'approved' ? C.greenTag : C.orange} />
          <Card label="Pricing tier"   value={profile.pricing_tier} />
          <Card label="Role"           value={profile.role} />
        </div>

        {profile.status === 'pending' && (
          <div className="mt-6 px-4 py-3 text-sm" style={{ background: '#FFF5EC', border: `1px solid ${C.orange}`, color: C.navy }}>
            Your account is awaiting approval. A trade rep will verify your retail license and activate pricing within one business day.
          </div>
        )}

        <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-xl md:text-2xl mt-10 mb-4">
          Order history
        </h2>

        {error && <div className="text-sm" style={{ color: '#B84F23' }}>Couldn&apos;t load orders: {error}</div>}
        {orders === null && !error && <div className="text-sm" style={{ color: C.muted }}>Loading…</div>}
        {orders && orders.length === 0 && (
          <div className="p-6 text-center" style={{ background: 'white', border: `1px solid ${C.border}` }}>
            <Package size={32} style={{ color: C.mutedSoft, margin: '0 auto 1rem' }} />
            <p style={{ color: C.muted }}>No orders yet.</p>
          </div>
        )}
        {orders && orders.map(o => {
          const meta = STATUS_META[o.status] || STATUS_META.new;
          const Icon = meta.icon;
          return (
            <div key={o.id} className="mb-3" style={{ background: 'white', border: `1px solid ${C.border}` }}>
              <div className="px-4 md:px-5 py-3 md:py-4 flex flex-wrap items-center justify-between gap-3 border-b" style={{ borderColor: C.borderSoft, background: C.bg }}>
                <div>
                  <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.12em', color: C.navy }} className="text-xs uppercase">
                    {o.ref_num}
                  </div>
                  <div className="text-[11px]" style={{ color: C.muted }}>
                    {new Date(o.created_at).toLocaleString()} · {o.total_units} unit{o.total_units === 1 ? '' : 's'}
                    {o.subtotal != null && ` · $${Number(o.subtotal).toFixed(2)}`}
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] uppercase font-bold flex items-center gap-1.5"
                      style={{ ...mono, letterSpacing: '0.15em', background: meta.color, color: 'white' }}>
                  <Icon size={11} /> {meta.label}
                </span>
              </div>
              <ul>
                {(o.order_items || []).map(it => (
                  <li key={it.id} className="px-4 md:px-5 py-2 flex items-center justify-between text-sm border-b last:border-b-0" style={{ borderColor: C.borderSoft }}>
                    <span style={{ color: C.text }}>{it.qty} × {it.product_name} <span style={{ color: C.mutedSoft }}>({it.sku})</span></span>
                    {it.unit_price != null && (
                      <span style={{ ...mono, fontWeight: 600, color: C.navy }}>${Number(it.unit_price * it.qty).toFixed(2)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Card({ label, value, accent }) {
  return (
    <div className="p-4" style={{ background: 'white', border: `1px solid ${C.border}` }}>
      <div className="text-[10px] uppercase mb-1.5" style={{ ...mono, letterSpacing: '0.22em', color: C.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ ...display, fontWeight: 800, color: accent || C.navy, textTransform: 'capitalize' }} className="text-lg">{value}</div>
    </div>
  );
}
