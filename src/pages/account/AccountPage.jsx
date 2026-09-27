// Trade-account dashboard: profile summary + order history.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const STATUS_CLASS = {
  new: '',
  contacted: 'contacted',
  fulfilled: 'fulfilled',
  cancelled: 'cancelled',
};

const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export function AccountPage({ profile, goHome, onSignIn }) {
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
      <section className="page-head">
        <p className="eyebrow">TRADE ACCOUNT</p>
        <h1>My account</h1>
        <p>Sign in to view your account, order history, and quick reorder.</p>
        {onSignIn && (
          <div className="dialog-actions compact-actions">
            <button className="button" type="button" onClick={onSignIn}>Sign in <span aria-hidden="true">↗</span></button>
          </div>
        )}
      </section>
    );
  }

  const statusTone = profile.status === 'approved' ? 'ok' : 'warn';

  return (
    <section>
      <div className="page-head">
        <div className="crumbs">
          <button type="button" onClick={goHome}>Home</button>
          <span aria-hidden="true">/</span>
          <span>My Account</span>
        </div>
        <p className="eyebrow">TRADE ACCOUNT</p>
        <h1>{profile.business || profile.name}</h1>
        <p>{profile.email}</p>
      </div>

      <div className="account-stats">
        <Stat label="Account status" value={profile.status} tone={statusTone} />
        <Stat label="Pricing tier" value={profile.pricing_tier} />
        <Stat label="Role" value={profile.role} />
      </div>

      {profile.status === 'pending' && (
        <p className="notice">Your account is awaiting approval. A trade rep will verify your retail license and activate pricing within one business day.</p>
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2>Order history</h2>
          </div>
        </div>

        {error && <p className="form-error">Couldn&apos;t load orders: {error}</p>}
        {orders === null && !error && <p className="result-note">Loading…</p>}
        {orders && orders.length === 0 && (
          <div className="empty-results">
            <h2>No orders yet</h2>
            <p>Orders you place will show up here.</p>
          </div>
        )}
        {orders && orders.length > 0 && (
          <div className="order-list">
            {orders.map(o => {
              const label = STATUS_LABEL[o.status] || STATUS_LABEL.new;
              const tone = STATUS_CLASS[o.status] || '';
              return (
                <article className="order-card" key={o.id}>
                  <div className="order-head">
                    <div>
                      <b className="order-ref">{o.ref_num}</b>
                      <small>
                        {new Date(o.created_at).toLocaleString()} · {o.total_units} unit{o.total_units === 1 ? '' : 's'}
                        {o.subtotal != null && ` · $${Number(o.subtotal).toFixed(2)}`}
                      </small>
                    </div>
                    <span className={`status-pill ${tone}`}>{label}</span>
                  </div>
                  <ul className="order-items">
                    {(o.order_items || []).map(it => (
                      <li key={it.id}>
                        <span>{it.qty} × {it.product_name} <span className="sku">({it.sku})</span></span>
                        {it.unit_price != null && (
                          <span className="line-total">${Number(it.unit_price * it.qty).toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
