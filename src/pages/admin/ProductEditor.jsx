// Admin -> Products -> one product (AW-023, AW-116, AW-117): a full-page
// editor under the admin nav, at /admin/products/:id and /admin/products/new
// (?from=<id> starts from a copy). Every column of a product, its variants
// with their own prices and "can't be ordered", its photo (uploaded to the
// product-images bucket, or a bundled file name or URL), stock status,
// homepage rank, "Show no description" (description_hidden, 20261012120000:
// the product page then has none, not the bundled one a blank description
// gets), and delete.
//
// It is a real <form> inside .form-grid, so the shared field system styles
// it and Enter saves. Escape, Cancel and the editor's own links ask before
// unsaved changes go (ConfirmDialog in the page; useLeaveGuard for links,
// Back and closing the tab). Labels, hints and errors are wired with
// aria-describedby and aria-invalid; a refused save lists the problems at the
// top and focuses the first field. After a save the list comes back with the
// product's Edit link focused (ProductsTab, AdminPage's returnFocusId).
//
// Every write is checked (checkedWrite, AW-202). The live database before the
// October 2026 migrations is handled too: a new product gets the next free id
// when the table has no id default (23502); columns it doesn't have are left
// out, or dropped on PGRST204/42703 with a note; variant prices are hidden
// without product_variant_prices; a missing photo bucket says so. Prices come
// only from admin_product_prices() or the select('*') fallback (ProductsSection
// loadAdminProducts); a storefront select never names price.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { productImage } from '../../lib/images.js';
import { currentImageFile } from '../../data/catalogAliases.js';
import { catLabel } from '../../lib/format.js';
import { departmentsFor } from '../../lib/departments.js';
import { Link } from '../../lib/router.js';
import { MissingPhoto } from '../../components/MissingPhoto.jsx';
import { Picture } from '../../components/Picture.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import { LoadProblem } from './AdminStatus.jsx';
import { NO_ROWS, adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import {
  AXIS_LABELS, NEW_SUB, OPTIONAL_COLUMNS, PHOTO_BUCKET, PHOTO_URL, PRODUCT_TAGS, STOCK_LABELS, STOCK_STATUSES,
  draftChanged, draftFromRow, duplicateDraft, emptyDraft, errorFields, hasColumn, patchFromDraft, photoProblem, productImagePath,
  validateProduct, variantPriceChanges,
} from './productForm.js';

const MISSING_COLUMN = ['PGRST204', '42703'];
const MISSING_TABLE = ['PGRST205', '42P01'];
const codeOf = (error) => String(error?.code ?? '');
const errorText = (error) => `${error?.message || ''} ${error?.details || ''}`;
// The column a not-null error names ('null value in column "id" …').
const nullColumn = (error) => /column "([^"]+)"/.exec(errorText(error))?.[1] || null;
// The constraint a unique or check error names.
const constraintOf = (error) => /constraint "([^"]+)"/.exec(errorText(error))?.[1] || null;

export const UPDATE_NOTE = 'needs the October 2026 database update (see BACKEND.md)';
export const PHOTO_BUCKET_MISSING = 'Photo upload needs the October 2026 database update; enter a file name or URL instead.';
const COLUMN_NAMES = {
  stock_status: 'Stock status', featured_rank: 'Homepage rank', variant_axis: 'What the variants differ by', unavailable_variants: '“Can’t be ordered”',
  description_hidden: '“Show no description”',
};

// The checks (20261009100000, 20261009110000, 20261010120000) a refused save
// names, and the field each belongs to.
const CHECK_FIELDS = {
  products_name_brand_present: ['name', 'Enter a product name and a brand.'],
  products_price_nonnegative: ['price', 'Enter a price from 0 to 99999.99, or leave it blank for price on request.'],
  products_price_max: ['price', 'Enter a price from 0 to 99999.99, or leave it blank for price on request.'],
  products_variant_axis_chk: ['variantAxis', 'Choose what the variants differ by.'],
  products_stock_status_chk: ['stockStatus', 'Choose a stock status.'],
  products_featured_rank_chk: ['rank', 'Enter a whole number from 1 to 999, or leave it blank.'],
};

