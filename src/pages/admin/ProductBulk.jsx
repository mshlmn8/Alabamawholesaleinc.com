// Admin -> Products' bulk bar (AW-114): with products selected, staff set
// their price, adjust it by a percentage or an amount (with a preview, old
// and new), set their tag, or activate or deactivate them, each after a
// confirmation that says how many. The math is in productBulk.js.
//
// Set price, Set tag, Activate and Deactivate are one update of the chosen
// rows, read back (`.in('id', ids).select('id,updated_at')`), which the live
// database already allows; the count read back is compared with the count
// sent. Adjust is one call to admin_bulk_adjust_prices
// (20261010121000), so every price moves or none does; before that
// migration it says it needs the update and turns itself off. After a change
// the rows are patched where they are (no reload of the catalog), the
// storefront is told (onCatalogChange) and the status line says what
// happened. The bar goes with the selection, so a confirmed change hands
// focus to `returnFocus` (the list's count line) rather than to the
// button that opened the confirmation (NEW-004).

import { useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatMoney } from '../../lib/format.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { NO_ROWS, adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { parsePrice } from './productForm.js';
import { BULK_TAGS, MAX_BULK, PREVIEW_ROWS, adjustPreview, adjustRow, parseAdjust } from './productBulk.js';

export const NEEDS_UPDATE_NOTE = 'needs the October 2026 database update (see BACKEND.md)';
const PRICES_NOTE = 'Approved buyers see the new prices on their next page load; orders already saved keep their prices.';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const percent = (n) => `${Math.abs(n)}%`;
// The first few names of a list, then how many more.
const NAMES_SHOWN = 8;
const names = (list, name = (r) => r.name) => {
  const shown = list.slice(0, NAMES_SHOWN).map(name).join(', ');
  return list.length > NAMES_SHOWN ? `${shown} and ${list.length - NAMES_SHOWN} more` : shown;
};

// One update of every chosen product, read back. Returns checkedWrite's
// { data: [{ id, updated_at }], error }.
export function bulkUpdate(client, ids, patch) {
  return checkedWrite(client.from('products').update(patch).in('id', ids), 'id,updated_at');
}

// admin_bulk_adjust_prices: { data: { updated, skipped, variants }, error }.
export async function bulkAdjust(client, ids, change, variants) {
  const result = await client.rpc('admin_bulk_adjust_prices', { p_ids: ids, p_pct: change.pct, p_amount: change.amount, p_variants: variants });
  return { data: result?.data ?? null, error: withStatus(result || {}) };
}

// A refused bulk change, in staff wording.
export function bulkError(error, action) {
  if (error?.code === NO_ROWS) return `${action}: no product was changed. Your account may not be allowed to, or they were removed; reload the list and try again.`;
  if (error?.hint === 'price_out_of_range') return `${action}: a new price would be below $0.00 or above $99,999.99, so nothing was changed.`;
  if (error?.hint === 'invalid_input') return `${action}: the database refused the change${error.message ? ` (${error.message})` : ''}.`;
  if (error?.code === '23502') return `${action}: price on request ${NEEDS_UPDATE_NOTE}.`;
  return adminErrorMessage(error, action);
}

const ACTIONS = [
  { id: 'price', label: 'Set price' },
  { id: 'adjust', label: 'Adjust price' },
  { id: 'tag', label: 'Set tag' },
  { id: 'activate', label: 'Activate' },
  { id: 'deactivate', label: 'Deactivate' },
];

