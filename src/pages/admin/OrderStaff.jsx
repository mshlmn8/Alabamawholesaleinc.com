// "Staff notes and history" under an order card (AW-110): who the order is
// assigned to, internal notes, and the history of its status and
// assignment, merged newest first. It loads when it is opened, and again
// when the order changes (its updated_at). Customers never see any of it:
// the notes and history are admin-only tables (20261010122000), and
// orders.assigned_to is only a staff id.
//
// Feature detection (the live database before the October 2026 update):
// without the tables the panel says it needs the update; without the
// assigned_to column (no 'assigned_to' key in the loaded orders) there is no
// "Assigned to" select.

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import {
  ORDER_EVENTS_SELECT, ORDER_NOTES_SELECT, STAFF_NEEDS_UPDATE, assigneeOptions, checkNote, entryLine, isMissingTable, staffLoadMessage,
  staffName, staffTimeline,
} from './orderStaff.js';

// order: the order's row. admins: the approved admins, or null while they
// load. assignment: the database has orders.assigned_to. onAssigned(id,
// assignedTo, updatedAt): the list patches its row. notify: the status line.
export function OrderStaff({ order, admins, assignment, onAssigned, notify }) {
  const id = useId();
  const [data, setData] = useState(null); // { events, notes }
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // The history again whenever the order changes (a status change, an
  // assignment, another admin's edit heard by the list).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('order_events').select(ORDER_EVENTS_SELECT).eq('order_id', order.id).order('at', { ascending: false }),
      supabase.from('order_admin_notes').select(ORDER_NOTES_SELECT).eq('order_id', order.id).order('created_at', { ascending: false }),
    ]).then(([events, notes]) => {
      if (cancelled) return;
      setRetrying(false);
      const error = withStatus(events) || withStatus(notes);
      if (error) {
        if (isMissingTable(error)) setMissing(true);
        else setLoadError(staffLoadMessage(error));
        return;
      }
      setLoadError(null);
      setData({ events: events.data || [], notes: notes.data || [] });
    }, (error) => {
      if (cancelled) return;
      setRetrying(false);
      setLoadError(staffLoadMessage(error));
    });
    return () => { cancelled = true; };
  }, [order.id, order.updated_at, attempt]);
  const retry = () => {
    setRetrying(true);
    setAttempt((n) => n + 1);
  };

  // Adding a note.
  const noteRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);
  useLeaveGuard(draft.trim() !== '', `Your note on ${order.ref_num} isn’t saved. Leave without saving it?`);
  const addNote = async (event) => {
    event.preventDefault();
    const checked = checkNote(draft);
    if (!checked.ok) {
      setNoteError(checked.error);
      noteRef.current?.focus();
      return;
    }
    setSaving(true);
    setNoteError('');
    let result;
    try {
      result = await supabase.from('order_admin_notes').insert({ order_id: order.id, body: checked.body }).select(ORDER_NOTES_SELECT).single();
    } catch (error) {
      result = { error };
    }
    setSaving(false);
    const error = withStatus(result);
    if (error) {
      if (isMissingTable(error)) setMissing(true);
      else setNoteError(adminErrorMessage(error, 'The note wasn’t saved'));
      return;
    }
    setDraft('');
    if (result.data) setData((current) => ({ events: current?.events || [], notes: [result.data, ...(current?.notes || []).filter((n) => n.id !== result.data.id)] }));
    notify?.(`Added a note to ${order.ref_num}.`);
  };

  // The assignment: shown at once, and back to the saved one (with the
  // reason) if the database refuses it.
  const [pending, setPending] = useState(undefined);
  const [assignError, setAssignError] = useState('');
  const saved = order.assigned_to ?? '';
  const shown = pending !== undefined ? pending : saved;
  const nameOf = (value) => (value ? staffName((admins || []).find((a) => a.id === value)) || 'a former admin' : null);
  const assign = async (event) => {
    const value = event.target.value;
    setPending(value);
    setAssignError('');
    const { data: rows, error } = await checkedWrite(
      supabase.from('orders').update({ assigned_to: value || null }).eq('id', order.id),
      'id, assigned_to, updated_at',
    );
    setPending(undefined);
    if (error) {
      setAssignError(`${adminErrorMessage(error, 'The assignment wasn’t saved')} ${saved ? `It is still assigned to ${nameOf(saved)}.` : 'It is still unassigned.'}`);
      return;
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    onAssigned?.(order.id, value || null, row?.updated_at ?? null);
    notify?.(value ? `${order.ref_num} is assigned to ${nameOf(value)}.` : `${order.ref_num} is unassigned.`);
  };

  const entries = data ? staffTimeline(data, admins || []) : null;
  const noteId = `${id}-note`;

  return (
    <div className="order-staff-body">
      {assignment && (
        <div className="form-grid order-assign">
          <div>
            <label htmlFor={`${id}-assignee`}>Assigned to</label>
            <select
              id={`${id}-assignee`} value={shown} disabled={!admins} onChange={assign}
              aria-invalid={assignError ? true : undefined} aria-describedby={assignError ? `${id}-assign-error` : undefined}
            >
              {assigneeOptions(admins || [], saved || null).map((option) => <option key={option.value || 'nobody'} value={option.value}>{option.label}</option>)}
            </select>
            {assignError && <p className="form-error" id={`${id}-assign-error`} role="alert">{assignError}</p>}
          </div>
        </div>
      )}
      {missing ? (
        <p className="result-note">{STAFF_NEEDS_UPDATE}</p>
      ) : (
        <>
          <form className="form-grid order-note-form" onSubmit={addNote} noValidate>
            <div className="full">
              <label htmlFor={noteId}>Add a staff note</label>
              <textarea
                id={noteId} ref={noteRef} rows={3} value={draft}
                aria-invalid={noteError ? true : undefined} aria-describedby={`${noteId}-hint ${noteId}-error`}
                onChange={(e) => { setDraft(e.target.value); if (noteError) setNoteError(''); }}
              />
              <small className="field-hint" id={`${noteId}-hint`}>Only staff see these notes. They never print and never reach the customer.</small>
              <p className="form-error" id={`${noteId}-error`}>{noteError}</p>
            </div>
            <div className="full">
              <button className="button xs" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add note'}</button>
            </div>
          </form>
          {loadError && <LoadProblem message={loadError} onRetry={retry} retrying={retrying} />}
          {!loadError && !entries && <p className="result-note">Loading…</p>}
          {entries && entries.length === 0 && <p className="result-note">No notes or changes yet.</p>}
          {entries && entries.length > 0 && (
            <ol className="order-timeline" aria-label={`Notes and history of ${order.ref_num}`}>
              {entries.map((entry) => (
                <li key={entry.key} className={`order-timeline-${entry.type}`}>
                  <p className="order-timeline-line">{entryLine(entry)}</p>
                  {entry.note && <p className="order-timeline-text">{entry.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
