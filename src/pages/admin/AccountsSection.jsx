// Admin -> Accounts: every account with its status, tier, role and licence
// documents, the details row with the application answers (AW-017), Approve
// and Email applicant; status pills with counts (?status=, pending by
// default, AW-268), a search box, and each business's own page
// (/admin/accounts/:id, AccountDetail.jsx, AW-113). Status, tier and role
// changes show at once, with Undo; suspending asks for a reason
// (AccountChanges.jsx, AW-112).

import { Fragment, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Link } from '../../lib/router.js';
import { accountStatus } from '../../lib/accountStatus.js';
import { ACCOUNT_STATUS_FILTERS, DEFAULT_ACCOUNT_STATUS } from '../../lib/adminRoutes.js';
import { DOCUMENT_TYPES, listAllProfileDocuments } from '../../lib/documents.js';
import { fetchAllRows } from '../../lib/paging.js';
import { ADMIN_STATUS_LABELS, ROLE_LABELS, tierLabel } from '../../lib/accountLabels.js';
import { useLeaveGuard } from './useLeaveGuard.js';
import { adminErrorMessage, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { AccountFacts, DocumentView, Email, approvalLine, useDocumentViewer } from './accountParts.jsx';
import { AccountChangeDialog, accountControlId, useAccountChanges } from './AccountChanges.jsx';
import { AccountDetail } from './AccountDetail.jsx';
import { TableScroll } from './TableScroll.jsx';
import { MAX_ACCOUNT_SEARCH, accountCountText, accountHref, accountLinkId, accountStatusCounts, matchesAccountSearch } from './accountDetail.js';

export { approvalLine, profileChangeText, profileSaveError } from './accountParts.jsx';

// The tiers before pricing_tiers could be read here (AW-351): the options when
// that table can't be loaded.
const FALLBACK_TIERS = ['standard', 'silver', 'gold'];
const currentUrl = () => window.location.pathname + window.location.search;
// A phone number as a tel: link wants it: digits and a leading +.
export const telHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;

// route: the admin route; route.id is an account's id for its page.
// query: the list's filter from the URL (status, AW-268); onQuery writes it.
// currentAdminId: the signed-in admin, whose own status and role can't be
// changed here (AW-352); the database refuses it too (profiles_guard).
// notify: shows what a change did (useAdminStatus). search/onSearch: the
// search box, kept by AdminPage (never in the URL: it names people).
// returnFocusId/onReturnFocus: the business link the list focuses when an
// account's page closes. openedFrom/onOpen: the account page the list
// opened (AdminPage keeps it, and forgets it when the browser's Back leaves
// the page, NEW-036), so leaving it goes Back to the list (its search and
// scroll position); a page opened any other way goes to the list by its
// link.
export function AccountsTab({
  route = {}, query = {}, onQuery, currentAdminId, notify, search = '', onSearch, returnFocusId = null, onReturnFocus, openedFrom = null, onOpen,
}) {
  const [profiles, setProfiles] = useState(null);
  const [profilesError, setProfilesError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [tiers, setTiers] = useState(FALLBACK_TIERS);
  const changes = useAccountChanges({ setProfiles, currentAdminId, notify });
  const detail = route.id != null;
  // The status filter (AW-268). The list shows the accounts that had the
  // status when the filter was chosen (or the accounts loaded): one approved
  // or suspended since, in the list, on its page or by Undo, stays where it
  // is, marked "Moved to …", so Approve never takes the row (and the focus)
  // away and Back from an account's page finds its link. Another filter, or
  // loading the accounts again, starts afresh.
  const filter = query.status || DEFAULT_ACCOUNT_STATUS;
  const [listed, setListed] = useState({ filter: null, statuses: null });
  if (!detail && profiles && listed.filter !== filter) {
    setListed({ filter, statuses: new Map(profiles.map((p) => [p.id, accountStatus(p)])) });
  }
  const listedStatus = (p) => listed.statuses?.get(p.id) ?? accountStatus(p);

  // A failed load says so, with Try again, instead of an empty table or
  // "Not on file" for every account (AW-202). Changes patch the rows where
  // they are (AccountChanges.jsx), so this runs once, and on Try again.
  // Every account, a page of 1000 at a time (AW-199): one request stopped at
  // PostgREST's max-rows without a word.
  const reload = () => fetchAllRows(() => supabase.from('profiles').select('*').order('created_at', { ascending: false }).order('id')).then((result) => {
    const error = withStatus(result);
    setProfilesError(error ? adminErrorMessage(error, 'The accounts didn’t load') : null);
    if (!error) {
      setProfiles(result.data || []);
      setListed({ filter: null, statuses: null });
    }
  });
  useEffect(() => { reload(); }, []);
  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };
  // The tier options are the pricing_tiers rows (AW-351): adding a tier is one
  // row there.
  useEffect(() => {
    let cancelled = false;
    supabase.from('pricing_tiers').select('tier,discount_pct').order('discount_pct', { ascending: true }).then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data) && data.length) setTiers(data.map(t => t.tier));
    });
    return () => { cancelled = true; };
  }, []);

  // Back from an account's page: its business link takes the focus.
  const leaveDetail = (event) => {
    onReturnFocus?.(accountLinkId(route.id));
    const back = openedFrom && openedFrom === currentUrl();
    onOpen?.(null);
    if (back) {
      event.preventDefault();
      window.history.back();
    }
  };
  const patchProfile = (id, patch) => setProfiles((list) => list?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? list);

  return (
    <>
      {detail ? (
        <AccountDetail
          key={route.id} id={route.id} profiles={profiles} loadError={profilesError} onRetry={retry} retrying={retrying} tiers={tiers}
          currentAdminId={currentAdminId} changes={changes} notify={notify} onPatch={patchProfile} onBack={leaveDetail}
        />
      ) : (
        <AccountsList
          profiles={profiles} profilesError={profilesError} onRetry={retry} retrying={retrying} tiers={tiers} currentAdminId={currentAdminId}
          changes={changes} search={search} onSearch={onSearch} onOpen={onOpen} returnFocusId={returnFocusId} onReturnFocus={onReturnFocus}
          filter={filter} listedStatus={listedStatus} onFilter={(status) => onQuery?.({ ...query, status })}
        />
      )}
      <AccountChangeDialog changes={changes} />
    </>
  );
}

