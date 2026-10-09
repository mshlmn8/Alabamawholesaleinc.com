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
// - Suspending, making an account an admin and removing admin access ask
//   first, with a required reason (ConfirmDialog, AW-112, AW-203), and the
//   reason goes in the account's internal notes (profile_admin_notes,
//   20261009140000): "Suspended: …", "Made an admin: …", "Admin access
//   removed: …". Without that table, or if the note isn't saved, the page
//   says the change was made but the reason wasn't saved. These have no Undo
//   (it would skip the question). The database logs role changes too
//   (profile_status_log, 20261011111000).
// - The admin's own status and role can't be changed (the database refuses
//   it too, hint own_role_status).
//
//   const changes = useAccountChanges({ setProfiles, currentAdminId, notify });
//   changes.change(row, { pricing_tier: 'gold' }, { focusId });
//   changes.setStatus(row, 'suspended', { focusId, onNote });
//   changes.setRole(row, 'admin', { focusId, onNote });
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
  // The change waiting for its reason: { action, row, patch, onNote }.
  const [confirming, setConfirming] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  // Asks for the reason of a change (CONFIRMED_CHANGES); the select keeps
  // the saved value until it is confirmed, and Cancel gives it the focus
  // back (ModalLayer).
  const ask = (action, row, patch, onNote) => {
    if (row.id === currentAdminId) {
      setError(OWN_ROW_MESSAGE);
      return;
    }
    setError(null);
    setConfirming({ action, row, patch, onNote });
  };

  // A status from a select: suspending asks for a reason first. onNote(note):
  // the reason's note, once it is saved.
  const setStatus = (row, status, { focusId = null, onNote = null } = {}) => {
    if (savingRef.current.has(row.id) || status === row.status) return;
    if (status === 'suspended') {
      ask('suspend', row, { status: 'suspended' }, onNote);
      return;
    }
    change(row, { status }, { kind: 'status', focusId });
  };

  // A role from a select (AW-203): both ways ask for a reason first. An
  // admin must be an approved account (is_admin()), so making a pending or
  // suspended account an admin approves it too.
  const setRole = (row, role, { onNote = null } = {}) => {
    if (savingRef.current.has(row.id) || role === row.role) return;
    if (role === 'admin') ask('make-admin', row, row.status === 'approved' ? { role: 'admin' } : { role: 'admin', status: 'approved' }, onNote);
    else ask('remove-admin', row, { role }, onNote);
  };

  const confirmChange = async (reason) => {
    const { action, row, patch, onNote } = confirming;
    const text = CONFIRMED_CHANGES[action];
    const who = accountName(row);
    setConfirmBusy(true);
    const ok = await change(row, patch, { kind: text.kind, undoable: false, quiet: true });
    if (!ok) {
      setConfirmBusy(false);
      setConfirming(null);
      return;
    }
    let result;
    try {
      result = await supabase.from('profile_admin_notes').insert({ profile_id: row.id, body: `${text.note}${reason}` }).select(ACCOUNT_NOTE_SELECT).single();
    } catch (insertError) {
      result = { error: insertError };
    }
    setConfirmBusy(false);
    setConfirming(null);
    const noteError = withStatus(result || {});
    if (noteError) {
      const lost = `${text.done(who)}, but the reason wasn’t saved`;
      setError(isMissingTable(noteError) ? `${lost}: internal notes need the October 2026 database update (see BACKEND.md).` : adminErrorMessage(noteError, lost));
      return;
    }
    if (result.data) onNote?.(result.data);
    notify?.(`${text.done(who)}. The reason is in its internal notes.`);
  };

  const asked = confirming ? CONFIRMED_CHANGES[confirming.action] : null;
  const dialog = confirming ? (
    <ConfirmDialog
      title={asked.title(accountName(confirming.row))}
      body={asked.body(confirming.row)}
      confirmLabel={asked.confirm} cancelLabel={asked.cancel} reasonLabel={asked.reason} reasonHint={asked.hint}
      reasonMax={MAX_NOTE - asked.note.length}
      busy={confirmBusy} onConfirm={confirmChange} onCancel={() => { if (!confirmBusy) setConfirming(null); }}
    />
  ) : null;

  return {
    change, setStatus, setRole, dialog, error, clearError: () => setError(null),
    saving: (id) => saving.get(id) || null,
  };
}

// The changes that ask for a reason first: the dialog's words, the note's
// prefix and what the status line says once it is done.
const NOTE_HINT = 'It goes in the account’s internal notes, which only staff see.';
export const CONFIRMED_CHANGES = {
  suspend: {
    kind: 'status',
    title: (who) => `Suspend ${who}?`,
    body: () => 'A suspended account sees no prices and can’t send orders or quotes until it is approved again. Say why: the reason goes in the account’s internal notes, which only staff see.',
    confirm: 'Suspend the account',
    cancel: 'Keep it',
    reason: 'Reason for suspending',
    hint: null,
    note: 'Suspended: ',
    done: (who) => `${who} is suspended`,
  },
  'make-admin': {
    kind: 'role',
    title: (who) => `Make ${who} an admin?`,
    body: (row) => `Admins can see every order, application, EIN and licence document, and change prices and accounts.${row.status === 'approved' ? '' : ' This also approves the account.'}`,
    confirm: 'Make an admin',
    cancel: 'Cancel',
    reason: 'Reason',
    hint: NOTE_HINT,
    note: 'Made an admin: ',
    done: (who) => `${who} is now an admin`,
  },
  'remove-admin': {
    kind: 'role',
    title: (who) => `Remove admin access from ${who}?`,
    body: () => 'They keep their customer account and lose Admin.',
    confirm: 'Remove admin access',
    cancel: 'Cancel',
    reason: 'Reason',
    hint: NOTE_HINT,
    note: 'Admin access removed: ',
    done: (who) => `${who} no longer has admin access`,
  },
};

// The suspend and role confirmations, where the page renders them.
export function AccountChangeDialog({ changes }) {
  return changes.dialog;
}
