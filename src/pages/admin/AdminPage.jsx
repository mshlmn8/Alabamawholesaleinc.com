// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.

import React, { useEffect, useState } from 'react';
import { ChevronRight, Check, X, Edit2, Save } from 'lucide-react';
import { C, body, display, mono } from '../../data/theme.js';
import { supabase } from '../../lib/supabase.js';

const TABS = [
  { id: 'orders',   label: 'Orders'   },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
];

export function AdminPage({ profile, goHome }) {
  const [tab, setTab] = useState('orders');

  if (!profile || profile.role !== 'admin') {
    return (
      <section className="px-3 md:px-6 lg:px-10 py-16 text-center" style={{ ...body }}>
        <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl mb-2">Access denied</h2>
        <p style={{ color: C.muted }}>Admin role required.</p>
      </section>
    );
  }

  return (
    <section className="px-3 md:px-6 lg:px-10 py-5 md:py-10" style={{ ...body }}>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 text-[11px] md:text-xs uppercase mb-5"
             style={{ ...mono, letterSpacing: '0.12em', fontWeight: 600 }}>
          <button onClick={goHome} className="hover:text-[#DB6433]" style={{ color: C.muted }}>Home</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <span style={{ color: C.navy }}>Admin</span>
        </div>

        <h1 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-3xl md:text-5xl leading-tight mb-6">
          Admin
        </h1>

        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: C.border }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className="px-4 py-3 text-xs uppercase font-bold transition-colors"
                    style={{
                      ...mono, letterSpacing: '0.15em',
                      color: tab === t.id ? C.orange : C.muted,
                      borderBottom: `3px solid ${tab === t.id ? C.orange : 'transparent'}`,
                      marginBottom: -1,
                    }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'orders'   && <OrdersTab />}
        {tab === 'accounts' && <AccountsTab />}
        {tab === 'products' && <ProductsTab />}
      </div>
    </section>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('new');

  const reload = () => {
    supabase
      .from('orders')
      .select('*, order_items(id, product_name, sku, qty, unit_price), profiles(business, name, pricing_tier)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setOrders(data || []));
  };
  useEffect(reload, []);

  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    reload();
  };

  if (!orders) return <div style={{ color: C.muted }}>Loading…</div>;
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['new','contacted','fulfilled','cancelled','all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
                  className="px-3 py-1.5 text-[10px] uppercase font-bold"
                  style={{
                    ...mono, letterSpacing: '0.14em',
                    background: filter === s ? C.navy : 'white',
                    color:      filter === s ? 'white' : C.navy,
                    border: `1px solid ${C.border}`,
                  }}>
            {s} ({orders.filter(o => s === 'all' || o.status === s).length})
          </button>
        ))}
      </div>

      {filtered.map(o => (
        <div key={o.id} className="mb-3" style={{ background: 'white', border: `1px solid ${C.border}` }}>
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3"
               style={{ borderColor: C.borderSoft, background: C.bg }}>
            <div>
              <div style={{ ...mono, fontWeight: 700, color: C.navy }} className="text-xs uppercase">{o.ref_num}</div>
              <div className="text-[11px]" style={{ color: C.muted }}>
                {new Date(o.created_at).toLocaleString()} · {o.business} · {o.contact} · {o.email} · {o.phone}
                {o.ship_street && <span> · Ship to {o.ship_street}, {o.ship_city} {o.ship_state} {o.ship_zip}</span>}
                {o.profiles?.pricing_tier && <span> · tier: <b>{o.profiles.pricing_tier}</b></span>}
              </div>
            </div>
            <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
                    className="px-2 py-1 text-[11px] uppercase font-bold cursor-pointer"
                    style={{ ...mono, letterSpacing: '0.15em', background: 'white', border: `1px solid ${C.border}` }}>
              {['new','contacted','fulfilled','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <ul className="px-4 py-2 text-sm">
            {(o.order_items || []).map(it => (
              <li key={it.id} className="flex justify-between py-1">
                <span>{it.qty} × {it.product_name} <span style={{ color: C.mutedSoft }}>({it.sku})</span></span>
                <span style={{ ...mono, color: C.navy }}>{it.unit_price != null ? `$${(it.unit_price * it.qty).toFixed(2)}` : '—'}</span>
              </li>
            ))}
          </ul>
          {o.notes && <div className="px-4 pb-3 text-[12px]" style={{ color: C.muted }}>Notes: {o.notes}</div>}
        </div>
      ))}
      {filtered.length === 0 && <p style={{ color: C.muted }}>No orders in this state.</p>}
    </div>
  );
}

