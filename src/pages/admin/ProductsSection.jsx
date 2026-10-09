// Admin -> Products: the catalog rows with their photo and list price
// (/admin/products), and the product editor (ProductEditor.jsx) at
// /admin/products/:id and /admin/products/new (AW-023). The rows are loaded
// once here and shared by both, so coming back from the editor shows the
// list at once, where it was.
//
// The list (AW-115) filters by status, department, sub-line, tag, stock
// status, no photo and no sell unit, searches the name, brand, SKU,
// department, sub-line and id, sorts by ID, name, brand, price or last
// change, and shows 50 rows a page; all of it lives in the URL
// (productList.js, adminRoutes.js). Inactive products are greyed, with an
// Inactive pill.
//
// Bulk changes (AW-114): a checkbox per row and 'Select all <n> filtered'
// (the selection is by id: it survives paging and clears when the filters
// change), then the bulk bar (ProductBulk.jsx). Export CSV writes the
// selection or the filtered rows; Import CSV previews a file's changes and
// new products (ProductImport.jsx). Changes patch the loaded rows in place;
// an import that added products loads the list again, for their ids.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatMoney } from '../../lib/format.js';
import { productImage } from '../../lib/images.js';
import { currentImageFile } from '../../data/catalogAliases.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { variantCount } from '../../lib/lines.js';
import { MAX_PRODUCT_QUERY, adminHref } from '../../lib/adminRoutes.js';
import { fetchAllRows } from '../../lib/paging.js';
import { Link, navigate } from '../../lib/router.js';
import { Thumb } from '../../components/Thumb.jsx';
import { Icon } from '../../components/Icon.jsx';
import { adminErrorMessage, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { TableScroll } from './TableScroll.jsx';
import { ProductEditor } from './ProductEditor.jsx';
import { BulkBar, plural } from './ProductBulk.jsx';
import { ImportPreview } from './ProductImport.jsx';
import { PRODUCT_TAGS, STOCK_LABELS, STOCK_STATUSES } from './productForm.js';
import { ariaSort, countText, departmentOptions, filterSignature, filterSortPage, hasFilters, isInactive, nextSort } from './productList.js';
import { csvFileName, importPlan, productCsvRecords } from './productBulk.js';
import { CsvError, downloadCsv, parseCsv, toCsv } from './csv.js';

// The product columns Admin -> Products reads. Never price: admins read list
// prices through admin_product_prices() (AW-003).
const ADMIN_PRODUCT_COLUMNS = 'id,name,brand,cat,sub,sku,tag,active';
// What the load tries, in order, while the database answers 42703 (a column
// it doesn't have yet): everything the editor edits; then without
// description_hidden (before 20261012120000, AW-023); then without
// stock_status and featured_rank (before 20261010120000); then without
// variant_axis and unavailable_variants (before 20261009110000).
export const ADMIN_COLUMN_STEPS = [
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,variant_axis,unavailable_variants,img,stock_status,featured_rank,description_hidden`,
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,variant_axis,unavailable_variants,img,stock_status,featured_rank`,
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,variant_axis,unavailable_variants,img`,
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,img`,
];
// The step that worked last, so the next load starts there.
let workingStep = 0;
export const resetAdminProductColumnsForTests = () => { workingStep = 0; };

// A product's own variant prices from admin_product_prices():
// { "<label>": { list } } -> { "<label>": list }.
const variantPricesOf = (entry) => Object.fromEntries(
  Object.entries(entry?.variants || {}).map(([label, value]) => [label, value?.list ?? null]),
);

// Products and their list prices. Guests and signed-in accounts can't read
// products.price (AW-003), so the rows are read without it and the prices
// (and each variant's own) come from admin_product_prices(), which only
// admins may call. A database without that function (before 20261009100000)
// still lets select('*') read the price. Returns { rows, error, columns }:
// columns is the set of products columns the rows carry, which tells the
// editor what the database has.
export async function loadAdminProducts(client) {
  const pricing = client.rpc('admin_product_prices', {}, { get: true }).then((result) => result);
  let products = null;
  let step = workingStep;
  // Every product, a page of 1000 at a time (AW-199); a missing column
  // fails the first page, which is where the step is found.
  for (; step < ADMIN_COLUMN_STEPS.length; step += 1) {
    const columns = ADMIN_COLUMN_STEPS[step];
    products = await fetchAllRows(() => client.from('products').select(columns).order('id'));
    if (products.error?.code !== '42703') break;
  }
  step = Math.min(step, ADMIN_COLUMN_STEPS.length - 1);
  const prices = await pricing;
  if (prices.error && MISSING_FUNCTION_CODES.includes(prices.error.code)) {
    const legacy = await fetchAllRows(() => client.from('products').select('*').order('id'));
    const error = withStatus(legacy);
    if (error) return { rows: null, error, columns: null };
    const rows = (legacy.data || []).map((p) => ({ ...p, variantPrices: {} }));
    return { rows, error: null, columns: rows.length ? new Set(Object.keys(rows[0])) : null };
  }
  const error = withStatus(products) || withStatus(prices);
  if (error) return { rows: null, error, columns: null };
  workingStep = step;
  const listed = prices.data || {};
  return {
    rows: (products.data || []).map((p) => ({ ...p, price: listed[p.id]?.list ?? null, variantPrices: variantPricesOf(listed[p.id]) })),
    error: null,
    columns: new Set(ADMIN_COLUMN_STEPS[step].split(',')),
  };
}

// How long the search box waits after typing stops before it writes ?q=.
export const SEARCH_DEBOUNCE_MS = 300;

const editorHref = (id) => `/admin/products/${id}`;
export const NEW_PRODUCT_LINK_ID = 'new-product';
export const editLinkId = (id) => `edit-product-${id}`;
const currentUrl = () => window.location.pathname + window.location.search;

// route: the admin route; route.id is a product id or 'new' for the editor.
// query: the URL's filters (q, AW-118); onQuery writes them.
// notify: shows what a change did (useAdminStatus).
// returnFocusId / onReturnFocus: the control the list focuses when it shows
// again (AdminPage keeps it), e.g. the Edit link of the product just saved.
export function ProductsTab({ route = {}, query = {}, onQuery, onCatalogChange, notify, returnFocusId = null, onReturnFocus }) {
  const [data, setData] = useState({ rows: null, columns: null });
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  // The editor URL the list opened, so leaving it goes Back to the list with
  // its filters and scroll position; an editor opened any other way goes to
  // the list by link.
  const [openedFrom, setOpenedFrom] = useState(null);
  // Bulk actions the database doesn't have yet (PGRST202/42883 seen):
  // { adjust, import, create } (create: an import adding products,
  // admin_import_products_v2).
  const [missing, setMissing] = useState({});

  // A failed load says so, with Try again, never "0 of 0 products" (AW-202);
  // rows already on screen stay.
  const reload = () => loadAdminProducts(supabase).then(({ rows, error, columns }) => {
    setLoadError(error ? adminErrorMessage(error, 'The products didn’t load') : null);
    if (rows) setData({ rows, columns });
  });
  useEffect(() => { reload(); }, []);
  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };

  // productId: the product whose Edit link takes focus (null: New product).
  const leaveEditor = (productId) => {
    onReturnFocus?.(productId != null ? editLinkId(productId) : NEW_PRODUCT_LINK_ID);
    const back = openedFrom && openedFrom === currentUrl();
    setOpenedFrom(null);
    if (back) window.history.back();
    else navigate('/admin/products', { replace: true, force: true });
  };

  // A bulk change or an import: the changed rows are patched where they are
  // (patches: id -> changed columns), the storefront reloads its catalog,
  // and the status line says what happened. Products an import added
  // (created) come with the list loaded again: only the database knows
  // their ids.
  const applied = (patches, message, { created = 0 } = {}) => {
    setData((current) => ({
      ...current,
      rows: current.rows?.map((row) => (patches.has(row.id) ? { ...row, ...patches.get(row.id) } : row)) ?? null,
    }));
    onCatalogChange?.();
    notify?.(message);
    if (created > 0) reload();
  };

  if (route.id != null) {
    return (
      <ProductEditor
        key={`${route.id}|${query.from ?? ''}`}
        id={route.id} fromId={query.from ?? null} rows={data.rows} columns={data.columns}
        loadError={loadError} onRetry={retry} retrying={retrying}
        onSaved={() => { onCatalogChange?.(); return reload(); }} notify={notify} onLeave={leaveEditor}
      />
    );
  }
  return (
    <ProductsList
      rows={data.rows} columns={data.columns} loadError={loadError} onRetry={retry} retrying={retrying} query={query} onQuery={onQuery}
      onOpen={setOpenedFrom} returnFocusId={returnFocusId} onReturnFocus={onReturnFocus}
      notify={notify} onApplied={applied} missing={missing} onMissing={(key) => setMissing((m) => ({ ...m, [key]: true }))}
    />
  );
}

