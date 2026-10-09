// Quick entry by SKU and quantity for signed-in buyers. Each row resolves
// live against the catalog; a code that is ambiguous (one more than one
// product answers to, or a bare SKU of a multi-variant product) asks for one
// more choice before its line can be added.
//
// Quantities follow the one rule in src/lib/quantity.js (AW-100, AW-013): a
// whole number from 1 to 100,000. Anything else (0, 2.5, 150000) is a row
// that needs attention, said in the row, and never rounded. The form doesn't
// use the browser's own validation, so such a row never blocks the rows that
// are ready.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveSkuLine, variantSku } from '../../lib/lines.js';
import { brandLabel } from '../../lib/format.js';
import { MAX_QTY, QTY_RANGE_TEXT, readQty } from '../../lib/quantity.js';

const START_ROWS = 3;
let rowSeq = 0;
const blankRow = () => ({ key: `qr-${++rowSeq}`, sku: '', qty: 1, productId: null, variant: null });
const freshRows = () => Array.from({ length: START_ROWS }, blankRow);
// The row's quantity, or 0 when it isn't one that can be ordered.
const rowQty = (row) => readQty(row.qty).qty ?? 0;
const QTY_HINT = `Enter ${QTY_RANGE_TEXT}.`;

export function QuickReorder({ products, addLines, onOpenCart, isApprovedBuyer }) {
  const [rows, setRows] = useState(freshRows);
  const [summary, setSummary] = useState(null);
  const [refocus, setRefocus] = useState(0);
  const firstInput = useRef(null);
  const uid = useId();

  // Runs after the submitted rows are gone, so the ref is the surviving first input.
  useEffect(() => { if (refocus) firstInput.current?.focus(); }, [refocus]);

  const resolved = useMemo(
    () => rows.map((row) => ({ row, res: resolveSkuLine(products, row.sku, { productId: row.productId, variant: row.variant }) })),
    [rows, products]
  );
  const ready = resolved.filter(({ row, res }) => res.status === 'ok' && rowQty(row) > 0);
  const attention = resolved.filter(({ row, res }) => res.status !== 'empty' && !(res.status === 'ok' && rowQty(row) > 0));
  const target = isApprovedBuyer ? 'order' : 'quote';

  const update = (key, patch) => setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key) => setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== key) : [blankRow()]));
  const addRow = () => setRows((current) => [...current, blankRow()]);

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
    setRows(kept.length ? kept : freshRows());
    setRefocus((n) => n + 1);
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
          return (
          <div className="qr-row" key={row.key}>
            <label className="qr-field">
              <span>SKU</span>
              <input
                ref={i === 0 ? firstInput : null}
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
            <button className="button xs text" type="button" onClick={() => remove(row.key)} aria-label={`Remove line ${i + 1}`}>Remove</button>
          </div>
          );
        })}
      </div>

      <div className="qr-actions">
        <button className="button" type="submit" disabled={ready.length === 0}>
          <span>{ready.length > 0 ? `Add ${ready.length} line${ready.length === 1 ? '' : 's'} to ${target}` : `Add to ${target}`}</span>
        </button>
        <button className="text-link" type="button" onClick={addRow}>Add another line</button>
        {attention.length > 0 && (
          <span className="qr-note">
            {attention.length === 1 ? '1 line needs attention before it can be added.' : `${attention.length} lines need attention before they can be added.`}
          </span>
        )}
      </div>

      {summary && (
        <div className="qr-summary" role="status">
          <p>
            {`Added ${summary.lines} line${summary.lines === 1 ? '' : 's'} (${summary.units} unit${summary.units === 1 ? '' : 's'}) to your ${target}.`
              + (summary.attention > 0 ? ` ${summary.attention} line${summary.attention === 1 ? ' is' : 's are'} still waiting above.` : '')}
          </p>
          <button className="button xs" type="button" onClick={onOpenCart}>{`View ${target}`}</button>
        </div>
      )}
    </form>
  );
}
