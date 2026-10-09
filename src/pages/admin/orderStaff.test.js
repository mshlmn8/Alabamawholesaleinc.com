// An order's staff side (AW-110): the merged, formatted history, the note
// check, the assignee options and the messages for a database without the
// October 2026 update.
import { describe, expect, it } from 'vitest';
import {
  MAX_NOTE, STAFF_NEEDS_UPDATE, assigneeOptions, checkNote, entryLine, hasAssignment, isMissingTable, staffLoadMessage, staffName, staffTimeline,
  statusLabel, whenText,
} from './orderStaff.js';

const NOW = new Date(2026, 9, 8, 12, 0);
const local = (month, day, hour, minute) => new Date(2026, month - 1, day, hour, minute).toISOString();
const ADMINS = [{ id: 'a1', name: 'Desk Admin', email: 'desk@example.test' }, { id: 'a2', name: '', email: 'pat@example.test' }];

describe('the history', () => {
  const events = [
    { id: 1, at: local(9, 28, 9, 14), actor: 'a1', kind: 'status', from_value: 'new', to_value: 'contacted', note: null, who: { name: 'Desk Admin' } },
    { id: 2, at: local(9, 29, 8, 0), actor: 'a1', kind: 'assignment', from_value: null, to_value: 'a2', note: null, who: { name: 'Desk Admin' } },
    { id: 3, at: local(9, 30, 16, 45), actor: null, kind: 'status', from_value: 'contacted', to_value: 'out_for_delivery', note: null, who: null },
    { id: 4, at: local(10, 1, 7, 5), actor: 'gone', kind: 'status', from_value: 'out_for_delivery', to_value: 'cancelled', note: 'Store closed', who: null },
    { id: 5, at: local(10, 1, 7, 5), actor: 'a2', kind: 'assignment', from_value: 'a2', to_value: null, note: null, who: null },
  ];
  const notes = [{ id: 9, created_at: local(9, 29, 10, 30), author: 'a2', body: 'Gate code 1234', who: { name: null, email: 'pat@example.test' } }];

  it('merges events and notes, newest first (same moment: the later row first)', () => {
    const entries = staffTimeline({ events, notes }, ADMINS);
    expect(entries.map((e) => e.key)).toEqual(['event-5', 'event-4', 'event-3', 'note-9', 'event-2', 'event-1']);
    expect(entries.map((e) => e.type)).toEqual(['assignment', 'status', 'status', 'note', 'assignment', 'status']);
  });

  it('writes each line as "What by Who · When"', () => {
    const lines = staffTimeline({ events, notes }, ADMINS).map((e) => entryLine(e, NOW));
    expect(lines).toEqual([
      'Unassigned by pat@example.test · Oct 1, 7:05 AM',
      'Cancelled · Oct 1, 7:05 AM',
      'Out for delivery · Sep 30, 4:45 PM',
      'Note by pat@example.test · Sep 29, 10:30 AM',
      'Assigned to pat@example.test by Desk Admin · Sep 29, 8:00 AM',
      'Contacted by Desk Admin · Sep 28, 9:14 AM',
    ]);
    const cancelled = staffTimeline({ events }, ADMINS)[1];
    expect(cancelled.note).toBe('Store closed');
    expect(staffTimeline({ notes }, ADMINS)[0].note).toBe('Gate code 1234');
  });

  it('names an assignee who is no longer an admin, and shows other years', () => {
    const [entry] = staffTimeline({ events: [{ id: 1, at: '2025-12-31T18:00:00Z', kind: 'assignment', to_value: 'x9', actor: null }] }, ADMINS);
    expect(entry.text).toBe('Assigned to a staff member');
    expect(whenText('2025-12-31T18:00:00Z', NOW)).toMatch(/^Dec 31, 2025, \d{1,2}:00 [AP]M$/);
    expect(whenText('soon', NOW)).toBe('');
    expect(staffTimeline()).toEqual([]);
  });

  it('labels statuses and staff', () => {
    expect(statusLabel('out_for_delivery')).toBe('Out for delivery');
    expect(statusLabel('')).toBe('');
    expect(staffName({ name: ' ', email: 'e@example.test' })).toBe('e@example.test');
    expect(staffName(null)).toBeNull();
  });
});

describe('notes and the assignee', () => {
  it('checks a note before it is saved', () => {
    expect(checkNote('  Call first  ')).toEqual({ ok: true, body: 'Call first' });
    expect(checkNote('   ')).toEqual({ ok: false, error: 'Write the note first.' });
    expect(checkNote('x'.repeat(MAX_NOTE))).toMatchObject({ ok: true });
    expect(checkNote('x'.repeat(MAX_NOTE + 1))).toEqual({ ok: false, error: 'Keep the note to 2,000 characters or fewer (it has 2,001).' });
  });

  it('offers nobody and each approved admin, and keeps a former one', () => {
    expect(assigneeOptions(ADMINS)).toEqual([
      { value: '', label: 'Nobody' }, { value: 'a1', label: 'Desk Admin' }, { value: 'a2', label: 'pat@example.test' },
    ]);
    expect(assigneeOptions(ADMINS, 'x9').at(-1)).toEqual({ value: 'x9', label: 'A former admin' });
  });
});

describe('feature detection (the live database before the October 2026 update)', () => {
  it('says the notes and history need the update when their tables are missing', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '42703' })).toBe(false);
    expect(staffLoadMessage({ code: 'PGRST205', message: 'Could not find the table' })).toBe(STAFF_NEEDS_UPDATE);
    expect(STAFF_NEEDS_UPDATE).toBe('Notes and history need the October 2026 database update (see BACKEND.md).');
    expect(staffLoadMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/^The notes and history didn’t load: the database couldn’t be reached/);
    expect(staffLoadMessage(null)).toBeNull();
  });

  it('shows "Assigned to" only when the orders carry assigned_to', () => {
    expect(hasAssignment([{ id: 1, assigned_to: null }])).toBe(true);
    expect(hasAssignment([{ id: 1 }])).toBe(false);
    expect(hasAssignment(null)).toBe(false);
  });
});