// rows: the selected products. adjustMissing: admin_bulk_adjust_prices is
// missing (PGRST202/42883 seen), onAdjustMissing records it. onApplied(patches,
// message): patches is a Map of id -> the changed columns. onClear empties
// the selection. returnFocus: a ref to what takes focus after a change.
export function BulkBar({ rows, adjustMissing = false, onAdjustMissing, onApplied, onClear, returnFocus = null }) {
  const id = useId();
  // Filled in only when a change went through, so a cancelled or refused
  // confirmation still gives focus back to the button that opened it.
  const doneFocus = useRef(null);
  const [open, setOpen] = useState(null);
  const [priceText, setPriceText] = useState('');
  const [mode, setMode] = useState('pct');
  const [amountText, setAmountText] = useState('');
  const [variants, setVariants] = useState(true);
  const [tag, setTag] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const count = rows.length;
  const products = plural(count, 'product');
  const adjust = parseAdjust(mode, amountText);
  const preview = adjust.ok ? adjustPreview(rows, adjust, { variants }) : null;

  const toggle = (action) => {
    setError(null);
    setFieldError('');
    setOpen(open === action ? null : action);
  };

  // The confirmation for an action, or a field error instead.
  const review = (action) => {
    setError(null);
    doneFocus.current = null;
    if (count > MAX_BULK) {
      setError(`Choose at most ${MAX_BULK} products for one change.`);
      return;
    }
    if (action === 'price') {
      const { ok, price } = parsePrice(priceText);
      if (!ok) {
        setFieldError('Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.');
        return;
      }
      // A blank box is price on request: the list price is removed (NEW-072).
      setConfirm(price == null ? {
        action, patch: { price },
        title: `Make ${products} price on request?`,
        body: `Each selected product becomes price on request (its list price is removed). ${PRICES_NOTE}`,
        label: `Make ${products} price on request`,
        done: (n) => `Made ${n} price on request`,
      } : {
        action, patch: { price },
        title: `Set the price of ${products}?`,
        body: `Each selected product gets the list price ${formatMoney(price)}. ${PRICES_NOTE}`,
        label: `Set ${plural(count, 'price')}`,
        done: (n) => `Set the price of ${n} to ${formatMoney(price)}`,
      });
    } else if (action === 'adjust') {
      if (!adjust.ok) { setFieldError(adjust.error); return; }
      if (preview.refused.length) { setFieldError('Some new prices would be out of range (listed below); change the amount.'); return; }
      if (!preview.changes.length && !preview.variants) { setFieldError('None of the selected products has a list price to change.'); return; }
      const by = adjust.pct ? percent(adjust.pct) : formatMoney(Math.abs(adjust.amount));
      const verb = (adjust.pct || adjust.amount) > 0 ? 'Raise' : 'Lower';
      const extra = preview.variants ? ` and ${plural(preview.variants, 'variant price')}` : '';
      const skipped = preview.skipped.length ? ` ${plural(preview.skipped.length, 'product')} on request ${preview.skipped.length === 1 ? 'is' : 'are'} skipped.` : '';
      setConfirm({
        action, change: { pct: adjust.pct, amount: adjust.amount }, variants,
        title: `Adjust ${plural(preview.changes.length, 'price')}?`,
        body: `${verb} the list price of ${plural(preview.changes.length, 'product')}${extra} by ${by}.${skipped} ${PRICES_NOTE}`,
        label: 'Adjust prices',
      });
    } else if (action === 'tag') {
      setConfirm({
        action, patch: { tag: tag || null },
        title: `Set the tag of ${products}?`,
        body: tag ? `Each selected product is tagged ${tag}.` : 'Each selected product loses its tag.',
        label: tag ? `Tag ${products}` : `Clear ${plural(count, 'tag')}`,
        done: (n) => (tag ? `Set the tag of ${n} to ${tag}` : `Cleared the tag of ${n}`),
      });
    } else {
      const on = action === 'activate';
      setConfirm({
        action, patch: { active: on },
        title: `${on ? 'Activate' : 'Deactivate'} ${products}?`,
        body: on
          ? 'They show on the storefront again and can be ordered.'
          : 'They leave the storefront and can’t be ordered until they are activated again. Their order history is kept.',
        label: `${on ? 'Activate' : 'Deactivate'} ${products}`,
        done: (n) => `${on ? 'Activated' : 'Deactivated'} ${n}`,
      });
    }
  };

  const reset = () => {
    setOpen(null);
    setPriceText('');
    setAmountText('');
    setFieldError('');
    setError(null);
  };

  const apply = async () => {
    const plan = confirm;
    setBusy(true);
    const ids = rows.map((r) => r.id);
    const now = new Date().toISOString();
    if (plan.action === 'adjust') {
      const { data, error: failed } = await bulkAdjust(supabase, ids, plan.change, plan.variants);
      setBusy(false);
      setConfirm(null);
      if (failed) {
        if (MISSING_FUNCTION_CODES.includes(String(failed.code))) {
          onAdjustMissing?.();
          setOpen(null);
          setError(`Adjust price ${NEEDS_UPDATE_NOTE}. Set price works now.`);
        } else setError(bulkError(failed, 'The prices weren’t changed'));
        return;
      }
      const patches = new Map(rows.map((row) => [row.id, { ...adjustRow(row, plan.change, { variants: plan.variants }), updated_at: row.price == null ? row.updated_at : now }]));
      const updated = Number(data?.updated ?? preview?.changes.length ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      reset();
      doneFocus.current = returnFocus?.current ?? null;
      onApplied?.(patches, `Adjusted the list price of ${plural(updated, 'product')}${skipped ? `; ${skipped} on request skipped` : ''}.`);
      return;
    }
    const { data, error: failed } = await bulkUpdate(supabase, ids, plan.patch);
    setBusy(false);
    setConfirm(null);
    if (failed) {
      setError(bulkError(failed, 'The products weren’t changed'));
      return;
    }
    const changed = new Map(data.map((row) => [row.id, { ...plan.patch, updated_at: row.updated_at || now }]));
    reset();
    doneFocus.current = returnFocus?.current ?? null;
    // The status line names the change (NEW-037): 'Deactivated 58 products.'
    onApplied?.(changed, changed.size < ids.length
      ? `${plan.done(`${changed.size} of ${products}`)}; the others weren’t changed (reload the list to see them).`
      : `${plan.done(products)}.`);
  };

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = (hint) => [hint ? hintId : null, errorId].filter(Boolean).join(' ');
  const shown = preview ? preview.changes.slice(0, PREVIEW_ROWS) : [];

  return (
    <section className="bulk-bar" aria-label="Change the selected products">
      <div className="bulk-head">
        <p className="bulk-count">{`${products} selected`}</p>
        <div className="inline-actions">
          {ACTIONS.map((action) => {
            const panel = ['price', 'adjust', 'tag'].includes(action.id);
            const off = action.id === 'adjust' && adjustMissing;
            return (
              <button
                key={action.id} type="button" className={open === action.id ? 'button xs' : 'button xs ghost'} disabled={off || busy}
                aria-expanded={panel ? open === action.id : undefined} aria-controls={panel && open === action.id ? `${id}-panel` : undefined}
                aria-describedby={off ? `${id}-missing` : undefined}
                onClick={() => (panel ? toggle(action.id) : review(action.id))}
              >
                {action.label}
              </button>
            );
          })}
          <button className="button xs text" type="button" onClick={onClear}>Clear selection</button>
        </div>
      </div>
      {adjustMissing && <p className="field-hint" id={`${id}-missing`}>{`Adjust price ${NEEDS_UPDATE_NOTE}.`}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {open === 'price' && (
        <form className="bulk-panel" id={`${id}-panel`} noValidate onSubmit={(e) => { e.preventDefault(); review('price'); }}>
          <div className="admin-toolbar">
            <label>New list price
              <input
                type="text" inputMode="decimal" autoComplete="off" value={priceText} aria-invalid={fieldError ? true : undefined}
                aria-describedby={describedBy(true)} onChange={(e) => { setPriceText(e.target.value); setFieldError(''); }}
              />
            </label>
            <button className="button sm" type="submit">Set price</button>
          </div>
          <small className="field-hint" id={hintId}>Leave it blank for price on request.</small>
          <p className="form-error" id={errorId}>{fieldError}</p>
        </form>
      )}

      {open === 'adjust' && (
        <form className="bulk-panel" id={`${id}-panel`} noValidate onSubmit={(e) => { e.preventDefault(); review('adjust'); }}>
          <div className="admin-toolbar">
            <label>Adjust by
              <select value={mode} onChange={(e) => { setMode(e.target.value); setFieldError(''); }}>
                <option value="pct">Percent (%)</option>
                <option value="amount">Dollars ($)</option>
              </select>
            </label>
            <label>
              <span>{mode === 'pct' ? 'Change in %' : 'Change in $'}</span>
              <input
                type="text" inputMode="decimal" autoComplete="off" value={amountText} aria-invalid={fieldError ? true : undefined}
                aria-describedby={describedBy(true)} onChange={(e) => { setAmountText(e.target.value); setFieldError(''); }}
              />
            </label>
            <label className="admin-toggle">
              <input type="checkbox" checked={variants} onChange={(e) => setVariants(e.target.checked)} />
              Variant prices too
            </label>
            <button className="button sm" type="submit">Adjust prices</button>
          </div>
          <small className="field-hint" id={hintId}>
            {mode === 'pct' ? 'For example 5 to raise prices 5%, or -2.5 to lower them. Rounded to the cent.' : 'For example 0.25 to add 25¢, or -1 to take off a dollar.'}
          </small>
          <p className="form-error" id={errorId}>{fieldError}</p>
          {preview && (
            <div className="bulk-preview">
              {shown.length > 0 && (
                <div className="table-scroll">
                  <table className="aw-table">
                    <caption className="sr-only">New list prices</caption>
                    <thead><tr><th>Product</th><th>SKU</th><th>Now</th><th>New</th></tr></thead>
                    <tbody>
                      {shown.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className="muted">{row.sku}</td>
                          <td>{formatMoney(row.old)}</td>
                          <td className="price">{formatMoney(row.next)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.changes.length > shown.length && (
                <p className="result-note">{`And ${plural(preview.changes.length - shown.length, 'more product')}.`}</p>
              )}
              {preview.variants > 0 && <p className="result-note">{`Also ${plural(preview.variants, 'variant price')}, by the same change.`}</p>}
              {preview.skipped.length > 0 && (
                <p className="result-note">{`Skipped, price on request: ${names(preview.skipped)}.`}</p>
              )}
              {preview.refused.length > 0 && (
                <p className="form-error">{`Out of range (below $0.00 or above $99,999.99): ${names(preview.refused, (r) => `${r.name} ${formatMoney(r.next)}`)}.`}</p>
              )}
            </div>
          )}
        </form>
      )}

      {open === 'tag' && (
        <form className="bulk-panel" id={`${id}-panel`} noValidate onSubmit={(e) => { e.preventDefault(); review('tag'); }}>
          <div className="admin-toolbar">
            <label>New tag
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">No tag</option>
                {BULK_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <button className="button sm" type="submit">Set tag</button>
          </div>
        </form>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title} body={confirm.body} confirmLabel={busy ? 'Saving…' : confirm.label} busy={busy} returnFocus={doneFocus}
          onConfirm={apply} onCancel={() => { if (!busy) setConfirm(null); }}
        />
      )}
    </section>
  );
}
