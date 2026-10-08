// Trade-account dashboard: profile summary, quick reorder by SKU, and order
// history with a Reorder action per order.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { linesFromOrder } from '../../lib/lines.js';
import { QuickReorder } from './QuickReorder.jsx';

const STATUS_CLASS = {
  new: '',
  contacted: 'contacted',
  fulfilled: 'fulfilled',
  cancelled: 'cancelled',
};

const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quote ready',
  confirmed: 'Confirmed',
  picking: 'Picking',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function AccountPage({ profile, goHome, onSignIn, products = [], addLines, onOpenCart, isApprovedBuyer, navigate }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [reorderNote, setReorderNote] = useState(null);

  useEffect(() => {
    if (!supabase || !profile) return;
    supabase
      .from('orders')
      .select('id, ref_num, status, total_units, subtotal, created_at, order_items(id, product_id, variant, product_name, sku, qty, unit_price)')
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
  const target = isApprovedBuyer ? 'order' : 'quote';

  const reorder = (order) => {
    const { lines, unavailable, needsVariant } = linesFromOrder(order, products);
    if (lines.length && addLines) addLines(lines);
    setReorderNote({
      orderId: order.id,
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.qty, 0),
      unavailable,
      needsVariant,
    });
  };

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

      {navigate && (
        <p className="notice">License and resale documents: <button className="text-link" type="button" onClick={() => navigate({ page: 'apply' })}>view or replace</button></p>
      )}

      {profile.status === 'pending' && (
        <p className="notice">Your account is awaiting approval. A trade rep will verify your retail license and activate pricing within one business day.</p>
      )}

      <section className="section" id="quick-reorder">
        <div className="section-head">
          <div>
            <p className="eyebrow">QUICK REORDER</p>
            <h2>Reorder by SKU</h2>
          </div>
        </div>
        <QuickReorder products={products} addLines={addLines} onOpenCart={onOpenCart} isApprovedBuyer={isApprovedBuyer} />
      </section>

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
            <p>Orders you place will show up here, each with a one-click Reorder.</p>
          </div>
        )}
        {orders && orders.length > 0 && (
          <div className="order-list">
            {orders.map(o => {
              const label = STATUS_LABEL[o.status] || STATUS_LABEL.new;
              const tone = STATUS_CLASS[o.status] || '';
              const note = reorderNote?.orderId === o.id ? reorderNote : null;
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
                    <div className="order-actions">
                      <span className={`status-pill ${tone}`}>{label}</span>
                      <button className="mini-btn" type="button" onClick={() => reorder(o)} disabled={!(o.order_items || []).length}>
                        Reorder
                      </button>
                    </div>
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
                  {note && (
                    <div className="order-foot" role="status">
                      <p>
                        {note.lines > 0
                          ? `Added ${plural(note.lines, 'line')} (${plural(note.units, 'unit')}) to your ${target}.`
                          : 'None of these items are available right now.'}
                        {note.needsVariant > 0 && ` ${plural(note.needsVariant, 'line')} need${note.needsVariant === 1 ? 's' : ''} a variant choice in the cart.`}
                        {note.unavailable.length > 0 && ` No longer available: ${note.unavailable.join(', ')}.`}
                      </p>
                      {note.lines > 0 && <button className="mini-btn primary" type="button" onClick={onOpenCart}>Review cart</button>}
                    </div>
                  )}
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
