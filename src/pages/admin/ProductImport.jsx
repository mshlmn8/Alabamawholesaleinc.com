// Admin -> Products' CSV import (AW-114): a file staff exported and edited
// in a spreadsheet comes back as a preview (each changed product's fields,
// old and new, and the new products it adds), with the SKUs that match no
// product and the rows that fail the editor's checks listed; nothing is
// saved until they confirm. A row whose SKU no product has adds a product
// when it has a name, brand, cat and sub (inactive unless the file has an
// active column); without them it is not imported. It is one call to
// admin_import_products_v2 (20261012140000), all or nothing. On a database
// without it the updates go through admin_import_products (20261010121000)
// and the new rows are listed as not imported; before that one too, Import
// says it needs the update and turns itself off. The plan is importPlan in
// productBulk.js.

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { adminErrorMessage, withStatus } from './adminData.js';
import { NEEDS_UPDATE_NOTE, plural } from './ProductBulk.jsx';
import { createRows, displayValue, importRows } from './productBulk.js';

const COLUMN_LABELS = {
  name: 'Name', brand: 'Brand', sell_unit: 'Sell unit', description: 'Description', price: 'Price', tag: 'Tag', active: 'Active',
  stock_status: 'Stock status', featured_rank: 'Homepage rank',
};

export const CREATE_MISSING_NOTE = 'Creating products from a file needs the October 2026 database update.';

const isMissingFunction = (error) => MISSING_FUNCTION_CODES.includes(String(error?.code));

// admin_import_products: { data: count, error }.
export async function importProducts(client, rows) {
  const result = await client.rpc('admin_import_products', { p_rows: rows });
  return { data: result?.data ?? null, error: withStatus(result || {}) };
}

// admin_import_products_v2: { data: { updated, created }, error }.
export async function importProductsV2(client, rows) {
  const result = await client.rpc('admin_import_products_v2', { p_rows: rows });
  return { data: result?.data ?? null, error: withStatus(result || {}) };
}

// A refused import, in staff wording. Nothing was saved in any case.
export function importError(error) {
  if (error?.hint === 'unknown_sku') {
    return `No product has the SKU ${error.details || ''} any more, so nothing was imported. Reload the list and choose the file again.`;
  }
  if (error?.hint === 'duplicate_sku') {
    return `The SKU ${error.details || ''} is in the file more than once, so nothing was imported. Keep one row for it and choose the file again.`;
  }
  if (error?.hint === 'invalid_input') return `The database refused the file${error.message ? ` (${error.message})` : ''}; nothing was imported.`;
  return adminErrorMessage(error, 'Nothing was imported');
}

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// A new product's values as the preview lists them: [label, value] pairs.
export function newProductFacts(create) {
  const { row } = create;
  const facts = [['Brand', row.brand], ['Category', `${create.cat} / ${create.sub}`], ['Price', displayValue('price', create.price)]];
  for (const column of ['sell_unit', 'description', 'tag', 'stock_status', 'featured_rank']) {
    if (column in row) facts.push([COLUMN_LABELS[column], displayValue(column, row[column])]);
  }
  facts.push(['Status', displayValue('active', create.active)]);
  return facts;
}

// What an import does, in words: 'update 2 products and add 1 new product'.
function importWhat(changes, creates) {
  return [
    changes || !creates ? `update ${plural(changes, 'product')}` : null,
    creates ? `add ${plural(creates, 'new product')}` : null,
  ].filter(Boolean).join(' and ');
}