// The 48px photo of a row (AW-023): the bundled file or the uploaded one, or
// the "photo coming soon" mark, also when the photo fails (Thumb, AW-192). A
// renamed photo file (AW-290) shows under either name.
function RowPhoto({ img }) {
  return <span className="product-thumb"><Thumb src={productImage(currentImageFile(img)).img} /></span>;
}

// The list's columns; those with a `sort` have a sort button in their header
// (AW-115). The SKU, which the search matches, and the number of variants
// show too (AW-106).
const COLUMNS = [
  { label: 'ID', sort: 'id' },
  { label: 'Photo' },
  { label: 'Name', sort: 'name' },
  { label: 'SKU' },
  { label: 'Brand', sort: 'brand' },
  { label: 'Category' },
  { label: 'Variants' },
  { label: 'Price', sort: 'price' },
  { label: 'Tag' },
  { label: 'Active' },
  { label: 'Updated', sort: 'updated' },
];
const TAG_OPTIONS = [['', 'Any tag'], ['none', 'No tag'], ...PRODUCT_TAGS.map((tag) => [tag.toLowerCase(), tag])];
const productsHref = (query) => adminHref({ section: 'products', query });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// When a product was last changed: 'Oct 1, 2026'.
function Updated({ value }) {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return <span>—</span>;
  return <time dateTime={value}>{dateFormat.format(time)}</time>;
}

