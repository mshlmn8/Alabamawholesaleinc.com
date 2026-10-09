// Quick entry by SKU and quantity for signed-in buyers. Each row resolves
// live against the catalog; a code that is ambiguous (duplicate catalog SKUs,
// or a bare SKU of a multi-variant product) asks for one more choice before
// its line can be added.
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

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveSkuLine, variantSku } from '../../lib/lines.js';
import { brandLabel, formatMoney } from '../../lib/format.js';
import { lineTotal, priceLabel } from '../../lib/pricing.js';
import { announce } from '../../lib/announce.js';
import { MAX_QTY, QTY_RANGE_TEXT, readQty } from '../../lib/quantity.js';

const START_ROWS = 1;
let rowSeq = 0;
const blankRow = (fill = {}) => ({ key: `qr-${++rowSeq}`, sku: '', qty: 1, productId: null, variant: null, ...fill });
const freshRows = () => Array.from({ length: START_ROWS }, () => blankRow());
// The row's quantity, or 0 when it isn't one that can be ordered.
const rowQty = (row) => readQty(row.qty).qty ?? 0;
const QTY_HINT = `Enter ${QTY_RANGE_TEXT}.`;

// 'Paste a list': one 'SKU, qty', 'SKU<tab>qty' or 'SKU qty' per line; a
// line without a quantity is for 1. The quantity is kept as typed, so the
// row says when it can't be ordered (readQty). At most MAX_PASTE_LINES lines.
export const MAX_PASTE_LINES = 100;
export function parsePastedList(text) {
  const lines = String(text ?? '').split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.slice(0, MAX_PASTE_LINES).map((line) => {
    const [sku, qty] = line.split(/[,\t ]+/);
    return { sku, qty: qty || '1' };
  });
  return { rows, skipped: Math.max(0, lines.length - MAX_PASTE_LINES) };
}
const PASTE_EMPTY = 'Paste at least one line: a SKU, then its quantity.';

export function QuickReorder({ products, addLines, onOpenCart, isApprovedBuyer, priceOf, pricesStatus }) {
  const [rows, setRows] = useState(freshRows);
  const [summary, setSummary] = useState(null);
  // The row whose SKU box takes focus once it is on the page: { key }.
  const [focusRequest, setFocusRequest] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(null);
  const skuInputs = useRef(new Map());
  const uid = useId();
  const pasteId = `${uid}-paste`;

  useEffect(() => {
    if (focusRequest) skuInputs.current.get(focusRequest.key)?.focus();
  }, [focusRequest]);

  const resolved = useMemo(
    () => rows.map((row) => ({ row, res: resolveSkuLine(products, row.sku, { productId: row.productId, variant: row.variant }) })),
    [rows, products]
  );
  const ready = resolved.filter(({ row, res }) => res.status === 'ok' && rowQty(row) > 0);
  const attention = resolved.filter(({ row, res }) => res.status !== 'empty' && !(res.status === 'ok' && rowQty(row) > 0));
  const target = isApprovedBuyer ? 'order' : 'quote';

  const update = (key, patch) => setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Focus goes to the row that takes the removed one's place, else the one
  // before it; the last row is emptied instead of removed.
  const remove = (key) => {
    const i = rows.findIndex((r) => r.key === key);
    if (i === -1) return;
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
    const kept = rows.filter((row) => !ready.some((r) => r.row.key === row.key));
    const next = kept.length ? kept : freshRows();
    setRows(next);
    setFocusRequest({ key: next[0].key });
  };

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
          // An approved buyer's price for a matched row (AW-109).
          const unit = isApprovedBuyer && res.status === 'ok' && priceOf ? priceOf(res.product.id, res.variant) : null;
          const qty = rowQty(row);
          const price = unit != null
            ? `${formatMoney(unit)} each${qty > 0 ? ` · ${formatMoney(lineTotal(unit, qty))}` : ''}`
            : priceLabel(null, pricesStatus);
          return (
          <div className={`qr-row${res.status === 'empty' ? ' is-empty' : ''}`} key={row.key}>
            <label className="qr-field">
              <span>SKU</span>
              <input
                ref={(el) => {
                  if (el) skuInputs.current.set(row.key, el);
                  else skuInputs.current.delete(row.key);
                }}
                value={row.sku}
                onChange={(e) => update(row.key, { sku: e.target.value, productId: null, variant: null })}
                placeholder="AW-…"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="qr-field qr-qty">
              <span>Qty</span>
              <input type="number" min="1" max={MAX_QTY} step="1" inputMode="numeric" value={row.qty} onChange={(e) => update(row.key, { qty: e.target.value })}
                     aria-invalid={badQty || undefined} aria-describedby={badQty ? hintId : undefined} />
            </label>
            <div className="qr-status">
              {res.status === 'ok' && (
                <p className="qr-match">
                  <b>{`${res.product.name}${res.variant ? ` — ${res.variant}` : ''}`}</b>
                  <small>{[variantSku(res.product.sku, res.variant), brandLabel(res.product.brand)].filter(Boolean).join(' · ')}</small>
                  {isApprovedBuyer && <span className="qr-price">{price}</span>}
                </p>
              )}
              {badQty && <p className="qr-problem" id={hintId}>{QTY_HINT}</p>}
              {res.status === 'not-found' && <p className="qr-problem">Not in the catalog. Check the code or search the catalog above.</p>}
              {res.status === 'choose-product' && (
                <label className="qr-choice">
                  <span>Several products share this code — which one?</span>
                  <select value="" onChange={(e) => update(row.key, { productId: Number(e.target.value) })}>
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
                  <select value="" onChange={(e) => update(row.key, { variant: e.target.value })}>
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
        {attention.length > 0 && (
          <span className="qr-note">
            {attention.length === 1 ? '1 line needs attention before it can be added.' : `${attention.length} lines need attention before they can be added.`}
          </span>
        )}
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
            {`Added ${summary.lines} line${summary.lines === 1 ? '' : 's'} (${summary.units} unit${summary.units === 1 ? '' : 's'}) to your ${target}.`
              + (summary.attention > 0 ? ` ${summary.attention} line${summary.attention === 1 ? ' is' : 's are'} still waiting above.` : '')}
          </p>
          <button className="button xs" type="button" onClick={onOpenCart}>Review cart</button>
        </div>
      )}
    </form>
  );
}
