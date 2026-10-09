// Changes to an account's status, tier, role and verification note, from the
// Accounts list and from the account page (AW-112, AW-113):
//
// - The change shows at once (the row is patched where it is, no reload, so
//   the licence documents are never fetched again), and goes back, with the
//   reason, if the database refuses it.
// - One request per account at a time: while one is on its way, the account's
//   selects ignore changes (aria-disabled: a disabled select would drop the
//   keyboard focus) and Approve is disabled, so a double click sends one.
// - The status line says what changed, with Undo for 8 seconds; Undo puts the
//   previous values back the same way.
// - Suspending asks first, with a required reason (ConfirmDialog), and the
//   reason goes in the account's internal notes (profile_admin_notes,
//   20261009140000). Without that table, or if the note isn't saved, the
//   page says the account is suspended but the reason wasn't saved.
// - The admin's own status and role can't be changed (the database refuses
//   it too, hint own_role_status).
//
//   const changes = useAccountChanges({ setProfiles, currentAdminId, notify });
//   changes.change(row, { pricing_tier: 'gold' }, { focusId });
//   changes.setStatus(row, 'suspended', { focusId, onNote });
//   changes.saving(row.id)   'approve' | 'status' | … while a request is out
//   {changes.error && …}  <AccountChangeDialog changes={changes} />

import { useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { MAX_NOTE, isMissingTable } from './orderStaff.js';
import { profileChangeText, profileSaveError } from './accountParts.jsx';
import { accountName } from './accountDetail.js';

// An account's internal notes (profile_admin_notes): the author's name comes
// from the accounts already loaded.
export const ACCOUNT_NOTE_SELECT = 'id, profile_id, author, body, created_at';
export const OWN_ROW_MESSAGE = 'You can’t change your own status or role.';
// The live database before the October 2026 update has no
// profile_admin_notes.
export const NOTES_NEED_UPDATE = 'Internal notes need the October 2026 database update (see BACKEND.md).';

// The id of an account's control, for the focus after Undo or Approve.
export const accountControlId = (id, control, where = 'list') => `account-${where}-${control}-${id}`;

const focusOn = (id) => {
  if (id) document.getElementById(id)?.focus();
};

export function useAccountChanges({ setProfiles, currentAdminId, notify }) {
  // The accounts with a request on its way (id -> kind); the ref answers at
  // once, before React renders, so a second click in the same moment is
  // turned away too.
  const savingRef = useRef(new Map());
  const [saving, setSaving] = useState(() => new Map());
  const [error, setError] = useState(null);
  const [suspending, setSuspending] = useState(null); // { row, focusId, onNote }
  const [suspendBusy, setSuspendBusy] = useState(false);

  const patchRow = (id, patch) => setProfiles((list) => list?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? list);
  const begin = (id, kind) => {
    savingRef.current.set(id, kind);
    setSaving(new Map(savingRef.current));
  };
  const end = (id) => {
    savingRef.current.delete(id);
    setSaving(new Map(savingRef.current));
  };

  // Saves `patch` on the account. Returns true when it was saved.
  // options: kind (what saving() reports), undoable (offer Undo), focusId
  // (the control Undo gives the focus back to), quiet (no status line).
  const change = async (row, patch, { kind = 'change', undoable = true, focusId = null, quiet = false } = {}) => {
    if (savingRef.current.has(row.id)) return false;
    const who = accountName(row);
    if (row.id === currentAdminId && ('status' in patch || 'role' in patch)) {
      setError(OWN_ROW_MESSAGE);
      return false;
    }
    const previous = Object.fromEntries(Object.keys(patch).map((key) => [key, row[key] ?? null]));
    setError(null);
    begin(row.id, kind);
    patchRow(row.id, patch);
    // The whole row comes back, so the approval stamp (approved_at, set by
    // the database) shows at once.
    const { data, error: writeError } = await checkedWrite(supabase.from('profiles').update(patch).eq('id', row.id), '*');
    end(row.id);
    if (writeError) {
      patchRow(row.id, previous);
      setError(profileSaveError(writeError, who));
      return false;
    }
    const saved = Array.isArray(data) ? data[0] : data;
    if (saved && typeof saved === 'object') patchRow(row.id, { ...saved, ...patch });
    if (quiet) return true;
    // No Undo back into a suspension: that asks for a reason.
    const canUndo = undoable && previous.status !== 'suspended';
    notify?.(profileChangeText(who, patch), canUndo ? {
      undo: () => {
        focusOn(focusId);
        change({ ...row, ...patch }, previous, { kind, undoable: false, focusId });
      },
    } : undefined);
    return true;
  };

  // A status from a select: suspending asks for a reason first; the select
  // keeps the saved status until then. onNote(note): the reason's note, once
  // it is saved.
  const setStatus = (row, status, { focusId = null, onNote = null } = {}) => {
    if (savingRef.current.has(row.id) || status === row.status) return;
    if (status === 'suspended') {
      if (row.id === currentAdminId) {
        setError(OWN_ROW_MESSAGE);
        return;
      }
      setError(null);
      setSuspending({ row, focusId, onNote });
      return;
    }
    change(row, { status }, { kind: 'status', focusId });
  };

  const confirmSuspend = async (reason) => {
    const { row, onNote } = suspending;
    const who = accountName(row);
    setSuspendBusy(true);
    const ok = await change(row, { status: 'suspended' }, { kind: 'status', undoable: false, quiet: true });
    if (!ok) {
      setSuspendBusy(false);
      setSuspending(null);
      return;
    }
    let result;
    try {
      result = await supabase.from('profile_admin_notes').insert({ profile_id: row.id, body: `Suspended: ${reason}` }).select(ACCOUNT_NOTE_SELECT).single();
    } catch (insertError) {
      result = { error: insertError };
    }
    setSuspendBusy(false);
    setSuspending(null);
    const noteError = withStatus(result || {});
    if (noteError) {
      const lost = `${who} is suspended, but the reason wasn’t saved`;
      setError(isMissingTable(noteError) ? `${lost}: internal notes need the October 2026 database update (see BACKEND.md).` : adminErrorMessage(noteError, lost));
      return;
    }
    if (result.data) onNote?.(result.data);
    notify?.(`${who} is suspended. The reason is in its internal notes.`);
  };

  const dialog = suspending ? (
    <ConfirmDialog
      title={`Suspend ${accountName(suspending.row)}?`}
      body="A suspended account sees no prices and can’t send orders or quotes until it is approved again. Say why: the reason goes in the account’s internal notes, which only staff see."
      confirmLabel="Suspend the account" cancelLabel="Keep it" reasonLabel="Reason for suspending" reasonMax={MAX_NOTE - 'Suspended: '.length}
      busy={suspendBusy} onConfirm={confirmSuspend} onCancel={() => { if (!suspendBusy) setSuspending(null); }}
    />
  ) : null;

  return {
    change, setStatus, dialog, error, clearError: () => setError(null),
    saving: (id) => saving.get(id) || null,
  };
}

// The suspend confirmation, where the page renders it.
export function AccountChangeDialog({ changes }) {
  return changes.dialog;
}
