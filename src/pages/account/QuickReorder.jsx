// Quick entry by SKU and quantity for signed-in buyers. Each row resolves
// live against the catalog; a bare SKU of a multi-variant product asks for a
// variant before its line can be added. A code that more than one product
// answers to asks which product first (AW-074): a guard kept for live
// databases that still have duplicate SKUs, and for codes two products reach
// through a variant suffix or SKU_ALIASES (see resolveSkuLine in
// src/lib/lines.js).
//
// Quantities follow the one rule in src/lib/quantity.js (AW-100, AW-013): a
// whole number from 1 to 100,000. Anything else (0, 2.5, 150000) is a row
// that needs attention, said in the row, and never rounded. The form doesn't
// use the browser's own validation, so such a row never blocks the rows that
// are ready.
//
// It starts with one row (AW-109). An empty row has no status cell, and
// Remove shows on a row only when there is another row or something typed.
// A new row (Add another line), the row after a removed one and the first row
// after an add take focus. An approved buyer sees each matched row's unit
// price and line total. 'Paste a list' takes 'SKU, qty' lines (a tab or a
// space works too) and turns them into rows.
//
// The Qty box is a text box with the numeric keyboard, like every other
// quantity on the site (NEW-060): what was typed or pasted stays in view,
// and the row says when it can't be ordered.
//
// Screen readers (NEW-012): a SKU box is described by its row's status cell
// and is aria-invalid when the code isn't in the catalog. The status cell is
// not a live region, since it would speak on every keystroke. A row's result
// is announced instead, once typing in its SKU box pauses (SKU_PAUSE_MS) or
// the box loses focus, and only when the result changed. A product or variant
// chosen from a row's list is announced at once, and focus moves on to what
// is left to fill in, since the list itself goes away.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveSkuLine, variantSku } from '../../lib/lines.js';
import { brandLabel, formatMoney } from '../../lib/format.js';
import { lineTotal, priceLabel } from '../../lib/pricing.js';
import { announce } from '../../lib/announce.js';
import { QTY_RANGE_TEXT, readQty } from '../../lib/quantity.js';

const START_ROWS = 1;
let rowSeq = 0;
const blankRow = (fill = {}) => ({ key: `qr-${++rowSeq}`, sku: '', qty: 1, productId: null, variant: null, ...fill });
const freshRows = () => Array.from({ length: START_ROWS }, () => blankRow());
// The row's quantity, or 0 when it isn't one that can be ordered.
const rowQty = (row) => readQty(row.qty).qty ?? 0;
const QTY_HINT = `Enter ${QTY_RANGE_TEXT}.`;
// How long typing in a SKU box pauses before the row's result is announced.
export const SKU_PAUSE_MS = 700;
// '2,500 units', '1 line' (NEW-035).
const count = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

// 'Paste a list': one 'SKU, qty', 'SKU<tab>qty' or 'SKU qty' per line; a
// line without a quantity is for 1. At most MAX_PASTE_LINES lines.
//
// The SKU is the first word of the line, without the quotes a spreadsheet's
// CSV puts around it; everything after the first comma, tab or space is the
// quantity (NEW-011). So 'AW-KITE, 1,000' is 1,000 of AW-KITE, never 1.
export const MAX_PASTE_LINES = 100;
const PASTED_LINE = /^\s*"?([^",\s]+)"?\s*(?:[,\s]\s*(.*?))?\s*$/;
// A count written with thousands separators, each in its place: 1,000 and
// 12,500, not 1,00 or 1000,5.
const GROUPED_COUNT = /^\d{1,3}(,\d{3})+$/;

// The quantity part of a pasted line, as the row's Qty box will hold it. The
// quotes around it, a leading 'x' or '×' ('x4') and the thousands separators
// of a grouped count ('1,000') go. Anything else stays exactly as written, so
// the row says it can't be ordered (readQty) rather than taking a number from
// the start of it: '4 cases' is not 4, and '2.5' is not 2.
export function pastedQty(text) {
  const qty = String(text ?? '').trim().replace(/^"(.*)"$/, '$1').trim().replace(/^[x×]\s*(?=\d)/i, '');
  if (qty === '') return '1';
  return GROUPED_COUNT.test(qty) ? qty.replace(/,/g, '') : qty;
}

