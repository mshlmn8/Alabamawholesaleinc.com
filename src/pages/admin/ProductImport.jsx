// Admin -> Products' CSV import (AW-114): a file staff exported and edited
// in a spreadsheet comes back as a preview (each changed product's fields,
// old and new), with the SKUs that match no product and the rows that fail
// the editor's checks listed; nothing is saved until they confirm. The
// import updates products matched by SKU and never creates one (a
// deliberate limit: New product does that). It is one call to
// admin_import_products (20261010121000), all or nothing; before that
// migration it says it needs the update and turns itself off. The plan is
// importPlan in productBulk.js.

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { adminErrorMessage, withStatus } from './adminData.js';
import { NEEDS_UPDATE_NOTE, plural } from './ProductBulk.jsx';
import { NOT_IMPORTED, displayValue, importRows } from './productBulk.js';

const COLUMN_LABELS = {
  name: 'Name', brand: 'Brand', sell_unit: 'Sell unit', description: 'Description', price: 'Price', tag: 'Tag', active: 'Active',
  stock_status: 'Stock status', featured_rank: 'Homepage rank',
};

// admin_import_products: { data: count, error }.
export async function importProducts(client, rows) {
  const result = await client.rpc('admin_import_products', { p_rows: rows });
  return { data: result?.data ?? null, error: withStatus(result || {}) };
}

// A refused import, in staff wording. Nothing was saved in any case.
export function importError(error) {
  if (error?.hint === 'unknown_sku') {
    return `No product has the SKU ${error.details || ''} any more, so nothing was imported. Reload the list and choose the file again.`;
  }
  if (error?.hint === 'invalid_input') return `The database refused the file${error.message ? ` (${error.message})` : ''}; nothing was imported.`;
  return adminErrorMessage(error, 'Nothing was imported');
}

// plan: importPlan's result (or { error }); fileName: the file chosen.
// missing: admin_import_products is missing; onMissing records it.
// onApplied(patches, message); onCancel closes the preview. returnFocus: a
// ref to what takes focus after an import, as the preview closes with it
// (the list's count line, NEW-004).
export function ImportPreview({ plan, fileName, missing = false, onMissing, onApplied, onCancel, returnFocus = null }) {
  const id = useId();
  const headingRef = useRef(null);
  // Filled in only when the import went through: a cancelled or refused
  // confirmation gives focus back to the Import button.
  const doneFocus = useRef(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // A new file's preview takes focus, so its summary is read out.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: 'start' });
  }, [plan]);

  const apply = async () => {
    setBusy(true);
    setError(null);
    const { data, error: failed } = await importProducts(supabase, importRows(plan));
    setBusy(false);
    setConfirm(false);
    if (failed) {
      if (MISSING_FUNCTION_CODES.includes(String(failed.code))) {
        onMissing?.();
        setError(`Import ${NEEDS_UPDATE_NOTE}. Export works now.`);
      } else setError(importError(failed));
      return;
    }
    const now = new Date().toISOString();
    const patches = new Map(plan.changes.map((change) => [change.id, { ...change.patch, updated_at: now }]));
    doneFocus.current = returnFocus?.current ?? null;
    onApplied?.(patches, `Updated ${plural(Number(data ?? plan.changes.length), 'product')} from ${fileName}`);
  };

  const ready = !plan.error && plan.ok && !missing;
  const summary = plan.error ? plan.error : [
    `${plural(plan.changes.length, 'product')} to change`,
    `${plan.unchanged} unchanged`,
    plan.unknown.length ? `${plural(plan.unknown.length, 'unknown SKU')}` : null,
    plan.invalid.length ? `${plural(plan.invalid.length, 'row')} to fix` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="bulk-bar import-preview" aria-labelledby={`${id}-title`}>
      <h2 className="bulk-title" id={`${id}-title`} ref={headingRef} tabIndex={-1}>{`Import ${fileName}`}</h2>
      <p className={plan.error ? 'form-error' : 'result-note'} role={plan.error ? 'alert' : undefined}>{summary}</p>
      {!plan.error && (
        <ul className="bulk-notes">
          <li>Columns the file doesn’t have are left as they are. An empty price cell means price on request.</li>
          {plan.used.length > 0 && <li>{`Read from the file: ${plan.used.join(', ')}.`}</li>}
          {plan.ignored.length > 0 && (
            <li>{`Not imported: ${plan.ignored.join(', ')}${plan.ignored.some((c) => NOT_IMPORTED.includes(c)) ? ' (change a product’s department or sub-line in its editor)' : ''}.`}</li>
          )}
          {plan.unavailable.length > 0 && <li>{`${plan.unavailable.join(' and ')}: ${NEEDS_UPDATE_NOTE}; left as they are.`}</li>}
        </ul>
      )}
      {missing && <p className="field-hint">{`Import ${NEEDS_UPDATE_NOTE}.`}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!plan.error && plan.invalid.length > 0 && (
        <div className="bulk-section">
          <h3>Rows to fix</h3>
          <p className="form-error">Nothing can be imported until these rows are right. Fix them in the file and choose it again.</p>
          <div className="table-scroll">
            <table className="aw-table">
              <thead><tr><th>Line</th><th>SKU</th><th>Problem</th></tr></thead>
              <tbody>
                {plan.invalid.map((row) => (
                  <tr key={`${row.line}-${row.sku}`}>
                    <td>{row.line}</td>
                    <td>{row.sku || '—'}</td>
                    <td><ul className="bulk-list">{row.messages.map((m) => <li key={m}>{m}</li>)}</ul></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!plan.error && plan.unknown.length > 0 && (
        <div className="bulk-section">
          <h3>Not imported</h3>
          <p className="result-note">These SKUs match no product. The import doesn’t create products; use New product for those.</p>
          <ul className="bulk-list">
            {plan.unknown.map((row) => <li key={`${row.line}-${row.sku}`}>{`${row.sku} (line ${row.line})`}</li>)}
          </ul>
        </div>
      )}

      {!plan.error && plan.changes.length > 0 && (
        <div className="bulk-section">
          <h3>Changes</h3>
          <div className="table-scroll">
            <table className="aw-table">
              <thead><tr><th>SKU</th><th>Product</th><th>What changes</th></tr></thead>
              <tbody>
                {plan.changes.map((change) => (
                  <tr key={change.id}>
                    <td className="muted">{change.sku}</td>
                    <td>{change.name}</td>
                    <td>
                      <ul className="bulk-list">
                        {change.fields.map((field) => (
                          <li key={field.column}>
                            <span>{COLUMN_LABELS[field.column] || field.column}</span>
                            <span>{` from ${displayValue(field.column, field.old)} to `}</span>
                            <strong>{displayValue(field.column, field.next)}</strong>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="inline-actions bulk-actions">
        {!plan.error && (
          <button className="button" type="button" disabled={!ready || busy} onClick={() => setConfirm(true)}>
            {`Import ${plural(plan.changes.length, 'change')}`}
          </button>
        )}
        <button className="button ghost" type="button" onClick={onCancel}>{plan.error ? 'Close' : 'Cancel'}</button>
      </div>

      {confirm && (
        <ConfirmDialog
          title={`Update ${plural(plan.changes.length, 'product')}?`}
          body={`The changes listed are saved together: if the database refuses one, none is saved. Approved buyers see new prices on their next page load; orders already saved keep their prices.`}
          confirmLabel={busy ? 'Saving…' : `Update ${plural(plan.changes.length, 'product')}`} busy={busy} returnFocus={doneFocus}
          onConfirm={apply} onCancel={() => { if (!busy) setConfirm(false); }}
        />
      )}
    </section>
  );
}
