// CSV for the admin back office (AW-114): writing a file staff open in a
// spreadsheet, reading one they saved, and handing it to the browser as a
// download. Pure except downloadCsv (csv.test.js).
//
//   toCsv(records)        RFC 4180 text: a UTF-8 BOM, CRLF line ends, quotes
//                         where needed, and spreadsheet formulas defused
//   parseCsv(text)        string[][]; quotes, doubled quotes, line breaks in
//                         quotes and a BOM are handled. Throws CsvError on a
//                         quote that never closes.
//   unguardCell(text)     a cell as it was before toCsv defused it
//   downloadCsv(name, text)
//
// The formula guard (OWASP "CSV injection"): a text cell that starts with
// =, +, -, @, a tab or a carriage return would run as a formula in Excel or
// Sheets, so it gets a leading apostrophe. Numbers and booleans are written
// as they are.

export const BOM = '\uFEFF';
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

export class CsvError extends Error {}

// One cell as written: guarded, then quoted if it holds a comma, a quote or
// a line break (quotes doubled).
export function csvCell(value) {
  if (value == null) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// records: arrays of cells (the first one usually the header row).
export function toCsv(records) {
  return BOM + records.map((record) => record.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// A cell toCsv defused, as typed: "'=SUM(A1)" -> "=SUM(A1)". Other cells,
// including ones that start with an apostrophe for another reason, are left
// alone.
export const unguardCell = (text) => (/^'[=+\-@\t\r]/.test(text) ? text.slice(1) : text);

// The records of a CSV file. A line break inside quotes stays in its cell;
// CRLF, LF and CR all end a record; a final line break adds no empty record.
export function parseCsv(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let cell = '';
  let quoted = false;
  let quoteLine = 0;
  let line = 1;
  let started = false; // the current record has content (or a separator)
  const endCell = () => { record.push(cell); cell = ''; };
  const endRecord = () => { endCell(); records.push(record); record = []; started = false; };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else {
        if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line += 1;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') { quoted = true; quoteLine = line; started = true; continue; }
    if (ch === ',') { endCell(); started = true; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      line += 1;
      endRecord();
      continue;
    }
    cell += ch;
    started = true;
  }
  if (quoted) throw new CsvError(`A quoted cell that starts on line ${quoteLine} never closes.`);
  if (started || cell !== '') endRecord();
  return records;
}

// Hands `text` to the browser as a file called `name`: a Blob behind a
// temporary <a download>. Nothing is uploaded or fetched.
export function downloadCsv(name, text, { doc = document, urls = URL } = {}) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const href = urls.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = href;
  link.download = name;
  link.hidden = true;
  doc.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download after click() returns.
  setTimeout(() => urls.revokeObjectURL(href), 1000);
  return blob;
}