// Updates (id) or inserts (id null) a product. An insert goes without an id,
// and once more with `nextId` when the database has no id default (23502:
// before 20261010120000). A column the database doesn't have (PGRST204,
// 42703) drops the optional columns and tries again. Returns
// { id, error, dropped }.
export async function writeProduct(client, { id = null, values, nextId }) {
  let body = values;
  let explicitId = null;
  const dropped = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = explicitId != null ? { id: explicitId, ...body } : body;
    const result = id != null
      ? await checkedWrite(client.from('products').update(row).eq('id', id))
      : await checkedWrite(client.from('products').insert(row));
    const { error } = result;
    if (!error) {
      const saved = Array.isArray(result.data) ? result.data[0] : result.data;
      return { id: id ?? saved?.id ?? explicitId, error: null, dropped };
    }
    const optional = OPTIONAL_COLUMNS.filter((column) => column in body);
    if (MISSING_COLUMN.includes(codeOf(error)) && optional.length) {
      body = Object.fromEntries(Object.entries(body).filter(([column]) => !optional.includes(column)));
      dropped.push(...optional);
      // Nothing else changed: there is nothing left to write.
      if (id != null && Object.keys(body).length === 0) return { id, error: null, dropped };
    } else if (id == null && explicitId == null && codeOf(error) === '23502' && nullColumn(error) === 'id') {
      explicitId = nextId;
    } else {
      return { id: null, error, dropped };
    }
  }
  return { id: null, error: { code: 'AW_RETRIES', message: 'The database refused the product.' }, dropped };
}

// product_variant_prices: the rows a save removes, then the rows it writes.
// Returns the first error, or null.
export async function writeVariantPrices(client, productId, { deletes, upserts }) {
  for (const variant of deletes) {
    const { error } = await checkedWrite(
      client.from('product_variant_prices').delete().eq('product_id', productId).eq('variant', variant), 'product_id',
    );
    // A row someone else already removed is gone either way.
    if (error && error.code !== NO_ROWS) return error;
  }
  if (upserts.length) {
    const { error } = await checkedWrite(client.from('product_variant_prices').upsert(upserts, { onConflict: 'product_id,variant' }), 'product_id');
    if (error) return error;
  }
  return null;
}

// A refused save: field errors where the database names the field, else one
// message for the form.
function saveProblem(error, action) {
  const code = codeOf(error);
  if (code === '23505') {
    return constraintOf(error) === 'products_pkey'
      ? { general: 'Another product was added at the same time. Save again.' }
      : { fields: { sku: 'That SKU is already used.' } };
  }
  if (code === '23514' && CHECK_FIELDS[constraintOf(error)]) {
    const [field, message] = CHECK_FIELDS[constraintOf(error)];
    return { fields: { [field]: message } };
  }
  if (code === '23502' && nullColumn(error) === 'price') {
    return { fields: { price: `Enter a price: “price on request” ${UPDATE_NOTE}.` } };
  }
  return { general: adminErrorMessage(error, action) };
}

function photoUploadMessage(error) {
  const message = String(error?.message || '');
  if (/bucket not found/i.test(message)) return PHOTO_BUCKET_MISSING;
  const status = Number(error?.statusCode) || Number(error?.status) || undefined;
  if (status === 403 || /row-level security|unauthori[sz]ed/i.test(message)) return 'Only an approved admin can upload photos.';
  return adminErrorMessage({ ...error, message, status }, 'The photo didn’t upload');
}

