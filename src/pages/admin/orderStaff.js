// An order's staff side (AW-110): internal notes, who it is assigned to, and
// the history of its status and assignment (order_events and
// order_admin_notes, 20261010122000). Pure (orderStaff.test.js); the panel is
// OrderStaff.jsx.

import { adminErrorMessage } from './adminData.js';

export const MAX_NOTE = 2000;
export const STAFF_NEEDS_UPDATE = 'Notes and history need the October 2026 database update (see BACKEND.md).';

// The rows the panel reads, each with the name of the staff member who
// wrote it (one foreign key to profiles each).
export const ORDER_EVENTS_SELECT = 'id, order_id, at, actor, kind, from_value, to_value, note, who:profiles!order_events_actor_fkey(name, email)';
export const ORDER_NOTES_SELECT = 'id, order_id, author, body, created_at, who:profiles!order_admin_notes_author_fkey(name, email)';

// A table the database doesn't have yet (the live one before the October
// 2026 update).
const MISSING_TABLE = ['PGRST205', '42P01'];
export const isMissingTable = (error) => MISSING_TABLE.includes(String(error?.code ?? ''));

// What the panel says when its notes or history didn't load.
export function staffLoadMessage(error) {
  if (!error) return null;
  if (isMissingTable(error)) return STAFF_NEEDS_UPDATE;
  return adminErrorMessage(error, 'The notes and history didn’t load');
}

// Whether the orders on screen have the assigned_to column: without it (the
// live database before the update) there is no "Assigned to" select.
export const hasAssignment = (orders) => (orders || []).some((o) => o && 'assigned_to' in o);

// 'out_for_delivery' -> 'Out for delivery'.
export function statusLabel(status) {
  const text = String(status ?? '').replace(/_/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

// A staff member's name as the history shows it: the profile's name, else
// its email; null when unknown.
export const staffName = (profile) => (profile?.name && String(profile.name).trim()) || profile?.email || null;

// The note as it is saved, or what is wrong with it.
export function checkNote(text) {
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, error: 'Write the note first.' };
  if (body.length > MAX_NOTE) {
    return { ok: false, error: `Keep the note to ${MAX_NOTE.toLocaleString('en-US')} characters or fewer (it has ${body.length.toLocaleString('en-US')}).` };
  }
  return { ok: true, body };
}

// 'Sep 28, 9:14 AM'; the year too when it isn't this year.
export function whenText(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return date.toLocaleString('en-US', options);
}

// What an event did: 'Contacted', 'Assigned to Pat', 'Unassigned'.
function eventText(event, nameOf) {
  if (event.kind === 'assignment') {
    return event.to_value ? `Assigned to ${nameOf(event.to_value) || 'a staff member'}` : 'Unassigned';
  }
  return statusLabel(event.to_value) || 'Status changed';
}

// The history and the notes as one list, newest first:
// [{ key, type: 'status'|'assignment'|'note', at, text, by, note }].
// admins: the approved admins ({ id, name, email }), for names the rows
// don't carry (an assignee).
export function staffTimeline({ events = [], notes = [] } = {}, admins = []) {
  const nameOf = (id) => staffName(admins.find((a) => a.id === id));
  const entries = [
    ...events.map((e) => [Number(e.id) || 0, {
      key: `event-${e.id}`, type: e.kind === 'assignment' ? 'assignment' : 'status', at: e.at,
      text: eventText(e, nameOf), by: staffName(e.who) || nameOf(e.actor), note: e.note || null,
    }]),
    ...notes.map((n) => [Number(n.id) || 0, {
      key: `note-${n.id}`, type: 'note', at: n.created_at,
      text: 'Note', by: staffName(n.who) || nameOf(n.author), note: n.body,
    }]),
  ];
  const time = (entry) => {
    const t = Date.parse(entry.at);
    return Number.isNaN(t) ? 0 : t;
  };
  // Newest first; rows of the same moment (one transaction) by id.
  return entries.sort(([a, x], [b, y]) => time(y) - time(x) || b - a).map(([, entry]) => entry);
}

// One line of the history: 'Contacted by Desk Admin · Sep 28, 9:14 AM'.
export function entryLine(entry, now = new Date()) {
  const what = entry.by ? `${entry.text} by ${entry.by}` : entry.text;
  return [what, whenText(entry.at, now)].filter(Boolean).join(' · ');
}

// The "Assigned to" options: nobody, then each approved admin by name.
export function assigneeOptions(admins = [], current = null) {
  const options = [{ value: '', label: 'Nobody' }, ...admins.map((a) => ({ value: a.id, label: staffName(a) || 'Unnamed admin' }))];
  // An assignee who is no longer an approved admin still shows.
  if (current && !admins.some((a) => a.id === current)) options.push({ value: current, label: 'A former admin' });
  return options;
}
