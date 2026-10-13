// The admin screens' one way of writing a date (NEW-038): 'Oct 1, 2026',
// and with the time 'Oct 1, 2026, 10:00 AM', in US English whatever the
// browser's language. Pure (dates.test.js).
//
//   adminDate(value, empty = '—')       'Oct 1, 2026'
//   adminDateTime(value, empty = '—')   'Oct 1, 2026, 10:00 AM'
//
// value: an ISO string, a Date or milliseconds; `empty` for none or an
// invalid one. The month, day, year, hour and minute are named one by one
// (not dateStyle/timeStyle, which Safari 14 and Firefox 78 ignore). The
// buyer's 'Uploaded on October 1, 2026' (documents.js formatUploadedOn) is
// a different, deliberate format; a staff note's time ('Oct 2, 9:00 AM',
// orderStaff.js whenText) leaves out this year.

const DAY = { month: 'short', day: 'numeric', year: 'numeric' };
const DAY_TIME = { ...DAY, hour: 'numeric', minute: '2-digit' };

function asDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function adminDate(value, empty = '—') {
  const date = asDate(value);
  return date ? date.toLocaleDateString('en-US', DAY) : empty;
}

export function adminDateTime(value, empty = '—') {
  const date = asDate(value);
  return date ? date.toLocaleString('en-US', DAY_TIME) : empty;
}