// Uploads a checked photo file (photoProblem) to `path` in the product-images
// bucket. Resolves to { url } (its public address) or { error } (what to say).
// Admin -> Homepage uploads its hero photos the same way.
export async function uploadPhoto(client, path, file) {
  let error = null;
  try {
    ({ error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
  } catch (thrown) {
    error = thrown;
  }
  if (error) return { error: photoUploadMessage(error) };
  return { url: client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data?.publicUrl || '' };
}

// Where each field's control is, and what the error summary calls it.
const FIELDS = {
  name: ['product-name', 'Name'], brand: ['product-brand', 'Brand'], cat: ['product-cat', 'Department'], sub: ['product-sub', 'Sub-line'],
  newSub: ['product-new-sub', 'New sub-line'], sku: ['product-sku', 'SKU'], sellUnit: ['product-sell-unit', 'Sell unit'],
  description: ['product-description', 'Description'], variantAxis: ['product-axis', 'Variants differ by'], tag: ['product-tag', 'Tag'],
  price: ['product-price', 'List price'], rank: ['product-rank', 'Homepage rank'], stockStatus: ['product-stock', 'Stock status'],
  img: ['product-img', 'Image file or URL'],
};
const variantId = (key, part = '') => `product-variant-${key}${part ? `-${part}` : ''}`;
function fieldId(field) {
  if (FIELDS[field]) return FIELDS[field][0];
  const [kind, key] = field.split(':');
  return kind === 'variantPrice' ? variantId(key, 'price') : variantId(key);
}
function fieldLabel(field, draft) {
  if (FIELDS[field]) return FIELDS[field][1];
  const [kind, key] = field.split(':');
  const n = draft.variants.findIndex((v) => v.key === key) + 1;
  return kind === 'variantPrice' ? `Variant ${n} list price` : `Variant ${n}`;
}

const describedBy = (id, hint) => [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ');
const without = (object, key) => Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));

function startDraft(id, fromId, rows) {
  if (id === 'new') {
    const source = fromId != null ? rows.find((r) => r.id === fromId) : null;
    return source ? duplicateDraft(source, source.price, source.variantPrices) : emptyDraft();
  }
  const row = rows.find((r) => r.id === id);
  return row ? draftFromRow(row, row.price, row.variantPrices) : null;
}

// id: a product id or 'new'; fromId: the product a new one copies.
// rows / columns: Admin -> Products' loaded rows and the columns they carry.
// onSaved: after any write; reloads the list and the storefront catalog, and
// resolves when the list has the new rows.
// onLeave(productId): back to the list, focusing that product's Edit link
// (null: New product).
export function ProductEditor({ id, fromId = null, rows, columns, loadError, onRetry, retrying, onSaved, notify, onLeave }) {
  const isNew = id === 'new';
  // The draft as it opened (what "unsaved" compares with) and as edited.
  const [session, setSession] = useState(() => (rows ? { original: startDraft(id, fromId, rows) } : null));
  if (!session && rows) setSession({ original: startDraft(id, fromId, rows) });
  const original = session?.original || null;
  const draft = session ? (session.draft || original) : null;
  const setDraft = (update) => setSession((s) => ({ ...s, draft: update(s.draft || s.original) }));

  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(null); // 'saving' | 'uploading' | 'checking' | 'deleting'
  const [confirm, setConfirm] = useState(null); // { kind: 'discard' | 'delete' | 'deactivate', count }
  const [deleteNote, setDeleteNote] = useState('');
  const [leaving, setLeaving] = useState(null); // { productId }
  // A preview address that didn't load (a typo, a removed upload, offline).
  const [brokenSrc, setBrokenSrc] = useState(null);

  const departments = departmentsFor(rows || []);
  const pricesAvailable = !!columns?.has('variant_axis');
  const has = (column) => hasColumn(columns, column);
  const dirty = draftChanged(draft, original);
  const shownName = String(draft?.name || '').trim() || String(original?.name || '').trim() || (isNew ? 'the new product' : `product ${id}`);
  const savedName = String(original?.name || '').trim() || shownName;
  useLeaveGuard(dirty && !leaving, `Your changes to ${shownName} aren’t saved. Leave without saving them?`);

  // Leaving happens after the render that drops the leave guard.
  const left = useRef(false);
  useEffect(() => {
    if (!leaving || left.current) return;
    left.current = true;
    onLeave?.(leaving.productId);
  }, [leaving, onLeave]);
  const leave = (productId) => setLeaving({ productId });
  const backTo = isNew ? null : id;

  // On open, Name takes focus, in view: inside admin the page doesn't change
  // (same page key), so nothing else moves focus here.
  const nameRef = useRef(null);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !nameRef.current) return;
    opened.current = true;
    nameRef.current.focus({ preventScroll: true });
    nameRef.current.scrollIntoView?.({ block: 'center' });
  });
  // The control to focus after this render (first invalid field, a moved
  // variant's button, a new variant).
  const focusNext = useRef(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    document.getElementById(target)?.focus();
  });

  if (!rows) {
    return (
      <section className="product-editor" aria-labelledby="product-editor-title">
        <h2 id="product-editor-title">{isNew ? 'New product' : 'Edit product'}</h2>
        {loadError ? <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} /> : <p className="result-note">Loading…</p>}
      </section>
    );
  }
  if (!draft) {
    return (
      <section className="product-editor" aria-labelledby="product-editor-title">
        <h2 id="product-editor-title">Product not found</h2>
        <p className="result-note">{`No product has the id ${id}. It may have been deleted.`}</p>
        <Link className="button sm ghost" to="/admin/products">All products</Link>
      </section>
    );
  }

  const set = (field, value, extra = {}) => {
    setDraft((d) => ({ ...d, [field]: value, ...extra }));
    if (errors[field]) setErrors((all) => without(all, field));
  };
  const setVariant = (key, change, field) => {
    setDraft((d) => ({ ...d, variants: d.variants.map((v) => (v.key === key ? { ...v, ...change } : v)) }));
    if (field && errors[field]) setErrors((all) => without(all, field));
  };
  const addVariant = () => {
    const key = `v${draft.nextKey}`;
    setDraft((d) => ({ ...d, nextKey: d.nextKey + 1, variants: [...d.variants, { key, label: '', original: null, unavailable: false, priceText: '', hadPrice: false }] }));
    focusNext.current = variantId(key);
  };
  const moveVariant = (key, step) => {
    const from = draft.variants.findIndex((v) => v.key === key);
    const to = from + step;
    if (to < 0 || to >= draft.variants.length) return;
    setDraft((d) => {
      const list = [...d.variants];
      [list[from], list[to]] = [list[to], list[from]];
      return { ...d, variants: list };
    });
    // The same button, unless the row reached the end it was moving to.
    const atEnd = to === 0 || to === draft.variants.length - 1;
    focusNext.current = variantId(key, atEnd ? (step < 0 ? 'down' : 'up') : (step < 0 ? 'up' : 'down'));
  };
  const removeVariant = (key) => {
    const at = draft.variants.findIndex((v) => v.key === key);
    const next = draft.variants[at + 1] || draft.variants[at - 1];
    setDraft((d) => ({ ...d, variants: d.variants.filter((v) => v.key !== key) }));
    focusNext.current = next ? variantId(next.key) : 'product-variant-add';
  };

  const showErrors = (found) => {
    setErrors(found);
    const [first] = errorFields(found, draft);
    if (first) focusNext.current = fieldId(first);
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setSaveError('');
    const check = validateProduct(draft, { rows, departments, columns, variantPrices: pricesAvailable });
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }
    setErrors({});
    const values = patchFromDraft(draft, isNew ? null : original, { columns, departments });
    const unchangedPrices = variantPriceChanges(draft, original, id);
    if (!isNew && Object.keys(values).length === 0 && (!pricesAvailable || (unchangedPrices.deletes.length + unchangedPrices.upserts.length === 0))) {
      notify?.(`No changes to ${savedName}.`);
      leave(backTo);
      return;
    }
    setBusy('saving');
    const nextId = Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1;
    const action = isNew ? `${shownName} wasn’t added` : `The changes to ${savedName} weren’t saved`;
    const written = isNew || Object.keys(values).length
      ? await writeProduct(supabase, { id: isNew ? null : id, values, nextId })
      : { id, error: null, dropped: [] };
    if (written.error || written.id == null) {
      setBusy(null);
      const problem = saveProblem(written.error || { message: 'The new product’s id didn’t come back.' }, action);
      if (problem.fields) showErrors(problem.fields);
      else setSaveError(problem.general);
      return;
    }
    const notes = [];
    if (written.dropped.length) {
      notes.push(`${written.dropped.map((c) => COLUMN_NAMES[c]).join(', ')}: not saved, ${UPDATE_NOTE}.`);
    }
    if (pricesAvailable) {
      const priceError = await writeVariantPrices(supabase, written.id, variantPriceChanges(draft, isNew ? null : original, written.id));
      if (priceError) {
        notes.push(MISSING_TABLE.includes(codeOf(priceError))
          ? `Variant prices: not saved, ${UPDATE_NOTE}.`
          : adminErrorMessage(priceError, 'Its variant prices weren’t saved'));
      }
    }
    notify?.([`Saved ${String(draft.name).trim()}.`, ...notes].join(' '));
    // The list shows the saved row when it comes back.
    await onSaved?.();
    leave(written.id);
  };

  const cancel = () => {
    if (busy === 'saving' || busy === 'deleting') return;
    if (dirty) setConfirm({ kind: 'discard' });
    else leave(backTo);
  };
  const onFormKey = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    cancel();
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    const input = event.target;
    if (!file) return;
    const problem = photoProblem(file);
    setPhotoError(problem || '');
    if (problem) {
      input.value = '';
      return;
    }
    setBusy('uploading');
    const { url, error } = await uploadPhoto(supabase, productImagePath(isNew ? null : id, file), file);
    if (error) setPhotoError(error);
    else set('img', url);
    setBusy(null);
    input.value = '';
  };

  // Delete: only a product no order line refers to (the database refuses
  // the others, 20261010120000); for those, Deactivate.
  const startDelete = async () => {
    setDeleteNote('');
    setSaveError('');
    setBusy('checking');
    const result = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id);
    setBusy(null);
    const error = withStatus(result);
    if (error) {
      setSaveError(adminErrorMessage(error, `Couldn’t check whether ${savedName} is on any order`));
      return;
    }
    const count = Number(result.count) || 0;
    if (count === 0) setConfirm({ kind: 'delete' });
    else if (original.active) setConfirm({ kind: 'deactivate', count });
    else setDeleteNote(`${savedName} is on ${count === 1 ? '1 order line' : `${count} order lines`}, so it can’t be deleted: the order history keeps its link to it. It’s already inactive, so buyers don’t see it.`);
  };
  const remove = async () => {
    setBusy('deleting');
    const { error } = await checkedWrite(supabase.from('products').delete().eq('id', id));
    setBusy(null);
    setConfirm(null);
    if (error) {
      setSaveError(error.hint === 'product_has_orders'
        ? `${savedName} is on an order now, so it can’t be deleted. Deactivate it instead.`
        : adminErrorMessage(error, `${savedName} wasn’t deleted`));
      return;
    }
    notify?.(`Deleted ${savedName}.`);
    setBusy('deleting');
    await onSaved?.();
    leave(null);
  };
  const deactivate = async () => {
    setBusy('deleting');
    const { error } = await checkedWrite(supabase.from('products').update({ active: false }).eq('id', id));
    setBusy(null);
    setConfirm(null);
    if (error) {
      setSaveError(adminErrorMessage(error, `${savedName} wasn’t deactivated`));
      return;
    }
    notify?.(`Deactivated ${savedName}. It stays in the order history.`);
    setBusy('deleting');
    await onSaved?.();
    leave(id);
  };

  const err = (field) => errors[field] || '';
  const invalid = (field) => (errors[field] ? true : undefined);
  const summary = errorFields(errors, draft);
  const dept = departments.find((d) => d.key === draft.cat);
  // A renamed photo file (AW-290) shows under either name. An address on
  // another site isn't previewed: the CSP would block it (AW-205).
  const offSite = /^(https?:)?\/\//i.test(draft.img.trim()) && !PHOTO_URL.test(draft.img.trim());
  const preview = offSite ? { img: null, picture: null } : productImage(currentImageFile(draft.img));
  const previewSrc = preview.picture?.src || preview.img;
  const previewBroken = !!previewSrc && previewSrc === brokenSrc;
  const disabled = !!busy;
  const unavailableColumn = has('unavailable_variants');
  // Only when the load saw the column (20261012120000, AW-023).
  const hideDescriptionColumn = !!columns?.has('description_hidden');
  const copying = isNew && fromId != null && rows.some((r) => r.id === fromId);

  return (
    <section className="product-editor" aria-labelledby="product-editor-title">
      <div className="product-editor-head">
        <div>
          <h2 id="product-editor-title">{isNew ? 'New product' : 'Edit product'}</h2>
          <p className="result-note">{isNew ? (copying ? `A copy of product ${fromId}` : 'Not in the catalog until you add it.') : `Product ${id}: ${savedName}`}</p>
        </div>
        {!isNew && (
          <div className="inline-actions">
            {original.active && <Link className="button xs text" to={`/product/${id}`}>View on site</Link>}
            <Link className="button xs ghost" to={`/admin/products/new?from=${id}`}>Duplicate</Link>
          </div>
        )}
      </div>

      {summary.length > 0 && (
        <div className="callout error form-error-summary" role="alert">
          <p>{summary.length === 1 ? 'Check this field:' : `Check these ${summary.length} fields:`}</p>
          <ul>
            {summary.map((field) => <li key={field}>{`${fieldLabel(field, draft)}: ${errors[field]}`}</li>)}
          </ul>
        </div>
      )}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}

      {/* Escape anywhere in the form cancels, like the Cancel button (AW-117). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form className="form-grid product-form" noValidate onSubmit={save} onKeyDown={onFormKey} aria-labelledby="product-editor-title">
        <div className="full">
          <label htmlFor="product-name">Name</label>
          <input id="product-name" ref={nameRef} value={draft.name} maxLength={400} autoComplete="off"
            aria-invalid={invalid('name')} aria-describedby={describedBy('product-name')} onChange={(e) => set('name', e.target.value)} />
          <p className="form-error" id="product-name-error">{err('name')}</p>
        </div>
        <div>
          <label htmlFor="product-brand">Brand</label>
          <input id="product-brand" value={draft.brand} maxLength={400} autoComplete="off"
            aria-invalid={invalid('brand')} aria-describedby={describedBy('product-brand')} onChange={(e) => set('brand', e.target.value)} />
          <p className="form-error" id="product-brand-error">{err('brand')}</p>
        </div>
        <div>
          <label htmlFor="product-sku">SKU</label>
          <input id="product-sku" className="product-sku" value={draft.sku} maxLength={80} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            aria-invalid={invalid('sku')} aria-describedby={describedBy('product-sku', true)} onChange={(e) => set('sku', e.target.value)} />
          <small className="field-hint" id="product-sku-hint">Capital letters, digits and hyphens, used once. Saved carts and Quick reorder entries use the SKU: after a change they won’t match the old one (an alias for it can only be added in the code).</small>
          <p className="form-error" id="product-sku-error">{err('sku')}</p>
        </div>
        <div>
          <label htmlFor="product-cat">Department</label>
          <select id="product-cat" value={draft.cat} aria-invalid={invalid('cat')} aria-describedby={describedBy('product-cat')}
            onChange={(e) => {
              const next = departments.find((d) => d.key === e.target.value);
              set('cat', e.target.value, { sub: next?.subs.includes(draft.sub) ? draft.sub : '' });
            }}>
            <option value="">Choose a department</option>
            {departments.map((d) => <option key={d.key} value={d.key}>{catLabel(d.key)}</option>)}
          </select>
          <p className="form-error" id="product-cat-error">{err('cat')}</p>
        </div>
        <div>
          <label htmlFor="product-sub">Sub-line</label>
          <select id="product-sub" value={draft.sub} disabled={!dept} aria-invalid={invalid('sub')} aria-describedby={describedBy('product-sub')}
            onChange={(e) => set('sub', e.target.value)}>
            <option value="">{dept ? 'Choose a sub-line' : 'Choose a department first'}</option>
            {(dept?.subs || []).map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={NEW_SUB}>New sub-line…</option>
          </select>
          <p className="form-error" id="product-sub-error">{err('sub')}</p>
        </div>
        {draft.sub === NEW_SUB && (
          <div>
            <label htmlFor="product-new-sub">New sub-line name</label>
            <input id="product-new-sub" value={draft.newSub} maxLength={120} autoComplete="off"
              aria-invalid={invalid('newSub')} aria-describedby={describedBy('product-new-sub')} onChange={(e) => set('newSub', e.target.value)} />
            <p className="form-error" id="product-new-sub-error">{err('newSub')}</p>
          </div>
        )}
        <div>
          <label htmlFor="product-sell-unit">Sell unit</label>
          <input id="product-sell-unit" value={draft.sellUnit} maxLength={120} autoComplete="off" placeholder="e.g. box of 24"
            aria-invalid={invalid('sellUnit')} aria-describedby={describedBy('product-sell-unit', true)} onChange={(e) => set('sellUnit', e.target.value)} />
          <small className="field-hint" id="product-sell-unit-hint">What quantity 1 means. Leave blank if it isn’t known yet.</small>
          <p className="form-error" id="product-sell-unit-error">{err('sellUnit')}</p>
        </div>
        <div className="full">
          <label htmlFor="product-description">Description</label>
          <textarea id="product-description" rows={5} value={draft.description}
            aria-invalid={invalid('description')} aria-describedby={describedBy('product-description', true)} onChange={(e) => set('description', e.target.value)} />
          <small className="field-hint" id="product-description-hint">{hideDescriptionColumn
            ? 'Leave blank to show the standard description. To show none at all, tick “Show no description”.'
            : 'Leave blank to show the standard description.'}</small>
          <p className="form-error" id="product-description-error">{err('description')}</p>
        </div>
        {hideDescriptionColumn && (
          <div className="full consent">
            <input id="product-description-hidden" type="checkbox" checked={draft.descriptionHidden} onChange={(e) => set('descriptionHidden', e.target.checked)} />
            <label htmlFor="product-description-hidden">Show no description: the product page has none (the text above is kept)</label>
          </div>
        )}

        <div className="full product-variants">
          <h3 id="product-variants-title">Variants</h3>
          <p className="field-hint" id="product-variants-hint">Renaming or removing a variant: carts and Quick reorder entries saved with the old name won’t match it any more. To stop orders of one for now, tick “Can’t be ordered” instead.</p>
          <ol className="variant-list" aria-labelledby="product-variants-title">
            {draft.variants.map((v, i) => (
              <li key={v.key} className={`variant-row${pricesAvailable ? ' has-price' : ''}`}>
                <div className="variant-name">
                  <label htmlFor={variantId(v.key)}>{`Variant ${i + 1}`}</label>
                  <input id={variantId(v.key)} value={v.label} maxLength={120} autoComplete="off"
                    aria-invalid={invalid(`variant:${v.key}`)} aria-describedby={`${variantId(v.key)}-error product-variants-hint`}
                    onChange={(e) => setVariant(v.key, { label: e.target.value }, `variant:${v.key}`)} />
                  <p className="form-error" id={`${variantId(v.key)}-error`}>{err(`variant:${v.key}`)}</p>
                </div>
                {pricesAvailable && (
                  <div className="variant-price">
                    <label htmlFor={variantId(v.key, 'price')}>List price<span className="sr-only">{` of variant ${i + 1}`}</span></label>
                    <input id={variantId(v.key, 'price')} value={v.priceText} inputMode="decimal" autoComplete="off" placeholder="Product’s"
                      aria-invalid={invalid(`variantPrice:${v.key}`)} aria-describedby={`${variantId(v.key, 'price')}-error`}
                      onChange={(e) => setVariant(v.key, { priceText: e.target.value }, `variantPrice:${v.key}`)} />
                    <p className="form-error" id={`${variantId(v.key, 'price')}-error`}>{err(`variantPrice:${v.key}`)}</p>
                  </div>
                )}
                <div className="variant-actions">
                  {unavailableColumn && (
                    <div className="consent">
                      <input id={variantId(v.key, 'off')} type="checkbox" checked={v.unavailable} onChange={(e) => setVariant(v.key, { unavailable: e.target.checked })} />
                      <label htmlFor={variantId(v.key, 'off')}>Can’t be ordered<span className="sr-only">{`: variant ${i + 1}`}</span></label>
                    </div>
                  )}
                  <div className="inline-actions">
                    <button id={variantId(v.key, 'up')} className="button xs ghost" type="button" disabled={i === 0} onClick={() => moveVariant(v.key, -1)}>
                      <span>Move up</span><span className="sr-only">{`: variant ${i + 1}`}</span>
                    </button>
                    <button id={variantId(v.key, 'down')} className="button xs ghost" type="button" disabled={i === draft.variants.length - 1} onClick={() => moveVariant(v.key, 1)}>
                      <span>Move down</span><span className="sr-only">{`: variant ${i + 1}`}</span>
                    </button>
                    <button className="button xs text" type="button" onClick={() => removeVariant(v.key)}>
                      <span>Remove</span><span className="sr-only">{`: variant ${i + 1}`}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button id="product-variant-add" className="button xs ghost" type="button" onClick={addVariant}>Add variant</button>
          {pricesAvailable && <p className="field-hint">A variant’s list price is blank when it costs the product’s price.</p>}
        </div>

        {draft.variants.length > 1 && (
          <div>
            <label htmlFor="product-axis">Variants differ by</label>
            <select id="product-axis" value={draft.variantAxis} disabled={!has('variant_axis')} aria-invalid={invalid('variantAxis')}
              aria-describedby={describedBy('product-axis', !has('variant_axis'))} onChange={(e) => set('variantAxis', e.target.value)}>
              <option value="">Choose</option>
              {AXIS_LABELS.map((axis) => <option key={axis} value={axis}>{axis}</option>)}
            </select>
            {!has('variant_axis') && <small className="field-hint" id="product-axis-hint">{`This ${UPDATE_NOTE}.`}</small>}
            <p className="form-error" id="product-axis-error">{err('variantAxis')}</p>
          </div>
        )}
        <div>
          <label htmlFor="product-tag">Tag</label>
          <select id="product-tag" value={draft.tag} aria-invalid={invalid('tag')} aria-describedby={describedBy('product-tag', true)}
            onChange={(e) => set('tag', e.target.value)}>
            <option value="">—</option>
            {PRODUCT_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          <small className="field-hint" id="product-tag-hint">NEW puts it in the homepage’s New arrivals, BESTSELLER in Bestsellers.</small>
          <p className="form-error" id="product-tag-error">{err('tag')}</p>
        </div>
        <div>
          <label htmlFor="product-price">List price</label>
          <input id="product-price" value={draft.priceText} inputMode="decimal" autoComplete="off" placeholder="On request"
            aria-invalid={invalid('price')} aria-describedby={describedBy('product-price', true)} onChange={(e) => set('priceText', e.target.value)} />
          <small className="field-hint" id="product-price-hint">In dollars, up to 99999.99. Leave blank for price on request.</small>
          <p className="form-error" id="product-price-error">{err('price')}</p>
        </div>
        <div>
          <label htmlFor="product-rank">Homepage rank</label>
          <input id="product-rank" value={draft.rankText} inputMode="numeric" autoComplete="off" disabled={!has('featured_rank')}
            aria-invalid={invalid('rank')} aria-describedby={describedBy('product-rank', true)} onChange={(e) => set('rankText', e.target.value)} />
          <small className="field-hint" id="product-rank-hint">{has('featured_rank')
            ? '1 to 999: lower shows first in its homepage rail (by tag). Blank: after the ranked ones.'
            : `Homepage rank ${UPDATE_NOTE}.`}</small>
          <p className="form-error" id="product-rank-error">{err('rank')}</p>
        </div>
        <div>
          <label htmlFor="product-stock">Stock status</label>
          {/* TODO(owner): How should a low or out-of-stock product show to buyers (a badge, a note, refusing the line), or should stock status stay staff only? (AW-023) */}
          <select id="product-stock" value={draft.stockStatus} disabled={!has('stock_status')} aria-invalid={invalid('stockStatus')}
            aria-describedby={describedBy('product-stock', true)} onChange={(e) => set('stockStatus', e.target.value)}>
            {STOCK_STATUSES.map((status) => <option key={status} value={status}>{STOCK_LABELS[status]}</option>)}
          </select>
          <small className="field-hint" id="product-stock-hint">{has('stock_status')
            ? 'Staff only for now: not shown to buyers.'
            : `Stock status ${UPDATE_NOTE}.`}</small>
          <p className="form-error" id="product-stock-error">{err('stockStatus')}</p>
        </div>
        <div className="full consent">
          <input id="product-active" type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
          <label htmlFor="product-active">Active: shown in the catalog and can be ordered</label>
        </div>

        <div className="full product-photo">
          <h3>Photo</h3>
          <div className="product-photo-body">
            <div className="product-photo-preview">
              {/* Picture: the placeholder when the photo fails, a retry when the
                  connection comes back (AW-192, AW-343). */}
              {previewSrc && !previewBroken
                ? <Picture picture={preview.picture} sizes="10rem" fallback={<MissingPhoto compact />} onFail={() => setBrokenSrc(previewSrc)} />
                : <MissingPhoto compact />}
            </div>
            <div className="product-photo-fields">
              <label htmlFor="product-photo-file">Upload a photo</label>
              <input id="product-photo-file" className="doc-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
                aria-describedby="product-photo-file-hint product-photo-file-error" onChange={upload} />
              <small className="field-hint" id="product-photo-file-hint">{busy === 'uploading' ? 'Uploading…' : 'JPEG, PNG or WebP, up to 5 MB.'}</small>
              <p className="form-error" id="product-photo-file-error" aria-live="polite">{photoError}</p>
              <label htmlFor="product-img">Image file or URL</label>
              <input id="product-img" value={draft.img} maxLength={1000} autoComplete="off" spellCheck={false}
                aria-invalid={invalid('img')} aria-describedby={describedBy('product-img', true)} onChange={(e) => set('img', e.target.value)} />
              <small className="field-hint" id="product-img-hint">{offSite
                ? 'Photos on other sites are blocked by the site’s security settings. Upload the photo instead.'
                : draft.img.trim() && !previewSrc
                  ? 'There is no photo by that name in this build of the site.'
                  : previewBroken
                    ? 'The photo at that address didn’t load. Check it, or upload the photo again.'
                    : 'A photo file bundled with the site (e.g. kite.jpg), or the address of an uploaded photo. An upload fills this in.'}</small>
              <p className="form-error" id="product-img-error">{err('img')}</p>
              {draft.img.trim() && <button className="button xs ghost" type="button" onClick={() => set('img', '')}>Remove photo</button>}
            </div>
          </div>
        </div>

        <div className="full dialog-actions product-editor-actions">
          <button className="button" type="submit" disabled={disabled}>{busy === 'saving' ? 'Saving…' : (isNew ? 'Add product' : 'Save product')}</button>
          <button className="button ghost" type="button" onClick={cancel}>Cancel</button>
          {!isNew && <button className="button xs text product-delete" type="button" disabled={disabled} onClick={startDelete}>Delete product</button>}
        </div>
        <p className="full form-error" aria-live="polite">{deleteNote}</p>
      </form>

      {confirm?.kind === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          body={`Your changes to ${shownName} aren’t saved.`}
          confirmLabel="Discard changes" cancelLabel="Keep editing" historyEntry={false}
          onConfirm={() => { setConfirm(null); leave(backTo); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${savedName}?`}
          body="This can’t be undone."
          confirmLabel="Delete product" busy={busy === 'deleting'} historyEntry={false}
          onConfirm={remove} onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${savedName}?`}
          body={`It is on ${confirm.count === 1 ? '1 order line' : `${confirm.count} order lines`}, so it can’t be deleted: the order history keeps its link to it. Deactivating hides it from the catalog and from carts.${dirty ? ' Your other unsaved changes are dropped.' : ''}`}
          confirmLabel="Deactivate" busy={busy === 'deleting'} historyEntry={false}
          onConfirm={deactivate} onCancel={() => setConfirm(null)}
        />
      )}
    </section>
  );
}