// plan: importPlan's result (or { error }); fileName: the file chosen.
// missing: admin_import_products is missing; onMissing records it.
// createMissing: admin_import_products_v2 is missing, so new rows aren't
// imported; onCreateMissing records it. onApplied(patches, message,
// { created }); onCancel closes the preview. returnFocus: a ref to what
// takes focus after an import, as the preview closes with it (the list's
// count line, NEW-004).
export function ImportPreview({
  plan, fileName, missing = false, onMissing, createMissing = false, onCreateMissing, onApplied, onCancel, returnFocus = null,
}) {
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

  const changes = plan.changes || [];
  const creates = createMissing ? [] : (plan.creates || []);
  const notCreated = createMissing ? (plan.creates || []) : [];
  const activeColumn = !!plan.used?.includes('active');

  const apply = async () => {
    setBusy(true);
    setError(null);
    const updates = importRows(plan);
    const adding = createRows({ creates });
    let result = null;
    if (!createMissing) {
      result = await importProductsV2(supabase, [...updates, ...adding]);
      if (result.error && isMissingFunction(result.error)) {
        // A database without v2 (before 20261012140000): the updates can go
        // through v1, the new rows can't. Nothing is saved without asking
        // again, as the confirmation said they go together.
        onCreateMissing?.();
        result = null;
        if (adding.length) {
          setBusy(false);
          setConfirm(false);
          setError(`Nothing was imported. ${CREATE_MISSING_NOTE} ${updates.length
            ? `Import the ${plural(updates.length, 'change')} to products already in the catalog without them, or add them with New product.`
            : 'Add them with New product.'}`);
          return;
        }
      }
    }
    if (!result) {
      const old = await importProducts(supabase, updates);
      result = { data: old.error ? null : { updated: old.data ?? updates.length, created: 0 }, error: old.error };
    }
    setBusy(false);
    setConfirm(false);
    if (result.error) {
      if (isMissingFunction(result.error)) {
        onMissing?.();
        setError(`Import ${NEEDS_UPDATE_NOTE}. Export works now.`);
      } else setError(importError(result.error));
      return;
    }
    const updated = Number(result.data?.updated ?? updates.length);
    const created = Number(result.data?.created ?? adding.length);
    const now = new Date().toISOString();
    const patches = new Map(changes.map((change) => [change.id, { ...change.patch, updated_at: now }]));
    const done = [
      updated || !created ? `Updated ${plural(updated, 'product')}` : null,
      created ? `${updated ? 'added' : 'Added'} ${plural(created, 'new product')}${activeColumn ? '' : ' (inactive)'}` : null,
    ].filter(Boolean).join(' and ');
    doneFocus.current = returnFocus?.current ?? null;
    onApplied?.(patches, `${done} from ${fileName}`, { created });
  };

  const ready = !plan.error && plan.invalid.length === 0 && changes.length + creates.length > 0 && !missing;
  const summary = plan.error ? plan.error : [
    `${plural(changes.length, 'product')} to change`,
    creates.length ? plural(creates.length, 'new product') : null,
    `${plan.unchanged} unchanged`,
    plan.unknown.length ? `${plural(plan.unknown.length, 'unknown SKU')}` : null,
    notCreated.length ? `${plural(notCreated.length, 'new product')} not imported` : null,
    plan.invalid.length ? `${plural(plan.invalid.length, 'row')} to fix` : null,
  ].filter(Boolean).join(' · ');
  // cat and sub are read for new products only.
  const ignored = (plan.ignored || []).filter((c) => !(creates.length && ['cat', 'sub'].includes(c)));
  const what = importWhat(changes.length, creates.length);
  const buttonLabel = creates.length
    ? `Import ${[changes.length ? plural(changes.length, 'change') : null, plural(creates.length, 'new product')].filter(Boolean).join(' and ')}`
    : `Import ${plural(changes.length, 'change')}`;

  return (
    <section className="bulk-bar import-preview" aria-labelledby={`${id}-title`}>
      <h2 className="bulk-title" id={`${id}-title`} ref={headingRef} tabIndex={-1}>{`Import ${fileName}`}</h2>
      <p className={plan.error ? 'form-error' : 'result-note'} role={plan.error ? 'alert' : undefined}>{summary}</p>
      {!plan.error && (
        <ul className="bulk-notes">
          <li>Columns the file doesn’t have are left as they are. An empty price cell means price on request.</li>
          {plan.used.length > 0 && <li>{`Read from the file: ${plan.used.join(', ')}.`}</li>}
          {ignored.length > 0 && (
            <li>{`Not imported: ${ignored.join(', ')}${ignored.some((c) => c === 'cat' || c === 'sub') ? ' (change a product’s department or sub-line in its editor)' : ''}.`}</li>
          )}
          {creates.length > 0 && <li>New products take their department and sub-line from cat and sub; a product already in the catalog keeps its own.</li>}
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

      {!plan.error && creates.length > 0 && (
        <div className="bulk-section">
          <h3>{`New products (${creates.length})`}</h3>
          <p className="result-note">{activeColumn
            ? 'They have no photo or variants yet: add those in each product’s editor.'
            : 'Added inactive, so buyers don’t see them until you activate them (the file has no active column). They have no photo or variants yet: add those in each product’s editor.'}</p>
          <div className="table-scroll">
            <table className="aw-table">
              <thead><tr><th>SKU</th><th>Product</th><th>What it gets</th></tr></thead>
              <tbody>
                {creates.map((create) => (
                  <tr key={create.sku}>
                    <td className="muted">{create.sku}</td>
                    <td>{create.name}</td>
                    <td>
                      <ul className="bulk-list">
                        {newProductFacts(create).map(([label, value]) => (
                          <li key={label}><span>{`${label} `}</span><strong>{value}</strong></li>
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

      {!plan.error && (plan.unknown.length > 0 || notCreated.length > 0) && (
        <div className="bulk-section">
          <h3>Not imported</h3>
          {plan.unknown.length > 0 && (
            <>
              <p className="result-note">These SKUs match no product, and their rows don’t have the name, brand, cat and sub a new product needs. Fill those in to add them, or use New product.</p>
              <ul className="bulk-list">
                {plan.unknown.map((row) => <li key={`${row.line}-${row.sku}`}>{`${row.sku} (line ${row.line})`}</li>)}
              </ul>
            </>
          )}
          {notCreated.length > 0 && (
            <>
              <p className="result-note">{`New products: ${CREATE_MISSING_NOTE} Until then, add them with New product.`}</p>
              <ul className="bulk-list">
                {notCreated.map((row) => <li key={`${row.line}-${row.sku}`}>{`${row.sku}, ${row.name} (line ${row.line})`}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {!plan.error && changes.length > 0 && (
        <div className="bulk-section">
          <h3>Changes</h3>
          <div className="table-scroll">
            <table className="aw-table">
              <thead><tr><th>SKU</th><th>Product</th><th>What changes</th></tr></thead>
              <tbody>
                {changes.map((change) => (
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
          <button className="button" type="button" disabled={!ready || busy} onClick={() => setConfirm(true)}>{buttonLabel}</button>
        )}
        <button className="button ghost" type="button" onClick={onCancel}>{plan.error ? 'Close' : 'Cancel'}</button>
      </div>

      {confirm && (
        <ConfirmDialog
          title={`${capital(what)}?`}
          body={[
            'The changes listed are saved together: if the database refuses one, none is saved.',
            creates.length ? (activeColumn ? 'New products have no photo or variants yet.' : 'New products are added inactive, with no photo or variants yet.') : null,
            'Approved buyers see new prices on their next page load; orders already saved keep their prices.',
          ].filter(Boolean).join(' ')}
          confirmLabel={busy ? 'Saving…' : capital(what)} busy={busy} returnFocus={doneFocus}
          onConfirm={apply} onCancel={() => { if (!busy) setConfirm(false); }}
        />
      )}
    </section>
  );
}