export function parsePastedList(text) {
  const lines = String(text ?? '').split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.slice(0, MAX_PASTE_LINES).map((line) => {
    const match = PASTED_LINE.exec(line);
    // A line that doesn't start with a code (', 4') stays whole as the SKU,
    // so its row says it isn't in the catalog.
    if (!match) return { sku: line, qty: '1' };
    return { sku: match[1], qty: pastedQty(match[2]) };
  });
  return { rows, skipped: Math.max(0, lines.length - MAX_PASTE_LINES) };
}
const PASTE_EMPTY = 'Paste at least one line: a SKU, then its quantity.';

// What a row's SKU came to, for the live region (NEW-012); null for a row
// with nothing typed.
export function skuResultText(res) {
  switch (res?.status) {
    case 'ok': return `${res.product.name}${res.variant ? ` — ${res.variant}` : ''} matched.`;
    case 'not-found': return 'Not in the catalog.';
    case 'choose-variant': return `Choose a variant of ${res.product.name}.`;
    case 'choose-product': return 'Choose a product: more than one has this code.';
    default: return null;
  }
}

export function QuickReorder({ products, addLines, onOpenCart, isApprovedBuyer, priceOf, pricesStatus }) {
  const [rows, setRows] = useState(freshRows);
  const [summary, setSummary] = useState(null);
  // The box that takes focus once it is on the page: { key, field }, where
  // field is 'sku' (the default), 'qty' or 'choice' (the row's list).
  const [focusRequest, setFocusRequest] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(null);
  // The rows' boxes by `${key}:${field}`.
  const fields = useRef(new Map());
  // NEW-012: rows typed in since their result was last announced (key ->
  // pause timer), and the result last announced per row (key -> text).
  const typing = useRef(new Map());
  const spoken = useRef(new Map());
  const uid = useId();
  const pasteId = `${uid}-paste`;

  useEffect(() => {
    if (focusRequest) fields.current.get(`${focusRequest.key}:${focusRequest.field || 'sku'}`)?.focus();
  }, [focusRequest]);

  const resolved = useMemo(
    () => rows.map((row) => ({ row, res: resolveSkuLine(products, row.sku, { productId: row.productId, variant: row.variant }) })),
    [rows, products]
  );
  // The pause timer reads the rows as they are when it fires.
  const latest = useRef(resolved);
  useEffect(() => { latest.current = resolved; }, [resolved]);
  useEffect(() => {
    const timers = typing.current;
    return () => { for (const timer of timers.values()) window.clearTimeout(timer); };
  }, []);

  const ready = resolved.filter(({ row, res }) => res.status === 'ok' && rowQty(row) > 0);
  const attention = resolved.filter(({ row, res }) => res.status !== 'empty' && !(res.status === 'ok' && rowQty(row) > 0));
  const target = isApprovedBuyer ? 'order' : 'quote';

  const update = (key, patch) => setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const fieldRef = (key, field) => (el) => {
    if (el) fields.current.set(`${key}:${field}`, el);
    else fields.current.delete(`${key}:${field}`);
  };
  // Announces a row's result unless it is the one last announced for it.
  const sayResult = (key, res) => {
    const text = skuResultText(res);
    if ((spoken.current.get(key) ?? null) === text) return;
    spoken.current.set(key, text);
    if (text) announce(text);
  };
  // A pause in typing, or leaving the box: the row's result, if it was typed
  // in since the last time.
  const settleSku = (key) => {
    if (!typing.current.has(key)) return;
    window.clearTimeout(typing.current.get(key));
    typing.current.delete(key);
    const entry = latest.current.find(({ row }) => row.key === key);
    if (entry) sayResult(key, entry.res);
  };
  const typeSku = (key, sku) => {
    update(key, { sku, productId: null, variant: null });
    window.clearTimeout(typing.current.get(key));
    typing.current.set(key, window.setTimeout(() => settleSku(key), SKU_PAUSE_MS));
  };
  // A product or variant picked from the row's list. The list goes away, so
  // focus moves on: to the variant list when one is still needed, else to Qty.
  const choose = (row, patch) => {
    const next = { ...row, ...patch };
    update(row.key, patch);
    const res = resolveSkuLine(products, next.sku, { productId: next.productId, variant: next.variant });
    sayResult(row.key, res);
    setFocusRequest({ key: row.key, field: res.status === 'ok' ? 'qty' : res.status === 'empty' || res.status === 'not-found' ? 'sku' : 'choice' });
  };
  const forget = (key) => {
    window.clearTimeout(typing.current.get(key));
    typing.current.delete(key);
    spoken.current.delete(key);
  };

  // Focus goes to the row that takes the removed one's place, else the one
  // before it; the last row is emptied instead of removed.
  const remove = (key) => {
    const i = rows.findIndex((r) => r.key === key);
    if (i === -1) return;
    forget(key);
    const next = rows.length > 1 ? rows.filter((r) => r.key !== key) : [blankRow()];
    setRows(next);
    setFocusRequest({ key: (next[i] || next[next.length - 1]).key });
  };
  const addRow = () => {
    const row = blankRow();
    setRows((current) => [...current, row]);
    setFocusRequest({ key: row.key });
  };
  // Pasted lines replace the empty rows at the end.
  const addPasted = () => {
    const { rows: pasted, skipped } = parsePastedList(pasteText);
    if (!pasted.length) {
      setPasteError(PASTE_EMPTY);
      return;
    }
    const added = pasted.map((fill) => blankRow(fill));
    setRows((current) => {
      let end = current.length;
      while (end > 0 && current[end - 1].sku.trim() === '') end -= 1;
      return [...current.slice(0, end), ...added];
    });
    setPasteText('');
    setPasteError(null);
    announce(`Added ${added.length} row${added.length === 1 ? '' : 's'}.${skipped ? ` Only the first ${MAX_PASTE_LINES} lines were added.` : ''}`);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!ready.length) return;
    addLines(ready.map(({ row, res }) => ({ productId: res.product.id, variant: res.variant, qty: rowQty(row) })));
    setSummary({
      lines: ready.length,
      units: ready.reduce((sum, { row }) => sum + rowQty(row), 0),
      attention: attention.length,
    });
    for (const { row } of ready) forget(row.key);
    const kept = rows.filter((row) => !ready.some((r) => r.row.key === row.key));
    const next = kept.length ? kept : freshRows();
    setRows(next);
    setFocusRequest({ key: next[0].key });
  };

  const attentionText = attention.length === 0 ? ''
    : attention.length === 1 ? '1 line needs attention before it can be added.'
      : `${attention.length.toLocaleString('en-US')} lines need attention before they can be added.`;

  return (
    <form className="quick-reorder" onSubmit={submit} aria-labelledby="quick-reorder-title" noValidate>
      <p className="qr-help" id="quick-reorder-title">
        <span>{`Type a SKU from a past order or product page, set the quantity, and add it to your ${target}. Variant codes look like `}</span><code>AW-BACKWOODS-5PK-HONEY-BERRY</code>.
      </p>

      <div className="qr-rows">
        {resolved.map(({ row, res }, i) => {
          // An ok code with a quantity that can't be ordered (AW-100).
          const badQty = res.status === 'ok' && rowQty(row) === 0;
          const hintId = `${uid}-${row.key}-qty`;
          // What the row's SKU came to; it describes the SKU box (NEW-012).
          const statusId = `${uid}-${row.key}-status`;
          // An approved buyer's price for a matched row (AW-109).
          const unit = isApprovedBuyer && res.status === 'ok' && priceOf ? priceOf(res.product.id, res.variant) : null;
          const qty = rowQty(row);
          const price = unit != null
            ? `${formatMoney(unit)} each${qty > 0 ? ` · ${formatMoney(lineTotal(unit, qty))}` : ''}`
            : priceLabel(null, pricesStatus);
          return (
          <div className={`qr-row${res.status === 'empty' ? ' is-empty' : ''}`} key={row.key}>
            <label className="qr-field qr-sku">
              <span>SKU</span>
              <input
                ref={fieldRef(row.key, 'sku')}
                value={row.sku}
                onChange={(e) => typeSku(row.key, e.target.value)}
                onBlur={() => settleSku(row.key)}
                placeholder="AW-…"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={res.status === 'not-found' || undefined}
                aria-describedby={res.status === 'empty' ? undefined : statusId}
              />
            </label>
            <label className="qr-field qr-qty">
              <span>Qty</span>
              <input ref={fieldRef(row.key, 'qty')} type="text" inputMode="numeric" autoComplete="off" maxLength={6}
                     value={row.qty} onChange={(e) => update(row.key, { qty: e.target.value })}
                     aria-invalid={badQty || undefined} aria-describedby={badQty ? hintId : undefined} />
            </label>
            <div className="qr-status" id={statusId}>
              {res.status === 'ok' && (
                <p className="qr-match">
                  <b>{`${res.product.name}${res.variant ? ` — ${res.variant}` : ''}`}</b>
                  <small>{[variantSku(res.product.sku, res.variant), brandLabel(res.product.brand)].filter(Boolean).join(' · ')}</small>
                  {isApprovedBuyer && <span className="qr-price">{price}</span>}
                </p>
              )}
              {badQty && <p className="qr-problem" id={hintId}>{QTY_HINT}</p>}
              {res.status === 'not-found' && <p className="qr-problem">Not in the catalog. Check the code or search the catalog above.</p>}
              {/* The guard for a code more than one product answers to
                  (AW-074; see resolveSkuLine in src/lib/lines.js). */}
              {res.status === 'choose-product' && (
                <label className="qr-choice">
                  <span>Several products share this code — which one?</span>
                  <select ref={fieldRef(row.key, 'choice')} value="" onChange={(e) => choose(row, { productId: Number(e.target.value) })}>
                    <option value="" disabled>Choose a product…</option>
                    {res.candidates.map(({ product }) => (
                      <option key={product.id} value={product.id}>{`${product.name} · ${product.sub}`}</option>
                    ))}
                  </select>
                </label>
              )}
              {res.status === 'choose-variant' && (
                <label className="qr-choice">
                  <span>{`${res.product.name} — which variant?`}</span>
                  <select ref={fieldRef(row.key, 'choice')} value="" onChange={(e) => choose(row, { variant: e.target.value })}>
                    <option value="" disabled>Choose a variant…</option>
                    {res.variants.map((v, vi) => <option key={`${v}-${vi}`} value={v}>{v}</option>)}
                  </select>
                </label>
              )}
            </div>
            {(rows.length > 1 || row.sku !== '') && (
              <button className="button xs text" type="button" onClick={() => remove(row.key)} aria-label={`Remove line ${i + 1}`}>Remove</button>
            )}
          </div>
          );
        })}
      </div>

      <div className="qr-actions">
        <button className="button" type="submit" disabled={ready.length === 0}>
          <span>{ready.length > 0 ? `Add ${ready.length} line${ready.length === 1 ? '' : 's'} to ${target}` : `Add to ${target}`}</span>
        </button>
        <button className="text-link" type="button" onClick={addRow}>Add another line</button>
        <button className="text-link" type="button" aria-expanded={pasteOpen} aria-controls={pasteOpen ? pasteId : undefined}
                onClick={() => setPasteOpen((open) => !open)}>
          Paste a list
        </button>
        {/* Always on the page, so a change in the count is read out. */}
        <span className="qr-note" role="status">{attentionText}</span>
      </div>

      {pasteOpen && (
        <div className="form-grid qr-paste" id={pasteId}>
          <div className="full">
            <label htmlFor={`${pasteId}-text`}>SKUs and quantities</label>
            <textarea id={`${pasteId}-text`} rows={6} value={pasteText} onChange={(e) => { setPasteText(e.target.value); setPasteError(null); }}
                      placeholder={'AW-KITE, 4\nAW-SS-RED, 10'} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                      aria-invalid={pasteError ? true : undefined} aria-describedby={`${pasteId}-hint${pasteError ? ` ${pasteId}-error` : ''}`} />
            <small className="field-hint" id={`${pasteId}-hint`}>{`One line each: the SKU, then a comma, tab or space and the quantity (1 when there is none). Up to ${MAX_PASTE_LINES} lines.`}</small>
            {pasteError && <p className="form-error" id={`${pasteId}-error`}>{pasteError}</p>}
          </div>
          <div className="full">
            <button className="button ghost sm" type="button" onClick={addPasted}>Add rows</button>
          </div>
        </div>
      )}

      {summary && (
        <div className="qr-summary" role="status">
          <p>
            {`Added ${count(summary.lines, 'line')} (${count(summary.units, 'unit')}) to your ${target}.`
              + (summary.attention > 0 ? ` ${count(summary.attention, 'line is', 'lines are')} still waiting above.` : '')}
          </p>
          <button className="button xs" type="button" onClick={onOpenCart}>{`View ${target}`}</button>
        </div>
      )}
    </form>
  );
}
