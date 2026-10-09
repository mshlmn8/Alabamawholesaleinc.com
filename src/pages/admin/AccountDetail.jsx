// One account's page, /admin/accounts/:id (AW-113): its business as the
// heading with a status pill, then
//   - Status, tier and role (the list's rules: the admin's own row is
//     locked; suspending asks for a reason; AccountChanges.jsx, AW-112)
//   - Contact and store: a form for the business, contact, phone, business
//     type and store address (the profile's store_* columns), Enter saves;
//     the email is read only (it follows the sign-in email)
//   - Verification: the application answers (AccountFacts) and the
//     verification note
//   - Licence documents, signed when View is clicked (AW-208)
//   - Internal notes (profile_admin_notes, 20261009140000), staff only
//   - Orders: the newest 50, the last order's date and the total of the
//     priced ones, with links to Admin -> Orders for the account
//   - Status history (profile_status_log, 20261008193000; role changes too
//     since 20261011111000, AW-203)
// Profile changes patch the loaded accounts (onPatch, changes); nothing here
// loads the documents again after the first time.
//
// Feature detection (the live database before the October 2026 update): a
// save of a column it doesn't have says it needs the update; without
// profile_admin_notes the notes say so; without profile_status_log there is
// no history; without orders.kind the orders load without it.

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Link } from '../../lib/router.js';
import { adminHref } from '../../lib/adminRoutes.js';
import { accountStatus } from '../../lib/accountStatus.js';
import { formatMoney } from '../../lib/format.js';
import { DOCUMENT_TYPES, formatUploadedOn, listProfileDocuments } from '../../lib/documents.js';
import { ADMIN_STATUS_LABELS, ROLE_LABELS, adminStatusLabel, tierLabel } from '../../lib/accountLabels.js';
import { useLeaveGuard } from './useLeaveGuard.js';
import { adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { AccountFacts, DocumentView, Email, approvalLine, profileSaveError, useDocumentViewer } from './accountParts.jsx';
import { ACCOUNT_NOTE_SELECT, NOTES_NEED_UPDATE, accountControlId } from './AccountChanges.jsx';
import { checkNote, entryLine, isMissingTable, staffName, statusLabel } from './orderStaff.js';
import {
  ACCOUNT_ORDER_LIMIT, CONTACT_FIELDS, accountName, accountOrdersHref, businessTypes, contactChanges, contactDraft, dayText, historyText, loadAccountOrders,
  loadStatusHistory, ordersSummary, validateContact,
} from './accountDetail.js';

// The list filtered on a status (AW-268); every account for 'all'.
const accountsHref = (status) => adminHref({ section: 'accounts', query: { status } });
const telHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;

// id: the account. profiles: every account (null while loading), with
// loadError/onRetry/retrying. tiers: the tier options. changes: the shared
// status/tier/role/note changes (useAccountChanges). onPatch(id, patch): a
// saved contact change. onBack(event): Back to accounts was clicked.
export function AccountDetail({
  id, profiles, loadError = null, onRetry, retrying = false, tiers = [], currentAdminId, changes, notify, onPatch, onBack,
}) {
  const profile = profiles?.find((p) => p.id === id) || null;
  const who = profile ? accountName(profile) : 'this account';

  // The heading takes the focus when the page opens: inside admin the page
  // doesn't change (same page key), so nothing else moves it.
  const headingRef = useRef(null);
  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView?.({ block: 'nearest' });
  }, []);

  // The contact and store form, and the verification note, as typed.
  const [draft, setDraft] = useState(() => (profile ? contactDraft(profile) : null));
  const [noteDraft, setNoteDraft] = useState(() => (profile ? profile.verification_note || '' : null));
  if (profile && draft === null) setDraft(contactDraft(profile));
  if (profile && noteDraft === null) setNoteDraft(profile.verification_note || '');
  const [internalDraft, setInternalDraft] = useState('');
  // Notes written by a suspension or a role change on this page (its
  // reason), shown with the loaded ones.
  const [addedNotes, setAddedNotes] = useState([]);
  const contactDirty = !!(profile && draft && Object.keys(contactChanges(draft, profile)).length);
  const noteDirty = !!(profile && noteDraft !== null && noteDraft.trim() !== (profile.verification_note || '').trim());
  const internalDirty = internalDraft.trim() !== '';
  useLeaveGuard(contactDirty || noteDirty || internalDirty, `Your changes to ${who} aren’t saved. Leave without saving them?`);

  return (
    <section className="account-detail" aria-labelledby="account-detail-title">
      {/* Opened from the list, Back goes back to it (onBack); opened any other
          way, it goes to the list of the account's status, where its link
          takes the focus. */}
      <p className="account-detail-back"><Link className="text-link" to={accountsHref(profile ? accountStatus(profile) : undefined)} onClick={onBack}>Back to accounts</Link></p>
      <div className="account-detail-head">
        <h2 id="account-detail-title" ref={headingRef} tabIndex={-1}>{profile ? who : profiles ? 'Account not found' : 'Account details'}</h2>
        {profile && <span className={`admin-pill account-pill is-${profile.status}`}>{adminStatusLabel(profile.status)}</span>}
      </div>
      {!profiles && (loadError ? <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} /> : <p className="result-note">Loading…</p>)}
      {profiles && !profile && (
        <>
          <p className="result-note">No account has this address. It may have been deleted.</p>
          <p><Link className="button sm ghost" to={accountsHref('all')}>All accounts</Link></p>
        </>
      )}
      {profile && (
        <>
          <p className="account-detail-contact">
            <span>{profile.name || '—'}</span>
            {profile.email && <a href={`mailto:${profile.email}`}><Email address={profile.email} /></a>}
            {profile.phone && <a href={telHref(profile.phone)}>{profile.phone}</a>}
          </p>
          {changes.error && <p className="form-error" role="alert">{changes.error}</p>}
          <div className="account-detail-grid">
            <div className="account-detail-column">
              <AccountControls profile={profile} profiles={profiles} tiers={tiers} currentAdminId={currentAdminId} changes={changes}
                onNote={(note) => setAddedNotes((list) => [note, ...list])} />
              <ContactForm profile={profile} profiles={profiles} draft={draft} setDraft={setDraft} dirty={contactDirty} notify={notify} onPatch={onPatch} />
              <section className="account-section" aria-labelledby="account-verify-title">
                <h3 id="account-verify-title">Verification</h3>
                <AccountFacts profile={profile} profiles={profiles} detail />
                <VerificationNote profile={profile} draft={noteDraft ?? ''} setDraft={setNoteDraft} changes={changes} />
              </section>
            </div>
            <div className="account-detail-column">
              <Documents id={id} who={who} />
              <InternalNotes id={id} who={who} profiles={profiles} added={addedNotes} draft={internalDraft} setDraft={setInternalDraft} notify={notify} />
              <AccountOrders id={id} />
              <StatusHistory id={id} profiles={profiles} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// Status, tier and role: the list's selects, with labels. Suspending and
// role changes ask for a reason; onNote(note) gets the reason's internal
// note once saved.
function AccountControls({ profile: p, profiles, tiers, currentAdminId, changes, onNote }) {
  const own = p.id === currentAdminId;
  const busy = !!changes.saving(p.id);
  const ids = { status: accountControlId(p.id, 'status', 'page'), tier: accountControlId(p.id, 'tier', 'page'), role: accountControlId(p.id, 'role', 'page') };
  const describedBy = own ? 'account-own-row' : undefined;
  const approval = approvalLine(p, profiles);
  return (
    <section className="account-section" aria-labelledby="account-controls-title">
      <h3 id="account-controls-title">Status, tier and role</h3>
      <div className="form-grid account-controls">
        <div>
          <label htmlFor={ids.status}>Status</label>
          <select id={ids.status} value={p.status} disabled={own} aria-disabled={busy || undefined} aria-describedby={describedBy}
            onChange={(e) => {
              if (!busy) changes.setStatus(p, e.target.value, { focusId: ids.status, onNote });
            }}>
            <option value="pending">{ADMIN_STATUS_LABELS.pending}</option>
            <option value="approved">{ADMIN_STATUS_LABELS.approved}</option>
            <option value="suspended">{ADMIN_STATUS_LABELS.suspended}</option>
          </select>
        </div>
        <div>
          <label htmlFor={ids.tier}>Tier</label>
          <select id={ids.tier} value={p.pricing_tier} aria-disabled={busy || undefined}
            onChange={(e) => { if (!busy) changes.change(p, { pricing_tier: e.target.value }, { kind: 'tier', focusId: ids.tier }); }}>
            {(tiers.includes(p.pricing_tier) ? tiers : [...tiers, p.pricing_tier]).map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={ids.role}>Role</label>
          {/* A role change asks first, with a reason (AW-203); making a
              pending or suspended account an admin approves it. */}
          <select id={ids.role} value={p.role} disabled={own} aria-disabled={busy || undefined} aria-describedby={describedBy}
            onChange={(e) => { if (!busy) changes.setRole(p, e.target.value, { onNote }); }}>
            <option value="customer">{ROLE_LABELS.customer}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
        </div>
      </div>
      {own && <small className="field-hint" id="account-own-row">Your own status and role can’t be changed here.</small>}
      {approval && <p className="result-note account-approval">{approval}</p>}
    </section>
  );
}

// The contact and store details: a real form (Enter saves) that sends only
// the changed columns, and checks the changed fields first.
function ContactForm({ profile, profiles, draft, setDraft, dirty, notify, onPatch }) {
  const id = useId();
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const types = businessTypes(profiles);
  const who = accountName(profile);
  const fieldId = (key) => `${id}-${key}`;
  if (!draft) return null;

  const set = (key) => (e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    const checked = validateContact(draft, profile);
    setErrors(checked.errors);
    setSaveError('');
    if (!checked.ok) {
      const first = CONTACT_FIELDS.find(({ key }) => checked.errors[key]);
      document.getElementById(fieldId(first.key))?.focus();
      return;
    }
    if (!Object.keys(checked.patch).length) return;
    setSaving(true);
    const { error } = await checkedWrite(supabase.from('profiles').update(checked.patch).eq('id', profile.id));
    setSaving(false);
    if (error) {
      setSaveError(profileSaveError(error, who));
      return;
    }
    onPatch?.(profile.id, checked.patch);
    setDraft(contactDraft({ ...profile, ...checked.patch }));
    notify?.(`Saved the contact and store details of ${accountName({ ...profile, ...checked.patch })}.`);
  };
  const describedBy = (key, hint) => [hint ? `${fieldId(key)}-hint` : null, `${fieldId(key)}-error`].filter(Boolean).join(' ');

  return (
    <section className="account-section" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Contact and store</h3>
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <form className="form-grid account-contact-form" noValidate onSubmit={save} aria-labelledby={`${id}-title`}>
        {CONTACT_FIELDS.map(({ key, label, max, type, inputMode, autoComplete, hint, full }) => (
          <div key={key} className={full ? 'full' : undefined}>
            <label htmlFor={fieldId(key)}>{label}</label>
            <input
              id={fieldId(key)} type={type || 'text'} inputMode={inputMode} autoComplete={autoComplete || 'off'} maxLength={max}
              value={draft[key]} onChange={set(key)} list={key === 'business_type' ? `${id}-types` : undefined}
              className={key === 'state' ? 'account-state' : undefined}
              aria-invalid={errors[key] ? true : undefined} aria-describedby={describedBy(key, hint)}
            />
            {hint && <small className="field-hint" id={`${fieldId(key)}-hint`}>{hint}</small>}
            <p className="form-error" id={`${fieldId(key)}-error`}>{errors[key] || ''}</p>
          </div>
        ))}
        <datalist id={`${id}-types`}>
          {types.map((t) => <option key={t} value={t} />)}
        </datalist>
        <div className="full">
          <label htmlFor={fieldId('email')}>Email</label>
          <input id={fieldId('email')} type="email" value={profile.email || ''} readOnly aria-describedby={`${fieldId('email')}-hint`} />
          <small className="field-hint" id={`${fieldId('email')}-hint`}>The email follows the account’s sign-in email, so it can’t be changed here.</small>
        </div>
        <div className="full inline-actions">
          <button className="button sm" type="submit" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button>
          {dirty && !saving && (
            <button className="button sm ghost" type="button" onClick={() => { setDraft(contactDraft(profile)); setErrors({}); setSaveError(''); }}>Discard changes</button>
          )}
        </div>
      </form>
    </section>
  );
}

// The verification note (Cursor's verification_note, which the account
// holder can read), saved like the list's.
function VerificationNote({ profile, draft, setDraft, changes }) {
  const id = useId();
  const saving = changes.saving(profile.id) === 'note';
  const save = async (event) => {
    event.preventDefault();
    if (changes.saving(profile.id)) return;
    const ok = await changes.change(profile, { verification_note: draft.trim() || null }, { kind: 'note', undoable: false });
    if (ok) setDraft(draft.trim());
  };
  return (
    <form className="form-grid account-verify-form" noValidate onSubmit={save}>
      <div className="full">
        <label htmlFor={`${id}-note`}>Verification note</label>
        <input id={`${id}-note`} value={draft} onChange={(e) => setDraft(e.target.value)} aria-describedby={`${id}-hint`} />
        <small className="field-hint" id={`${id}-hint`}>The account holder can read this note. Use internal notes for anything only staff should see.</small>
      </div>
      <div className="full">
        <button className="button xs ghost" type="submit" disabled={!!changes.saving(profile.id)}>{saving ? 'Saving…' : 'Save note'}</button>
      </div>
    </form>
  );
}

// The account's licence documents (listProfileDocuments), loaded once.
function Documents({ id, who }) {
  const [state, setState] = useState({ rows: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const viewer = useDocumentViewer();
  useEffect(() => {
    let cancelled = false;
    listProfileDocuments(id).then(
      (rows) => { if (!cancelled) { setState({ rows, error: null }); setRetrying(false); } },
      (error) => { if (!cancelled) { setState({ rows: null, error: adminErrorMessage(error, 'The licence documents didn’t load') }); setRetrying(false); } },
    );
    return () => { cancelled = true; };
  }, [id, attempt]);
  return (
    <section className="account-section" aria-labelledby="account-documents-title">
      <h3 id="account-documents-title">Licence documents</h3>
      {state.error && <LoadProblem message={state.error} onRetry={() => { setRetrying(true); setAttempt((n) => n + 1); }} retrying={retrying} />}
      {viewer.viewError && <p className="form-error" role="alert">{viewer.viewError}</p>}
      <ul className="doc-admin account-documents">
        {DOCUMENT_TYPES.map((doc) => {
          const row = state.rows?.find((item) => item.document_type === doc.id);
          return (
            <li key={doc.id}>
              <span className="account-document-name">{doc.label}</span>
              {row ? (
                <>
                  <span>{row.uploaded_at ? formatUploadedOn(row.uploaded_at) : 'On file'}</span>
                  <DocumentView row={row} doc={doc} who={who} viewer={viewer} />
                </>
              ) : (
                <span className="muted">{state.rows ? 'Not on file' : state.error ? 'Couldn’t check' : 'Checking…'}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Internal notes about the account: staff only (the account holder can't
// read profile_admin_notes). The author's name comes from the loaded
// accounts. added: notes saved elsewhere on the page (a suspension's reason).
function InternalNotes({ id, who, profiles, added = [], draft, setDraft, notify }) {
  const formId = useId();
  const [state, setState] = useState({ rows: null, error: null, missing: false });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(supabase.from('profile_admin_notes').select(ACCOUNT_NOTE_SELECT).eq('profile_id', id).order('created_at', { ascending: false }))
      .then((result) => {
        if (cancelled) return;
        setRetrying(false);
        const error = withStatus(result || {});
        if (error) setState({ rows: null, missing: isMissingTable(error), error: isMissingTable(error) ? null : adminErrorMessage(error, 'The internal notes didn’t load') });
        else setState({ rows: result.data || [], error: null, missing: false });
      }, (error) => {
        if (cancelled) return;
        setRetrying(false);
        setState({ rows: null, missing: false, error: adminErrorMessage(error, 'The internal notes didn’t load') });
      });
    return () => { cancelled = true; };
  }, [id, attempt]);

  const add = async (event) => {
    event.preventDefault();
    if (saving) return;
    const checked = checkNote(draft);
    if (!checked.ok) {
      setNoteError(checked.error);
      boxRef.current?.focus();
      return;
    }
    setSaving(true);
    setNoteError('');
    let result;
    try {
      result = await supabase.from('profile_admin_notes').insert({ profile_id: id, body: checked.body }).select(ACCOUNT_NOTE_SELECT).single();
    } catch (error) {
      result = { error };
    }
    setSaving(false);
    const error = withStatus(result || {});
    if (error) {
      if (isMissingTable(error)) setState({ rows: null, error: null, missing: true });
      else setNoteError(adminErrorMessage(error, 'The note wasn’t saved'));
      return;
    }
    setDraft('');
    if (result.data) setState((s) => ({ ...s, rows: [result.data, ...(s.rows || []).filter((n) => n.id !== result.data.id)] }));
    notify?.(`Added a note to ${who}.`);
  };

  const nameOf = (author) => (author ? staffName(profiles.find((p) => p.id === author)) || 'a former admin' : null);
  const box = `${formId}-note`;
  const rows = state.rows ? [...added.filter((n) => !state.rows.some((r) => r.id === n.id)), ...state.rows] : null;
  return (
    <section className="account-section" aria-labelledby="account-notes-title">
      <h3 id="account-notes-title">Internal notes</h3>
      {state.missing ? (
        <p className="result-note">{NOTES_NEED_UPDATE}</p>
      ) : (
        <>
          <form className="form-grid account-note-form" onSubmit={add} noValidate>
            <div className="full">
              <label htmlFor={box}>Add an internal note</label>
              <textarea
                id={box} ref={boxRef} rows={3} value={draft}
                aria-invalid={noteError ? true : undefined} aria-describedby={`${box}-hint ${box}-error`}
                onChange={(e) => { setDraft(e.target.value); if (noteError) setNoteError(''); }}
              />
              <small className="field-hint" id={`${box}-hint`}>Only staff see these notes. The account holder never does.</small>
              <p className="form-error" id={`${box}-error`}>{noteError}</p>
            </div>
            <div className="full">
              <button className="button xs" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add note'}</button>
            </div>
          </form>
          {state.error && <LoadProblem message={state.error} onRetry={() => { setRetrying(true); setAttempt((n) => n + 1); }} retrying={retrying} />}
          {!state.error && !rows && <p className="result-note">Loading…</p>}
          {rows && rows.length === 0 && <p className="result-note">No internal notes yet.</p>}
          {rows && rows.length > 0 && (
            <ol className="order-timeline account-notes" aria-label={`Internal notes about ${who}`}>
              {rows.map((n) => (
                <li key={n.id} className="order-timeline-note">
                  <p className="order-timeline-line">{entryLine({ text: 'Note', by: nameOf(n.author), at: n.created_at })}</p>
                  <p className="order-timeline-text">{n.body}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

// The account's newest orders, the last order's date and the total of the
// priced ones that weren't cancelled. Every link opens Admin -> Orders for
// the account (all statuses).
function AccountOrders({ id }) {
  const [state, setState] = useState({ rows: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadAccountOrders(supabase, id).then((result) => {
      if (cancelled) return;
      setRetrying(false);
      const error = withStatus(result || {});
      setState(error ? { rows: null, error: adminErrorMessage(error, 'The orders didn’t load') } : { rows: result.data || [], error: null });
    }, (error) => {
      if (cancelled) return;
      setRetrying(false);
      setState({ rows: null, error: adminErrorMessage(error, 'The orders didn’t load') });
    });
    return () => { cancelled = true; };
  }, [id, attempt]);
  const rows = state.rows;
  const summary = rows ? ordersSummary(rows) : null;
  const href = accountOrdersHref(id);
  return (
    <section className="account-section" aria-labelledby="account-orders-title">
      <h3 id="account-orders-title">Orders</h3>
      {state.error && <LoadProblem message={state.error} onRetry={() => { setRetrying(true); setAttempt((n) => n + 1); }} retrying={retrying} />}
      {!state.error && !rows && <p className="result-note">Loading…</p>}
      {rows && (
        <>
          <dl className="account-order-summary">
            <div><dt>Last order</dt><dd>{summary.lastAt ? dayText(summary.lastAt) : 'None yet'}</dd></div>
            <div><dt>Total of priced orders, cancelled ones excluded</dt><dd>{formatMoney(summary.total)}</dd></div>
          </dl>
          {rows.length >= ACCOUNT_ORDER_LIMIT && <p className="result-note">{`The newest ${ACCOUNT_ORDER_LIMIT} orders; the total counts those.`}</p>}
          {rows.length > 0 && (
            <div className="table-scroll account-orders">
              <table className="aw-table">
                <thead>
                  <tr><th scope="col">Ref</th><th scope="col">Placed</th><th scope="col">Status</th><th scope="col">Total</th></tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td><Link className="account-link" to={href}>{o.ref_num}</Link></td>
                      <td>{dayText(o.created_at)}</td>
                      <td>{statusLabel(o.status)}</td>
                      <td className="price">{o.subtotal == null ? 'Not priced' : formatMoney(o.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="account-orders-link"><Link className="text-link" to={href}>{rows.length ? 'All orders for this account' : 'No orders yet. Open Orders for this account'}</Link></p>
        </>
      )}
    </section>
  );
}

// Every status and role change of the account (profile_status_log, written
// by the database; role changes since 20261011111000, AW-203), newest
// first. Not shown on a database without it.
function StatusHistory({ id, profiles }) {
  const [state, setState] = useState({ rows: null, error: null, missing: false });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(loadStatusHistory(supabase, id))
      .then((result) => {
        if (cancelled) return;
        const error = withStatus(result || {});
        if (error) setState({ rows: null, missing: isMissingTable(error), error: isMissingTable(error) ? null : adminErrorMessage(error, 'The status history didn’t load') });
        else setState({ rows: result.data || [], error: null, missing: false });
      }, () => {
        if (!cancelled) setState({ rows: null, error: null, missing: true });
      });
    return () => { cancelled = true; };
  }, [id]);
  if (state.missing) return null;
  const nameOf = (changedBy) => (changedBy ? staffName(profiles.find((p) => p.id === changedBy)) || 'a former admin' : null);
  return (
    <section className="account-section" aria-labelledby="account-history-title">
      <h3 id="account-history-title">Status history</h3>
      {state.error && <p className="form-error">{state.error}</p>}
      {!state.error && !state.rows && <p className="result-note">Loading…</p>}
      {state.rows && state.rows.length === 0 && <p className="result-note">No status changes yet.</p>}
      {state.rows && state.rows.length > 0 && (
        <ol className="order-timeline account-history">
          {state.rows.map((row) => (
            <li key={row.id}>
              <p className="order-timeline-line">{entryLine({ text: historyText(row), by: nameOf(row.changed_by), at: row.changed_at })}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