function AccountsTab() {
  const [profiles, setProfiles] = useState(null);
  const reload = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setProfiles(data || []));
  };
  useEffect(reload, []);

  const updateProfile = async (id, patch) => {
    await supabase.from('profiles').update(patch).eq('id', id);
    reload();
  };

  if (!profiles) return <div style={{ color: C.muted }}>Loading…</div>;

  return (
    <table className="w-full text-sm" style={{ background: 'white', border: `1px solid ${C.border}` }}>
      <thead style={{ background: C.bg }}>
        <tr>
          {['Business','Contact','Email','Status','Tier','Role','Actions'].map(h => (
            <th key={h} className="px-3 py-2 text-left text-[10px] uppercase" style={{ ...mono, letterSpacing: '0.15em', color: C.muted }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {profiles.map(p => (
          <tr key={p.id} className="border-t" style={{ borderColor: C.borderSoft }}>
            <td className="px-3 py-2">{p.business || '—'}</td>
            <td className="px-3 py-2">{p.name}</td>
            <td className="px-3 py-2 text-[12px]">{p.email}</td>
            <td className="px-3 py-2">
              <select value={p.status} onChange={e => updateProfile(p.id, { status: e.target.value })}
                      className="text-[11px] px-1 py-0.5 border" style={{ borderColor: C.border }}>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="suspended">suspended</option>
              </select>
            </td>
            <td className="px-3 py-2">
              <select value={p.pricing_tier} onChange={e => updateProfile(p.id, { pricing_tier: e.target.value })}
                      className="text-[11px] px-1 py-0.5 border" style={{ borderColor: C.border }}>
                <option value="standard">standard</option>
                <option value="silver">silver</option>
                <option value="gold">gold</option>
              </select>
            </td>
            <td className="px-3 py-2">
              <select value={p.role} onChange={e => updateProfile(p.id, { role: e.target.value })}
                      className="text-[11px] px-1 py-0.5 border" style={{ borderColor: C.border }}>
                <option value="customer">customer</option>
                <option value="admin">admin</option>
              </select>
            </td>
            <td className="px-3 py-2">
              {p.status === 'pending' && (
                <button onClick={() => updateProfile(p.id, { status: 'approved' })}
                        className="px-2 py-0.5 text-[10px] uppercase font-bold inline-flex items-center gap-1"
                        style={{ ...mono, letterSpacing: '0.12em', background: C.greenTag, color: 'white' }}>
                  <Check size={11} /> Approve
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductsTab() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const reload = () => {
    supabase.from('products').select('*').order('id').then(({ data }) => setRows(data || []));
  };
  useEffect(reload, []);

  const save = async (id, patch) => {
    await supabase.from('products').update(patch).eq('id', id);
    setEditing(null);
    reload();
  };

  if (!rows) return <div style={{ color: C.muted }}>Loading…</div>;

  const filtered = !search ? rows : rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.brand.toLowerCase().includes(search.toLowerCase()) ||
    r.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input type="search" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)}
             className="w-full max-w-md mb-4 px-3 py-2 text-sm outline-none"
             style={{ background: 'white', border: `1px solid ${C.border}` }} />
      <div className="text-xs mb-2" style={{ color: C.muted }}>
        {filtered.length} of {rows.length} products
      </div>
      <table className="w-full text-sm" style={{ background: 'white', border: `1px solid ${C.border}` }}>
        <thead style={{ background: C.bg }}>
          <tr>
            {['ID','Name','Brand','Category','Price','Tag','Active',''].map(h => (
              <th key={h} className="px-3 py-2 text-left text-[10px] uppercase" style={{ ...mono, letterSpacing: '0.15em', color: C.muted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 200).map(p => editing?.id === p.id ? (
            <tr key={p.id} className="border-t" style={{ borderColor: C.borderSoft, background: C.orangeLite }}>
              <td className="px-3 py-2">{p.id}</td>
              <td className="px-3 py-2"><input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="px-1 py-0.5 w-full border" style={{ borderColor: C.border }} /></td>
              <td className="px-3 py-2"><input value={editing.brand} onChange={e => setEditing({...editing, brand: e.target.value})} className="px-1 py-0.5 w-full border" style={{ borderColor: C.border }} /></td>
              <td className="px-3 py-2 text-[12px]">{p.cat} / {p.sub}</td>
              <td className="px-3 py-2"><input type="number" step="0.01" value={editing.price} onChange={e => setEditing({...editing, price: parseFloat(e.target.value)})} className="px-1 py-0.5 w-24 border" style={{ borderColor: C.border }} /></td>
              <td className="px-3 py-2">
                <select value={editing.tag || ''} onChange={e => setEditing({...editing, tag: e.target.value || null})} className="px-1 py-0.5 border" style={{ borderColor: C.border }}>
                  <option value="">—</option>
                  <option value="BESTSELLER">BESTSELLER</option>
                  <option value="NEW">NEW</option>
                  <option value="DEAL">DEAL</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <input type="checkbox" checked={editing.active} onChange={e => setEditing({...editing, active: e.target.checked})} />
              </td>
              <td className="px-3 py-2 flex gap-1">
                <button onClick={() => save(p.id, { name: editing.name, brand: editing.brand, price: editing.price, tag: editing.tag, active: editing.active })}
                        className="px-2 py-0.5 text-[10px] uppercase font-bold inline-flex items-center gap-1"
                        style={{ ...mono, letterSpacing: '0.12em', background: C.orange, color: 'white' }}>
                  <Save size={11} /> Save
                </button>
                <button onClick={() => setEditing(null)} className="px-2 py-0.5 text-[10px] uppercase" style={{ ...mono, letterSpacing: '0.12em', color: C.muted }}>
                  Cancel
                </button>
              </td>
            </tr>
          ) : (
            <tr key={p.id} className="border-t" style={{ borderColor: C.borderSoft }}>
              <td className="px-3 py-2">{p.id}</td>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2">{p.brand}</td>
              <td className="px-3 py-2 text-[12px]" style={{ color: C.muted }}>{p.cat} / {p.sub}</td>
              <td className="px-3 py-2" style={{ ...mono, color: C.navy }}>${Number(p.price).toFixed(2)}</td>
              <td className="px-3 py-2">{p.tag || '—'}</td>
              <td className="px-3 py-2">{p.active ? '✓' : '✗'}</td>
              <td className="px-3 py-2">
                <button onClick={() => setEditing({ ...p })} className="px-2 py-0.5 text-[10px] uppercase font-bold inline-flex items-center gap-1"
                        style={{ ...mono, letterSpacing: '0.12em', background: 'white', color: C.navy, border: `1px solid ${C.border}` }}>
                  <Edit2 size={11} /> Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length > 200 && <div className="text-xs mt-2" style={{ color: C.muted }}>Showing first 200 — narrow the search to see others.</div>}
    </div>
  );
}
