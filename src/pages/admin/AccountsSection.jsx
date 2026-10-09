// Admin -> Accounts: every account with its status, tier, role and licence
// documents, the details row with the application answers (AW-017), Approve
// and Email applicant.

import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { DOCUMENT_TYPES, createDocumentViewUrl, listAllProfileDocuments } from '../../lib/documents.js';
import { Icon } from '../../components/Icon.jsx';

// The tiers before pricing_tiers could be read here (AW-351): the options when
// that table can't be loaded.
const FALLBACK_TIERS = ['standard', 'silver', 'gold'];

// Who approved an account, and when (AW-197): the approver's name from the
// accounts already loaded. Accounts approved before 20261008193000, or on a
// database without it, have no approved_at, and show nothing.
export function approvalLine(p, profiles) {
  if (!p.approved_at) return null;
  const at = new Date(p.approved_at);
  if (Number.isNaN(at.getTime())) return null;
  const when = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const approver = p.approved_by ? profiles.find(x => x.id === p.approved_by) : null;
  const by = approver ? (approver.name || approver.email) : null;
  return by ? `Approved ${when} by ${by}` : `Approved ${when}`;
}

// currentAdminId: the signed-in admin, whose own status and role can't be
// changed here (AW-352); the database refuses it too (profiles_guard).
export function AccountsTab({ currentAdminId }) {
  const [profiles, setProfiles] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [viewError, setViewError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [updateError, setUpdateError] = useState(null);
  const [tiers, setTiers] = useState(FALLBACK_TIERS);
  const reload = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setProfiles(data || []));
    listAllProfileDocuments().then(setDocuments).catch(() => setDocuments([]));
  };
  useEffect(reload, []);
  // The tier options are the pricing_tiers rows (AW-351): adding a tier is one
  // row there.
  useEffect(() => {
    let cancelled = false;
    supabase.from('pricing_tiers').select('tier,discount_pct').order('discount_pct', { ascending: true }).then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data) && data.length) setTiers(data.map(t => t.tier));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const row of documents) {
        try {
          next[`${row.profile_id}:${row.document_type}`] = await createDocumentViewUrl(row.storage_path);
        } catch {
          next[`${row.profile_id}:${row.document_type}`] = null;
        }
      }
      if (!cancelled) setSignedUrls(next);
    })();
    return () => { cancelled = true; };
  }, [documents]);

  const viewDocument = async (row, profile, label) => {
    setViewError(null);
    try {
      const url = await createDocumentViewUrl(row.storage_path);
      if (!url) throw new Error('Could not open that file.');
      setSignedUrls(prev => ({ ...prev, [`${row.profile_id}:${row.document_type}`]: url }));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setViewError(`Couldn’t open the ${label.toLowerCase()} for ${profile.business || profile.name}.`);
    }
  };

  // A refused or failed change is shown, not ignored: the database refuses
  // some changes with 42501 (20261009140000), and an update that reaches no
  // row (RLS) returns no error, so the changed row is read back.
  const updateProfile = async (row, patch) => {
    setUpdateError(null);
    const who = row.business || row.name || row.email;
    if (row.id === currentAdminId && ('status' in patch || 'role' in patch)) {
      setUpdateError('You can’t change your own status or role.');
      return;
    }
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', row.id).select('id');
    if (error?.code === '42501') setUpdateError(`That change to ${who} isn’t allowed.`);
    else if (error) setUpdateError(profileSaveError(error, who));
    else if (!data?.length) setUpdateError(`The change to ${who} wasn’t saved. Try again.`);
    reload();
  };

  if (!profiles) return <p className="result-note">Loading…</p>;

  return (
    <div className="table-scroll">
      {viewError && <p className="form-error" role="alert">{viewError}</p>}
      {updateError && <p className="form-error" role="alert">{updateError}</p>}
      <table className="aw-table">
        <thead>
          <tr>
            {['Business', 'Contact', 'Email', 'Status', 'Tier', 'Role', 'Documents', 'Actions'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <Fragment key={p.id}>
            <tr>
              <td>{p.business || '—'}</td>
              <td>{p.name}</td>
              <td className="muted">{p.email}</td>
              <td>
                <select aria-label={`Status for ${p.business || p.name}`} value={p.status} disabled={p.id === currentAdminId} aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined} onChange={e => updateProfile(p, { status: e.target.value })}>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="suspended">suspended</option>
                </select>
                {p.id === currentAdminId && <small className="field-hint" id="admin-own-row">Your own status and role can’t be changed here.</small>}
                {p.approved_at && <small className="field-hint">{approvalLine(p, profiles)}</small>}
              </td>
              <td>
                <select aria-label={`Tier for ${p.business || p.name}`} value={p.pricing_tier} onChange={e => updateProfile(p, { pricing_tier: e.target.value })}>
                  {(tiers.includes(p.pricing_tier) ? tiers : [...tiers, p.pricing_tier]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td>
                {/* An admin must be an approved account (is_admin()), so
                    making a pending or suspended account an admin approves it. */}
                <select aria-label={`Role for ${p.business || p.name}`} value={p.role} disabled={p.id === currentAdminId} aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined}
                  onChange={e => updateProfile(p, e.target.value === 'admin' && p.status !== 'approved' ? { role: 'admin', status: 'approved' } : { role: e.target.value })}>
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
                {/* Every status: the proof stays on file after approval (AW-197). */}
                <ul className="doc-admin">
                  {DOCUMENT_TYPES.map(doc => {
                    const row = documents.find(item => item.profile_id === p.id && item.document_type === doc.id);
                    return (
                      <li key={doc.id}>
                        <span>{doc.label}</span>
                        {row ? (
                          <>
                            <span>On file</span>
                            {signedUrls[`${p.id}:${doc.id}`] ? (
                              <a href={signedUrls[`${p.id}:${doc.id}`]} target="_blank" rel="noopener noreferrer">
                                View<Icon name="external" /><span className="sr-only">{` ${doc.label} for ${p.business || p.name} (opens in a new tab)`}</span>
                              </a>
                            ) : (
                              <button type="button" className="text-link" onClick={() => viewDocument(row, p, doc.label)}>
                                View<span className="sr-only">{` ${doc.label} for ${p.business || p.name}`}</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="muted">Not on file</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </td>
              <td>
                <div className="inline-actions">
                  <button
                    className="button xs ghost"
                    type="button"
                    aria-expanded={openId === p.id}
                    aria-controls={openId === p.id ? `account-details-${p.id}` : undefined}
                    onClick={() => { setOpenId(openId === p.id ? null : p.id); setNoteDraft(p.verification_note || ''); }}
                  >
                    <span>{openId === p.id ? 'Hide' : 'Details'}</span>
                    <span className="sr-only">{` for ${p.business || p.name}`}</span>
                  </button>
                  {p.status === 'pending' && (
                    <button className="button xs" type="button" onClick={() => updateProfile(p, { status: 'approved' })}>
                      Approve
                    </button>
                  )}
                  {/* No mail goes out on its own (AW-088): after approving,
                      staff send this from the desk's own mail. */}
                  {p.status === 'approved' && p.role !== 'admin' && p.email && (
                    <a className="button xs ghost" href={approvalEmail(p)}>
                      <span>Email applicant</span><span className="sr-only">{` ${p.business || p.name}`}</span>
                    </a>
                  )}
                </div>
              </td>
            </tr>
            {openId === p.id && (
              <tr className="account-detail-row" id={`account-details-${p.id}`}>
                <td colSpan={8}>
                  <div className="account-facts">
                    <Fact label="EIN" value={p.ein} />
                    <Fact label="Tobacco license" value={p.license_no} />
                    <Fact label="Resale certificate" value={p.resale_cert_no} />
                    <Fact label="Phone" value={p.phone} />
                    <Fact label="Store state" value={p.state} />
                    <Fact label="Street" value={p.store_street} />
                    <Fact label="City" value={p.store_city} />
                    <Fact label="ZIP" value={p.store_zip} />
                    <Fact label="Business type" value={p.business_type} />
                    <Fact label="Monthly volume" value={p.expected_volume} />
                    <Fact label="Approved" value={p.approved_at ? new Date(p.approved_at).toLocaleString() : ''} />
                    <Fact label="Approved by" value={profiles.find(row => row.id === p.approved_by)?.name || p.approved_by || ''} />
                    <Fact label="Terms accepted" value={p.terms_accepted_at ? `${new Date(p.terms_accepted_at).toLocaleString()}${p.terms_version ? ` · ${p.terms_version}` : ''}` : ''} />
                    <Fact label="21+ confirmed" value={p.age_confirmed_at ? new Date(p.age_confirmed_at).toLocaleString() : ''} />
                  </div>
                  <label className="account-note" htmlFor={`note-${p.id}`}>Verification note
                    <input id={`note-${p.id}`} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
                  </label>
                  <button className="button xs ghost" type="button" onClick={() => updateProfile(p, { verification_note: noteDraft || null })}>Save note</button>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The "Email applicant" message after approval (AW-088, Cursor's PR #13).
// TODO(owner): Should approvals send an automatic email, which needs an email provider or SMTP set up in Supabase, or will a trade rep call or email each approved applicant by hand? (AW-088)
export function approvalEmail(p) {
  const subject = 'Your Alabama Wholesale trade account';
  const body = 'Your Alabama Wholesale trade account is approved. Sign in to see pricing.';
  return `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// The live database gets the approval and consent columns from the
// 2026-10-08 migrations (AW-197, AW-019); until then they read as '—' and a
// note cannot be saved.
function profileSaveError(error, who) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  if (/PGRST204|42703/.test(text)) return 'Saving this needs the October 2026 database update (see BACKEND.md).';
  return `The change to ${who} wasn’t saved${error?.message ? ` (${error.message})` : ''}. Try again.`;
}

// One application answer in the details row (AW-017).
function Fact({ label, value }) {
  return (
    <div>
      <p className="fact-label">{label}</p>
      <p>{value || '—'}</p>
    </div>
  );
}