// filter: the status filter ('pending' … 'all'); listedStatus(p): the
// status the list files the account under; onFilter(status) changes it.
function AccountsList({
  profiles, profilesError, onRetry, retrying, tiers, currentAdminId, changes, search, onSearch, onOpen, returnFocusId, onReturnFocus,
  filter = DEFAULT_ACCOUNT_STATUS, listedStatus = accountStatus, onFilter,
}) {
  // The licence documents: null while loading. They load once when the list
  // first shows (and on Try again), never after a change to an account.
  const [documents, setDocuments] = useState(null);
  const [documentsError, setDocumentsError] = useState(null);
  const [documentsRetrying, setDocumentsRetrying] = useState(false);
  const viewer = useDocumentViewer();
  const searchRef = useRef(null);
  const [openId, setOpenId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  // A verification note typed but not saved: leaving the page asks first
  // (AW-118), and so do Hide and another account's Details, which would
  // drop it (discarding: { next }, the account to open then, or null).
  const openProfile = openId && profiles ? profiles.find(row => row.id === openId) : null;
  const noteDirty = !!openProfile && noteDraft !== (openProfile.verification_note || '');
  useLeaveGuard(noteDirty, 'The verification note isn’t saved. Leave without saving it?');
  const [discarding, setDiscarding] = useState(null);
  const showDetails = (next) => {
    setOpenId(next);
    setNoteDraft((next && profiles?.find(row => row.id === next)?.verification_note) || '');
  };
  const toggleDetails = (p) => {
    const next = openId === p.id ? null : p.id;
    if (noteDirty) setDiscarding({ next });
    else showDetails(next);
  };
  const loadDocuments = () => listAllProfileDocuments().then(
    (rows) => { setDocuments(rows); setDocumentsError(null); },
    (error) => setDocumentsError(adminErrorMessage(error, 'The licence documents didn’t load')),
  );
  useEffect(() => { loadDocuments(); }, []);
  const retryDocuments = async () => {
    setDocumentsRetrying(true);
    await loadDocuments();
    setDocumentsRetrying(false);
  };

  // Back from an account's page: its business link takes the focus again.
  useEffect(() => {
    if (!returnFocusId || !profiles) return;
    const target = document.getElementById(returnFocusId);
    onReturnFocus?.(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }, [returnFocusId, profiles, onReturnFocus]);

  if (!profiles) {
    return profilesError ? <LoadProblem message={profilesError} onRetry={onRetry} retrying={retrying} /> : <p className="result-note">Loading…</p>;
  }

  // The status pills count every account; the list is the filter's, then
  // the search's.
  const counts = accountStatusCounts(profiles);
  const inFilter = filter === 'all' ? profiles : profiles.filter((p) => listedStatus(p) === filter);
  const shown = inFilter.filter((p) => matchesAccountSearch(p, search));
  const searching = search.trim() !== '';
  const kind = filter === 'all' ? '' : `${filter} `;
  // The empty state's buttons go away with it: the search box takes the focus.
  const clearSearch = () => {
    onSearch?.('');
    searchRef.current?.focus();
  };
  const searchAll = () => {
    onFilter?.('all');
    searchRef.current?.focus();
  };
  // A change on its way: the account's selects take no other change until
  // it is answered (aria-disabled keeps the keyboard focus on them).
  const busy = (p) => !!changes.saving(p.id);
  const chooseStatus = (p) => (e) => {
    if (!busy(p)) changes.setStatus(p, e.target.value, { focusId: accountControlId(p.id, 'status') });
  };
  const approve = async (p) => {
    const ok = await changes.change(p, { status: 'approved' }, { kind: 'approve', focusId: accountControlId(p.id, 'status') });
    // Approve is gone once the account is approved: the status select takes the focus.
    document.getElementById(accountControlId(p.id, ok ? 'status' : 'approve'))?.focus();
  };

  return (
    <div>
      {/* TODO(owner): Should staff be able to set up and invite accounts for stores that phone in, and through which email service? (AW-113) */}
      <div className="admin-toolbar admin-account-toolbar">
        <label className="admin-account-search">Search accounts
          <input ref={searchRef} type="search" placeholder="Business, name, email or phone" maxLength={MAX_ACCOUNT_SEARCH} autoComplete="off"
            value={search} onChange={(e) => onSearch?.(e.target.value)} />
        </label>
      </div>
      <div className="sub-pills" role="group" aria-label="Account status">
        {ACCOUNT_STATUS_FILTERS.map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} className={`sub-pill${filter === s ? ' active' : ''}`} onClick={() => onFilter?.(s)}>
            {/* Labels, as on the order pills (AW-149). */}
            {`${s === 'all' ? 'All' : ADMIN_STATUS_LABELS[s]} (${counts[s]})`}
          </button>
        ))}
      </div>
      <p className="result-note admin-count" aria-live="polite">{accountCountText({ listed: inFilter, shown, filter, searching })}</p>
      {profilesError && <LoadProblem message={profilesError} onRetry={onRetry} retrying={retrying} />}
      {documentsError && <LoadProblem message={documentsError} onRetry={retryDocuments} retrying={documentsRetrying} />}
      {viewer.viewError && <p className="form-error" role="alert">{viewer.viewError}</p>}
      {changes.error && <p className="form-error" role="alert">{changes.error}</p>}
      {shown.length === 0 && !searching ? (
        <p className="result-note">{filter === 'all' ? 'No accounts yet.' : `No ${filter} accounts.`}</p>
      ) : shown.length === 0 ? (
        <div className="empty-results">
          <p>{`No ${kind}account matches “${search.trim()}”.`}</p>
          <div className="empty-actions">
            <button className="text-link" type="button" onClick={clearSearch}>Clear the search</button>
            {filter !== 'all' && <button className="text-link" type="button" onClick={searchAll}>Search all accounts</button>}
          </div>
        </div>
      ) : (
        <TableScroll label="Accounts table" resetKey={`${filter}\u0001${search}`}>
          {/* The Business column stays in view while the table scrolls
              sideways (AW-266). */}
          <table className="aw-table admin-accounts">
            <thead>
              <tr>
                {['Business', 'Contact', 'Status', 'Tier', 'Role', 'Documents', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(p => (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      <Link id={accountLinkId(p.id)} className="account-link" to={accountHref(p.id)} onClick={() => onOpen?.(accountHref(p.id))}>
                        {p.business || p.name || p.email || 'Unnamed account'}
                      </Link>
                    </td>
                    <td>
                      <span className="account-contact">
                        <span>{p.name || '—'}</span>
                        {p.email && <a href={`mailto:${p.email}`}><Email address={p.email} /></a>}
                        {p.phone && <a href={telHref(p.phone)}>{p.phone}</a>}
                      </span>
                    </td>
                    <td>
                      <select id={accountControlId(p.id, 'status')} aria-label={`Status for ${p.business || p.name}`} value={p.status}
                        disabled={p.id === currentAdminId} aria-disabled={busy(p) || undefined}
                        aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined} onChange={chooseStatus(p)}>
                        <option value="pending">{ADMIN_STATUS_LABELS.pending}</option>
                        <option value="approved">{ADMIN_STATUS_LABELS.approved}</option>
                        <option value="suspended">{ADMIN_STATUS_LABELS.suspended}</option>
                      </select>
                      {filter !== 'all' && accountStatus(p) !== filter && (
                        <span className="account-moved">{`Moved to ${accountStatus(p)}`}</span>
                      )}
                      {p.id === currentAdminId && <small className="field-hint" id="admin-own-row">Your own status and role can’t be changed here.</small>}
                      {p.approved_at && <small className="field-hint">{approvalLine(p, profiles)}</small>}
                    </td>
                    <td>
                      <select id={accountControlId(p.id, 'tier')} aria-label={`Tier for ${p.business || p.name}`} value={p.pricing_tier} aria-disabled={busy(p) || undefined}
                        onChange={e => { if (!busy(p)) changes.change(p, { pricing_tier: e.target.value }, { kind: 'tier', focusId: accountControlId(p.id, 'tier') }); }}>
                        {(tiers.includes(p.pricing_tier) ? tiers : [...tiers, p.pricing_tier]).map(t => <option key={t} value={t}>{tierLabel(t)}</option>)}
                      </select>
                    </td>
                    <td>
                      {/* A role change asks first, with a reason (AW-203);
                          making a pending or suspended account an admin approves it. */}
                      <select id={accountControlId(p.id, 'role')} aria-label={`Role for ${p.business || p.name}`} value={p.role}
                        disabled={p.id === currentAdminId} aria-disabled={busy(p) || undefined}
                        aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined}
                        onChange={e => { if (!busy(p)) changes.setRole(p, e.target.value); }}>
                        <option value="customer">{ROLE_LABELS.customer}</option>
                        <option value="admin">{ROLE_LABELS.admin}</option>
                      </select>
                    </td>
                    <td>
                      {/* Every status: the proof stays on file after approval (AW-197). */}
                      <ul className="doc-admin">
                        {DOCUMENT_TYPES.map(doc => {
                          const row = documents?.find(item => item.profile_id === p.id && item.document_type === doc.id);
                          return (
                            <li key={doc.id}>
                              <span>{doc.label}</span>
                              {row ? (
                                <>
                                  <span>On file</span>
                                  <DocumentView row={row} doc={doc} who={p.business || p.name} viewer={viewer} />
                                </>
                              ) : (
                                <span className="muted">{documents ? 'Not on file' : documentsError ? 'Couldn’t check' : 'Checking…'}</span>
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
                          onClick={() => toggleDetails(p)}
                        >
                          <span>{openId === p.id ? 'Hide' : 'Details'}</span>
                          <span className="sr-only">{` for ${p.business || p.name}`}</span>
                        </button>
                        {/* Approve stays (disabled) while its request is out, so
                            a double click sends one. */}
                        {(p.status === 'pending' || changes.saving(p.id) === 'approve') && (
                          <button id={accountControlId(p.id, 'approve')} className="button xs" type="button" disabled={busy(p)} onClick={() => approve(p)}>
                            <span>{changes.saving(p.id) === 'approve' ? 'Approving…' : 'Approve'}</span><span className="sr-only">{` ${p.business || p.name}`}</span>
                          </button>
                        )}
                        {/* No mail goes out on its own (AW-088): after approving,
                            staff send this from the desk's own mail. */}
                        {p.status === 'approved' && p.role !== 'admin' && p.email && !busy(p) && (
                          <a className="button xs ghost" href={approvalEmail(p)}>
                            <span>Email applicant</span><span className="sr-only">{` ${p.business || p.name}`}</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                  {openId === p.id && (
                    <tr className="account-detail-row" id={`account-details-${p.id}`}>
                      <td colSpan={7}>
                        <AccountFacts profile={p} profiles={profiles} />
                        <label className="account-note" htmlFor={`note-${p.id}`}>Verification note
                          <input id={`note-${p.id}`} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
                        </label>
                        <button className="button xs ghost" type="button" disabled={busy(p)}
                          onClick={async () => {
                            if (await changes.change(p, { verification_note: noteDraft.trim() || null }, { kind: 'note', undoable: false })) setNoteDraft(noteDraft.trim());
                          }}>Save note</button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {discarding && openProfile && (
        <ConfirmDialog
          title={`Discard the verification note for ${openProfile.business || openProfile.name || 'this account'}?`}
          body="The note you typed isn’t saved yet."
          confirmLabel="Discard the note" cancelLabel="Keep editing"
          onConfirm={() => { const { next } = discarding; setDiscarding(null); showDetails(next); }}
          onCancel={() => setDiscarding(null)}
        />
      )}
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