// A column header: a button that sorts by the column, with aria-sort on the
// sorted one (AW-115).
function SortHeader({ column, query, onQuery }) {
  const sorted = ariaSort(query, column.sort);
  return (
    <th aria-sort={sorted}>
      <button className="sort-button" type="button" onClick={() => onQuery?.(nextSort(query, column.sort))}>
        <span>{column.label}</span>
        {sorted && <Icon name="chevron-down" className={sorted === 'ascending' ? 'sort-icon is-ascending' : 'sort-icon'} />}
      </button>
    </th>
  );
}

// Status, department, sub-line, tag and stock status, and the No photo and
// No sell unit toggles (AW-115). Each change goes into the URL at once.
function ProductFilters({ query, onFilter, departments, stock, clearHref, filtered }) {
  const dept = departments.find((d) => d.value === query.dept) || null;
  return (
    <div className="admin-toolbar" role="group" aria-label="Filter products">
      <label>Status
        <select value={query.status || ''} onChange={(e) => onFilter({ status: e.target.value })}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>Department
        <select value={dept ? dept.value : ''} onChange={(e) => onFilter({ dept: e.target.value, sub: undefined })}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label>Sub-line
        <select value={dept && query.sub ? query.sub : ''} disabled={!dept} onChange={(e) => onFilter({ sub: e.target.value })}>
          <option value="">{dept ? 'All sub-lines' : 'Choose a department first'}</option>
          {(dept?.subs || []).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label>Tag
        <select value={query.tag || ''} onChange={(e) => onFilter({ tag: e.target.value })}>
          {TAG_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {stock && (
        <label>Stock
          <select value={query.stock || ''} onChange={(e) => onFilter({ stock: e.target.value })}>
            <option value="">Any stock status</option>
            {STOCK_STATUSES.map((s) => <option key={s} value={s}>{STOCK_LABELS[s]}</option>)}
          </select>
        </label>
      )}
      <label className="admin-toggle">
        <input type="checkbox" checked={query.photo === 'none'} onChange={(e) => onFilter({ photo: e.target.checked ? 'none' : undefined })} />
        No photo
      </label>
      <label className="admin-toggle">
        <input type="checkbox" checked={query.unit === 'none'} onChange={(e) => onFilter({ unit: e.target.checked ? 'none' : undefined })} />
        No sell unit
      </label>
      {filtered && <Link className="text-link" to={clearHref} replace scroll={false}>Clear filters</Link>}
    </div>
  );
}

// The largest file Import CSV reads (1000 rows are well under it).
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function ProductsList({
  rows, columns, loadError, onRetry, retrying, query, onQuery, onOpen, returnFocusId, onReturnFocus, notify, onApplied, missing = {}, onMissing,
}) {
  // The search box filters as you type and keeps ?q= in step a moment later,
  // so a reload, a bookmark or Back shows the same search. `seen` is the q
  // last read from the URL: a new one (Back, Forward, the section link) goes
  // into the box, the box's own writes don't come back into it.
  const urlSearch = query.q || '';
  const [search, setSearch] = useState(urlSearch);
  const [seen, setSeen] = useState(urlSearch);
  if (urlSearch !== seen) {
    setSeen(urlSearch);
    setSearch(urlSearch);
  }
  useEffect(() => {
    const next = search.trim().slice(0, MAX_PRODUCT_QUERY).trim();
    if (next === urlSearch || !onQuery) return undefined;
    const timer = setTimeout(() => {
      setSeen(next);
      onQuery({ ...query, q: next, page: undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, urlSearch, query, onQuery]);

  // The filters, sort and page of the URL, with the search as typed.
  const listQuery = useMemo(() => ({ ...query, q: search }), [query, search]);
  const result = useMemo(() => filterSortPage(rows || [], listQuery), [rows, listQuery]);
  const departments = useMemo(() => departmentOptions(rows || []), [rows]);
  const filtered = hasFilters(listQuery);
  const countRef = useRef(null);

  // The selection, by id: it survives paging and sorting, and clears (with a
  // note) when the filters or the search change.
  const [selected, setSelected] = useState(() => new Set());
  const [selectionFor, setSelectionFor] = useState(() => filterSignature(listQuery));
  const [selectionNote, setSelectionNote] = useState(false);
  const signature = filterSignature(listQuery);
  if (signature !== selectionFor) {
    setSelectionFor(signature);
    if (selected.size) {
      setSelected(new Set());
      setSelectionNote(true);
    }
  }
  const selectedRows = useMemo(() => (rows || []).filter((row) => selected.has(row.id)), [rows, selected]);
  const allSelected = result.total > 0 && result.rows.every((row) => selected.has(row.id));
  const someSelected = !allSelected && result.rows.some((row) => selected.has(row.id));
  const allRef = useRef(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected;
  });
  const select = (ids, on) => {
    setSelectionNote(false);
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const clearSelection = () => {
    setSelected(new Set());
    countRef.current?.focus({ preventScroll: true });
  };

  // Import CSV: the file is read and checked here, then previewed.
  const fileRef = useRef(null);
  const importButton = useRef(null);
  const [importing, setImporting] = useState(null); // { fileName, plan }
  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let plan;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') plan = { error: 'Choose a .csv file (export the products to see the layout).' };
    else if (file.size > MAX_IMPORT_BYTES) plan = { error: 'That file is larger than 2 MB. Import at most 1000 products at a time.' };
    else {
      try {
        plan = importPlan(parseCsv(await file.text()), rows || [], { columns });
      } catch (error) {
        plan = { error: error instanceof CsvError ? `The file can’t be read: ${error.message}` : 'The file can’t be read. Save it as CSV (UTF-8) and try again.' };
      }
    }
    setImporting({ fileName: file.name, plan });
  };
  // Cancel or Close: focus goes back to Import CSV (the count line when the
  // database turned Import off).
  const closeImport = () => {
    setImporting(null);
    (importButton.current?.disabled ? countRef.current : importButton.current)?.focus();
  };

  // Export CSV: the selection, or every row the filters show, in the list's
  // order. Built in the browser; nothing is fetched.
  const exportCsv = () => {
    const chosen = selected.size ? result.rows.filter((row) => selected.has(row.id)) : result.rows;
    const extra = selected.size ? selectedRows.filter((row) => !chosen.includes(row)) : [];
    const list = [...chosen, ...extra];
    const name = csvFileName();
    downloadCsv(name, toCsv(productCsvRecords(list, columns)));
    notify?.(`Exported ${plural(list.length, 'product')} to ${name}`);
  };

  // After a bulk change or an import, the selection goes, and with it the
  // bar or the preview that opened the confirmation. Its ConfirmDialog hands
  // focus to the count line as it closes (returnFocus, NEW-004): focusing it
  // here would do nothing, as the dialog still holds the page inert.
  const afterChange = (patches, message, extra) => {
    setSelected(new Set());
    setImporting(null);
    onApplied?.(patches, message, extra);
  };

  // A page past the end (a bookmark from a longer list) shows the last page,
  // and the address bar says so. A moment later: AdminPage's own address-bar
  // effect runs after this one in the same commit, with the route this
  // render was for.
  useEffect(() => {
    if (!rows || !query.page || query.page === result.page || !onQuery) return undefined;
    const timer = setTimeout(() => onQuery({ ...query, page: result.page }, { force: true }), 0);
    return () => clearTimeout(timer);
  }, [rows, query, result.page, onQuery]);

  // Previous / Next move to the top of the new page: the count line takes
  // focus (the link that was clicked may be gone, on the first or last page).
  const paged = useRef(false);
  useEffect(() => {
    if (!paged.current) return;
    paged.current = false;
    countRef.current?.focus({ preventScroll: true });
    countRef.current?.scrollIntoView?.({ block: 'start' });
  }, [result.page]);

  // Back from the editor: focus returns to the Edit link of the product that
  // was open (or to New product), once the rows are on screen.
  useEffect(() => {
    if (!returnFocusId || !rows) return;
    const target = document.getElementById(returnFocusId) || document.getElementById(NEW_PRODUCT_LINK_ID);
    onReturnFocus?.(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }, [returnFocusId, rows, onReturnFocus]);

  if (!rows) {
    return loadError ? <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} /> : <p className="result-note">Loading…</p>;
  }

  const open = (href) => () => onOpen?.(href);
  // A filter change starts again at page 1.
  const setFilter = (change) => onQuery?.({ ...query, ...change, page: undefined });
  const clearHref = productsHref({ sort: query.sort, dir: query.dir });
  const onPage = () => { paged.current = true; };

  return (
    <div>
      <div className="admin-products-head">
        <label className="filter-search admin-search">Search products
          <input type="search" placeholder="Name, brand, or SKU" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <div className="admin-products-actions">
          <button className="button ghost" type="button" disabled={!result.total && !selected.size} onClick={exportCsv}>
            {selected.size ? `Export ${selected.size} selected` : 'Export CSV'}
          </button>
          <button className="button ghost" type="button" ref={importButton} disabled={missing.import} aria-describedby={missing.import ? 'import-missing' : undefined}
            onClick={() => fileRef.current?.click()}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden aria-label="CSV file to import" onChange={chooseFile} />
          <Link id={NEW_PRODUCT_LINK_ID} className="button" to={editorHref('new')} onClick={open(editorHref('new'))}>New product</Link>
        </div>
      </div>
      {missing.import && <p className="field-hint" id="import-missing">Import needs the October 2026 database update (see BACKEND.md).</p>}
      {importing && (
        <ImportPreview
          plan={importing.plan} fileName={importing.fileName} missing={missing.import} onMissing={() => onMissing?.('import')}
          createMissing={missing.create} onCreateMissing={() => onMissing?.('create')}
          onApplied={afterChange} onCancel={closeImport} returnFocus={countRef}
        />
      )}
      <ProductFilters query={query} onFilter={setFilter} departments={departments} stock={!!columns?.has('stock_status')}
        clearHref={clearHref} filtered={filtered} />
      <p className="result-note admin-count" ref={countRef} tabIndex={-1}>{countText(result, rows.length, filtered)}</p>
      {selectionNote && <p className="result-note">The selection was cleared because the filters changed.</p>}
      {loadError && <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} />}
      {selected.size > 0 && (
        <BulkBar rows={selectedRows} adjustMissing={missing.adjust} onAdjustMissing={() => onMissing?.('adjust')}
          onApplied={afterChange} onClear={clearSelection} returnFocus={countRef} />
      )}
      {rows.length === 0 ? (
        // An empty catalog is not a filter's doing (AW-268); a failed load
        // says so above.
        !loadError && <p className="result-note">No products loaded. Check the catalog connection.</p>
      ) : result.total === 0 ? (
        <div className="empty-results">
          <p>No products match these filters.</p>
          <Link className="text-link" to={clearHref} replace scroll={false}>Clear filters</Link>
        </div>
      ) : (
        <TableScroll label="Products table" resetKey={`${signature}\u0001${result.page}\u0001${query.sort || ''}\u0001${query.dir || ''}`}>
          <table className="aw-table admin-products">
            <thead>
              <tr>
                <th className="select-cell">
                  <label className="row-select" title={`Select all ${result.total} filtered`}>
                    <input ref={allRef} type="checkbox" checked={allSelected} onChange={(e) => select(result.rows.map((row) => row.id), e.target.checked)} />
                    <span className="sr-only">{`Select all ${result.total} filtered`}</span>
                  </label>
                </th>
                {COLUMNS.map((column) => (column.sort
                  ? <SortHeader key={column.label} column={column} query={query} onQuery={onQuery} />
                  : <th key={column.label}>{column.label}</th>))}
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.pageRows.map(p => {
                const inactive = isInactive(p);
                return (
                  <tr key={p.id} className={inactive ? 'inactive' : undefined}>
                    <td className="select-cell">
                      <label className="row-select">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={(e) => select([p.id], e.target.checked)} />
                        <span className="sr-only">{`Select ${p.name}`}</span>
                      </label>
                    </td>
                    <td>{p.id}</td>
                    <td className="product-thumb-cell"><RowPhoto img={p.img} /></td>
                    <td>{p.name}</td>
                    <td className="muted">{p.sku ? <code>{p.sku}</code> : <span>—</span>}</td>
                    <td>{p.brand}</td>
                    <td className="muted">{`${p.cat} / ${p.sub}`}</td>
                    <td>{variantCount(p) || '—'}</td>
                    <td className="price">{p.price != null ? formatMoney(p.price) : 'On request'}</td>
                    <td>
                      {p.tag ? <span>{p.tag}</span> : <span>—</span>}
                      {p.tag && inactive && <span className="muted"> (not shown)</span>}
                    </td>
                    <td>{inactive ? <span className="admin-pill">Inactive</span> : <span>Yes</span>}</td>
                    <td className="muted"><Updated value={p.updated_at} /></td>
                    <td>
                      <div className="inline-actions">
                        <Link id={editLinkId(p.id)} className="button xs ghost" to={editorHref(p.id)} onClick={open(editorHref(p.id))}>
                          <span>Edit</span><span className="sr-only">{` ${p.name}`}</span>
                        </Link>
                        {!inactive && (
                          <Link className="button xs text" to={`/product/${p.id}`}>
                            <span>View on site</span><span className="sr-only">{`: ${p.name}`}</span>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
      {result.pages > 1 && (
        <nav className="admin-pager" aria-label="Product pages">
          {result.page > 1 && (
            <Link className="button xs ghost" to={productsHref({ ...query, page: result.page - 1 })} scroll={false} onClick={onPage}>Previous page</Link>
          )}
          <p className="admin-pager-text">{`Page ${result.page} of ${result.pages}`}</p>
          {result.page < result.pages && (
            <Link className="button xs ghost" to={productsHref({ ...query, page: result.page + 1 })} scroll={false} onClick={onPage}>Next page</Link>
          )}
        </nav>
      )}
    </div>
  );
}
