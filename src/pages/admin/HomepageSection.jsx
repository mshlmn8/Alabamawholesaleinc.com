// Admin -> Homepage (/admin/homepage, AW-119): what the home page features.
//
// (a) Hero photos: the rows of public.home_slides
//     (supabase/migrations/20261011131000_home_slides.sql) in the home page's
//     order, each with its photo, its description (alt text), the department
//     it links to, the FDA-warning flag and whether it is shown, with Move
//     up / Move down (two rows swap their sort), Edit, Delete and an Add form.
//     A photo is one of the hero photos bundled with the site, an upload to
//     the product-images bucket (home/<time>-<name>.<ext>, the product
//     editor's upload) or a pasted address of one; other sites' addresses are
//     refused and never previewed (the CSP would block them). Every write is
//     checked (checkedWrite) and the home page in this tab reloads its photos
//     (refreshHomeSlides). A database without the table shows the bundled
//     photos read-only with a note that editing needs the update.
// (b) Homepage rails, read-only: what New arrivals and Bestsellers show now
//     (homeRails, the home page's own rule and photo check), each product
//     with its tag, its homepage rank and an Edit link. The tags and ranks
//     are edited in Admin -> Products; the legal-review guard is unchanged.
//     The Edit link opens the product editor with ?back=homepage, so its
//     Cancel and Save come back here, to that link (NEW-076).

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useCatalog } from '../../lib/catalog.jsx';
import { departmentsFor } from '../../lib/departments.js';
import { catLabel } from '../../lib/format.js';
import { refreshHomeSlides, slidePhoto } from '../../lib/homeSlides.js';
import { homeRails } from '../../lib/merchandising.js';
import { adminHref } from '../../lib/adminRoutes.js';
import { Link } from '../../lib/router.js';
import { HERO_SLIDES } from '../../data/content.js';
import { MissingPhoto } from '../../components/MissingPhoto.jsx';
import { Picture } from '../../components/Picture.jsx';
import { Thumb } from '../../components/Thumb.jsx';
import { RAIL_LENGTH, hasPhoto } from '../HomePage.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { LoadProblem } from './AdminStatus.jsx';
import { UPDATE_NOTE, uploadPhoto } from './ProductEditor.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import { NO_ROWS, adminErrorMessage, checkedWrite, isMissingSchema, withStatus } from './adminData.js';
import { photoProblem } from './productForm.js';
import {
  ALT_MAX, BUNDLED_HERO_FILES, SLIDE_COLUMNS, SLIDE_FIELDS, draftFromSlide, emptySlideDraft, homeImagePath, isBundledHero, isSlidePhoto,
  moveSlide, nextSlideSort, orderSlides, slideChanged, slidePatch, slideValues, validateSlide,
} from './homepageSlides.js';

export const SLIDES_MISSING = `Editing the hero photos ${UPDATE_NOTE}. Until then the home page shows the photos bundled with the site:`;
// The rails' Edit links and heading, which the product editor hands focus
// back to (ProductsSection.jsx, NEW-076).
export const railEditId = (productId) => `rail-edit-product-${productId}`;
export const RAILS_HEADING_ID = 'homepage-rails-title';
export const RAILS_NOTE = 'The tags and the homepage rank set in each product’s editor (Products) decide these rails: New arrivals shows active products with a photo tagged NEW, Bestsellers those tagged BESTSELLER, ranked products first (1 before 2), and a product is never in both. Products in the lines under legal review need a homepage rank to appear, unless the home page already showed them.';

// The bundled photos as rows, for the read-only view without the table.
const BUNDLED_ROWS = HERO_SLIDES.map((s, i) => ({
  id: `bundled-${i}`, img: BUNDLED_HERO_FILES[i], alt: s.alt, go_cat: s.goCat, nicotine_warning: !!s.nicotineWarning, sort: (i + 1) * 10, active: true,
}));

// Where the form's fields are, for errors and focus.
const FIELD_IDS = { img: 'slide-bundled', alt: 'slide-alt', goCat: 'slide-dept' };
const CHECKS = { home_slides_img_chk: 'img', home_slides_alt_chk: 'alt', home_slides_go_cat_chk: 'goCat' };

const altOf = (row) => String(row?.alt || '').trim() || 'this photo';
const quoted = (row) => `“${altOf(row)}”`;
const describedBy = (id, hint) => [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ');

// A refused or failed write, in staff wording.
function writeError(error, action) {
  if (error?.code === NO_ROWS) return `${action}: your account isn’t allowed to change it, or it no longer exists.`;
  return adminErrorMessage(error, action);
}

// A row's photo, small: the placeholder when it names nothing the site can
// show (an off-site address is never requested).
function SlideThumb({ img }) {
  const photo = slidePhoto(img);
  return <span className="admin-slide-photo"><Thumb src={photo?.img || photo?.picture?.src || null} /></span>;
}

function SlideFacts({ row }) {
  const parts = [row.go_cat ? `Links to ${catLabel(row.go_cat)}` : 'No link'];
  if (row.nicotine_warning) parts.push('FDA warning');
  return <p className="admin-slide-meta">{parts.join(' · ')}</p>;
}

// onOpenProduct(href): a rail's Edit link was followed (AdminPage keeps it,
// so the editor goes Back here). returnFocusId / onReturnFocus: the control
// to focus on arrival, from the product editor (NEW-076).
export function HomepageTab({ notify, onOpenProduct, returnFocusId = null, onReturnFocus }) {
  const { products, source, status: catalogStatus } = useCatalog();
  const departments = useMemo(() => departmentsFor(products), [products]);
  const deptKeys = departments.map((d) => d.key);

  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [listError, setListError] = useState('');
  const [busy, setBusy] = useState(null); // 'saving' | 'uploading' | 'moving' | 'toggling' | 'deleting'
  // The form: { original (null for a new photo), draft }.
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [brokenSrc, setBrokenSrc] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'delete', row } | { kind: 'discard' }
  // The control to focus once the list has re-rendered (set with the state
  // change that re-renders it).
  const pendingFocus = useRef(null);
  const setFocusId = (target) => { pendingFocus.current = target; };
  const id = useId();
  const formHeading = useRef(null);

  const load = () => supabase.from('home_slides').select(SLIDE_COLUMNS).order('sort', { ascending: true }).order('id', { ascending: true })
    .then((result) => {
      const error = withStatus(result || {});
      if (error && isMissingSchema(error)) {
        setMissing(true);
        setLoadError(null);
        setRows([]);
        return;
      }
      setLoadError(error ? adminErrorMessage(error, 'The hero photos didn’t load') : null);
      if (!error) {
        setMissing(false);
        setRows(result.data || []);
      }
    });
  useEffect(() => { load(); }, []);
  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };
  // After a write: the list again, and the home page's photos in this tab.
  const reload = async () => {
    await load();
    await refreshHomeSlides();
  };

  // A move that reaches the top or the bottom disables the button just used:
  // the other one takes focus. While a write runs every list control is
  // disabled, so the focus waits for it to end (a toggled Shown box, NEW-071).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || busy) return;
    const el = document.getElementById(target);
    if (!el) return;
    pendingFocus.current = null;
    if (!el.disabled) el.focus();
    else document.getElementById(target.replace(/-(up|down)$/, (m) => (m === '-up' ? '-down' : '-up')))?.focus();
  });

  const ordered = orderSlides(rows || []);
  const draft = form?.draft || null;
  const isNew = !!form && !form.original;
  const dirty = !!form && (isNew
    ? Boolean(draft.img.trim() || draft.alt.trim() || draft.goCat || draft.nicotineWarning)
    : slideChanged(draft, form.original));
  useLeaveGuard(dirty, 'Your changes to the hero photo aren’t saved. Leave without saving them?');

  // Back from the product editor: its rail Edit link takes focus, or the
  // rails' heading when the product left the rails (NEW-076).
  useEffect(() => {
    if (!returnFocusId) return;
    const target = document.getElementById(returnFocusId) || document.getElementById(RAILS_HEADING_ID);
    onReturnFocus?.(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }, [returnFocusId, onReturnFocus]);

  // Opening the form moves focus to its heading.
  const formKey = form ? (form.original?.id ?? 'new') : null;
  useEffect(() => {
    if (formKey != null) formHeading.current?.focus();
  }, [formKey]);

  const openForm = (row) => {
    setForm({ original: row ? draftFromSlide(row) : null, draft: row ? draftFromSlide(row) : emptySlideDraft() });
    setErrors({});
    setFormError('');
    setPhotoError('');
    setListError('');
  };
  const closeForm = (returnTo) => {
    setForm(null);
    setErrors({});
    setFormError('');
    setPhotoError('');
    setFocusId(returnTo);
  };
  const returnId = () => (form?.original ? `${id}-slide-${form.original.id}-edit` : `${id}-add`);
  const cancel = () => {
    if (dirty) setConfirm({ kind: 'discard' });
    else closeForm(returnId());
  };
  const set = (field, value) => {
    setForm((f) => ({ ...f, draft: { ...f.draft, [field]: value } }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError('');
  };

  const upload = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const problem = photoProblem(file);
    setPhotoError(problem || '');
    if (problem) {
      input.value = '';
      return;
    }
    setBusy('uploading');
    const { url, error } = await uploadPhoto(supabase, homeImagePath(file), file);
    if (error) setPhotoError(error);
    else set('img', url);
    setBusy(null);
    input.value = '';
  };

  const save = async (event) => {
    event.preventDefault();
    setFormError('');
    const { ok, errors: found } = validateSlide(draft, { departments: deptKeys, original: form.original });
    setErrors(found);
    if (!ok) {
      const first = SLIDE_FIELDS.find((field) => found[field]);
      const target = first === 'img' && !isBundledHero(draft.img) && draft.img.trim() ? 'slide-img' : FIELD_IDS[first];
      document.getElementById(`${id}-${target}`)?.focus();
      return;
    }
    let result;
    if (isNew) {
      result = await write('saving', () => checkedWrite(supabase.from('home_slides').insert({ ...slideValues(draft), sort: nextSlideSort(rows) }), SLIDE_COLUMNS));
    } else {
      const patch = slidePatch(draft, form.original);
      if (!Object.keys(patch).length) {
        setFormError('Nothing has changed.');
        return;
      }
      result = await write('saving', () => checkedWrite(supabase.from('home_slides').update(patch).eq('id', form.original.id)));
    }
    if (result.error) {
      const field = result.error.code === '23514' ? CHECKS[/constraint "([^"]+)"/.exec(String(result.error.message || ''))?.[1]] : null;
      if (field) setErrors({ [field]: field === 'img' ? 'The database refused this photo: use a bundled hero photo or an upload.' : 'The database refused this value.' });
      setFormError(writeError(result.error, isNew ? 'The photo wasn’t added' : 'The photo wasn’t saved'));
      return;
    }
    const addedId = isNew ? result.data?.[0]?.id : form.original.id;
    notify?.(isNew ? `Added ${quoted(draft)} to the hero photos.` : `Saved ${quoted(draft)}.`);
    closeForm(addedId != null ? `${id}-slide-${addedId}-edit` : `${id}-add`);
    await reload();
  };

  // One write at a time: the list's controls wait while it runs.
  async function write(kind, run) {
    setBusy(kind);
    try {
      return await run();
    } finally {
      setBusy(null);
    }
  }

  // The box is disabled with the rest of the list while the write runs,
  // which drops its focus: it gets it back either way (NEW-071).
  const toggle = async (row) => {
    setListError('');
    const next = !row.active;
    const { error } = await write('toggling', () => checkedWrite(supabase.from('home_slides').update({ active: next }).eq('id', row.id)));
    setFocusId(`${id}-slide-${row.id}-shown`);
    if (error) {
      setListError(writeError(error, `${quoted(row)} wasn’t changed`));
      return;
    }
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    notify?.(next ? `${quoted(row)} is shown on the home page.` : `${quoted(row)} is off the home page.`);
    await refreshHomeSlides();
  };

  const move = async (row, delta) => {
    setListError('');
    const updates = moveSlide(rows, row.id, delta);
    if (!updates) return;
    let failure = null;
    await write('moving', async () => {
      for (const { id: rowId, sort } of updates) {
        const { error } = await checkedWrite(supabase.from('home_slides').update({ sort }).eq('id', rowId));
        if (error) {
          failure = error;
          break;
        }
      }
    });
    if (failure) {
      setListError(writeError(failure, `${quoted(row)} wasn’t moved`));
      await load();
      return;
    }
    const place = orderSlides(rows).findIndex((r) => r.id === row.id) + delta + 1;
    setRows((list) => list.map((r) => {
      const update = updates.find((u) => u.id === r.id);
      return update ? { ...r, sort: update.sort } : r;
    }));
    notify?.(`Moved ${quoted(row)} to place ${place} of ${rows.length}.`);
    setFocusId(`${id}-slide-${row.id}-${delta < 0 ? 'up' : 'down'}`);
    await refreshHomeSlides();
  };

  const remove = async () => {
    const { row } = confirm;
    const { error } = await write('deleting', () => checkedWrite(supabase.from('home_slides').delete().eq('id', row.id)));
    setConfirm(null);
    if (error) {
      setListError(writeError(error, `${quoted(row)} wasn’t deleted`));
      return;
    }
    const rest = ordered.filter((r) => r.id !== row.id);
    setRows(rest);
    notify?.(`Deleted ${quoted(row)} from the hero photos.`);
    setFocusId(rest.length ? `${id}-slide-${rest[Math.min(ordered.findIndex((r) => r.id === row.id), rest.length - 1)].id}-edit` : `${id}-add`);
    await refreshHomeSlides();
  };

  const { newArrivals, bestsellers } = homeRails(products, { limit: RAIL_LENGTH, hasPhoto });
  const rails = [
    { key: 'new', title: 'New arrivals', items: newArrivals, empty: 'No active product with a photo is tagged NEW.' },
    { key: 'best', title: 'Bestsellers', items: bestsellers, empty: 'No active product with a photo is tagged BESTSELLER.' },
  ];
  const disabled = !!busy;

  return (
    <div className="homepage-admin">
      <section aria-labelledby={`${id}-slides-title`}>
        <h2 className="bulk-title" id={`${id}-slides-title`}>Hero photos</h2>
        <p className="pricing-note">The photos beside the home page’s headline, in this order. A photo that is off stays here for later; with every photo off, the headline has the hero to itself. Visitors see changes the next time they open the site.</p>
        {rows == null && (loadError
          ? <LoadProblem message={loadError} onRetry={retry} retrying={retrying} />
          : <p className="result-note">Loading…</p>)}
        {missing && (
          <>
            <div className="callout info admin-slides-missing"><p>{SLIDES_MISSING}</p></div>
            <ol className="admin-slides" aria-label="Bundled hero photos">
              {BUNDLED_ROWS.map((row) => (
                <li key={row.id} className="admin-slide">
                  <SlideThumb img={row.img} />
                  <div className="admin-slide-text">
                    <p className="admin-slide-alt">{row.alt}</p>
                    <SlideFacts row={row} />
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        {rows != null && !missing && (
          <>
            {listError && <p className="form-error" role="alert">{listError}</p>}
            {ordered.length === 0
              ? <p className="result-note">No hero photos: the home page shows the headline alone.</p>
              : (
                <ol className="admin-slides" aria-label="Hero photos, in order">
                  {ordered.map((row, i) => {
                    const base = `${id}-slide-${row.id}`;
                    return (
                      <li key={row.id} className={`admin-slide${row.active ? '' : ' inactive'}`}>
                        <SlideThumb img={row.img} />
                        <div className="admin-slide-text">
                          <p className="admin-slide-alt" id={`${base}-alt`}>{altOf(row)}</p>
                          <SlideFacts row={row} />
                          {!row.active && <p className="admin-slide-state"><span className="admin-pill">Off</span></p>}
                        </div>
                        <div className="admin-slide-actions">
                          <label className="admin-toggle">
                            <input type="checkbox" id={`${base}-shown`} checked={row.active !== false} disabled={disabled}
                              onChange={() => toggle(row)} />
                            <span>Shown</span> <span className="sr-only">{altOf(row)}</span>
                          </label>
                          <button className="button xs ghost" type="button" id={`${base}-up`} disabled={disabled || i === 0} onClick={() => move(row, -1)}>
                            <span>Move up</span> <span className="sr-only">{altOf(row)}</span>
                          </button>
                          <button className="button xs ghost" type="button" id={`${base}-down`} disabled={disabled || i === ordered.length - 1} onClick={() => move(row, 1)}>
                            <span>Move down</span> <span className="sr-only">{altOf(row)}</span>
                          </button>
                          <button className="button xs ghost" type="button" id={`${base}-edit`} disabled={disabled || !!form} onClick={() => openForm(row)}>
                            <span>Edit</span> <span className="sr-only">{altOf(row)}</span>
                          </button>
                          <button className="button xs text" type="button" disabled={disabled || !!form} onClick={() => setConfirm({ kind: 'delete', row })}>
                            <span>Delete</span> <span className="sr-only">{altOf(row)}</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            {!form && (
              <div className="inline-actions bulk-actions">
                <button className="button" type="button" id={`${id}-add`} disabled={disabled} onClick={() => openForm(null)}>Add a photo</button>
              </div>
            )}
            {form && (
              <SlideForm
                id={id} headingRef={formHeading} draft={draft} isNew={isNew} departments={departments}
                errors={errors} formError={formError} photoError={photoError} busy={busy} brokenSrc={brokenSrc} onBroken={setBrokenSrc}
                onSet={set} onUpload={upload} onSubmit={save} onCancel={cancel}
              />
            )}
          </>
        )}
      </section>

      <section aria-labelledby={RAILS_HEADING_ID}>
        <h2 className="bulk-title" id={RAILS_HEADING_ID} tabIndex={-1}>Homepage rails</h2>
        <p className="pricing-note">{RAILS_NOTE}</p>
        {source !== 'live' && catalogStatus !== 'static' && (
          <p className="field-hint">Showing the catalog bundled with the site until the live one loads.</p>
        )}
        <div className="admin-rails">
          {rails.map((rail) => (
            <section key={rail.key} className="admin-rail" aria-labelledby={`${id}-rail-${rail.key}`}>
              <h3 id={`${id}-rail-${rail.key}`}>{rail.title}</h3>
              {rail.items.length === 0
                ? <p className="result-note">{rail.empty}</p>
                : (
                  <ol className="admin-rail-list">
                    {rail.items.map((p) => {
                      const editHref = adminHref({ section: 'products', id: p.id, query: { back: 'homepage' } });
                      return (
                        <li key={p.id} className="admin-rail-item">
                          <span className="product-thumb"><Thumb src={p.img} /></span>
                          <div className="admin-slide-text">
                            <p className="admin-slide-alt">{p.name}</p>
                            <p className="admin-slide-meta">{`${p.tag} · ${p.featuredRank != null ? `Homepage rank ${p.featuredRank}` : 'No homepage rank'}`}</p>
                          </div>
                          <Link className="button xs ghost" id={railEditId(p.id)} to={editHref} onClick={() => onOpenProduct?.(editHref)}>
                            <span>Edit</span> <span className="sr-only">{p.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
            </section>
          ))}
        </div>
      </section>

      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${quoted(confirm.row)}?`}
          body="It leaves the home page and this list. An uploaded photo file stays in storage. To keep the photo for later, turn it off instead."
          confirmLabel={busy === 'deleting' ? 'Deleting…' : 'Delete photo'} busy={busy === 'deleting'}
          onConfirm={remove} onCancel={() => { if (busy !== 'deleting') setConfirm(null); }}
        />
      )}
      {confirm?.kind === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          body="Your changes to this hero photo aren’t saved."
          confirmLabel="Discard changes" cancelLabel="Keep editing" historyEntry={false}
          onConfirm={() => { setConfirm(null); closeForm(returnId()); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// The add or edit form: the photo (a bundled one, an upload or an uploaded
// photo's address), its description, its link, the warning and whether it
// is shown.
function SlideForm({
  id, headingRef, draft, isNew, departments, errors, formError, photoError, busy, brokenSrc, onBroken, onSet, onUpload, onSubmit, onCancel,
}) {
  const f = (name) => `${id}-${name}`;
  const err = (field) => errors[field] || '';
  const invalid = (field) => (errors[field] ? true : undefined);
  const img = draft.img.trim();
  const bundled = isBundledHero(img);
  // Only a photo the site can show is previewed: never another site's.
  const photo = isSlidePhoto(img) ? slidePhoto(img) : null;
  const previewSrc = photo?.picture?.src || photo?.img || null;
  const previewBroken = !!previewSrc && previewSrc === brokenSrc;
  const offSite = !!img && !bundled && !isSlidePhoto(img);
  const knownDept = !draft.goCat || departments.some((d) => d.key === draft.goCat);
  const onKey = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onCancel();
  };

  return (
    // Escape cancels, like the product editor; the form's own buttons are the other way out.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form className="form-grid slide-form" noValidate onSubmit={onSubmit} onKeyDown={onKey} aria-labelledby={f('form-title')}>
      <h3 className="full" id={f('form-title')} ref={headingRef} tabIndex={-1}>{isNew ? 'Add a hero photo' : 'Edit hero photo'}</h3>
      <div className="full product-photo">
        <div className="product-photo-body">
          <div className="product-photo-preview">
            {previewSrc && !previewBroken
              ? <Picture picture={photo.picture} sizes="10rem" fallback={<MissingPhoto compact />} onFail={() => onBroken(previewSrc)} />
              : <MissingPhoto compact />}
          </div>
          <div className="product-photo-fields">
            <label htmlFor={f('slide-bundled')}>Bundled photo</label>
            <select id={f('slide-bundled')} value={bundled ? img : ''} disabled={!!busy}
              aria-invalid={invalid('img')} aria-describedby={`${f('slide-bundled')}-hint ${f('slide-img')}-error`}
              onChange={(e) => onSet('img', e.target.value)}>
              <option value="">None: upload or paste below</option>
              {BUNDLED_HERO_FILES.map((file) => <option key={file} value={file}>{file}</option>)}
              {bundled && !BUNDLED_HERO_FILES.includes(img) && <option value={img}>{img}</option>}
            </select>
            <small className="field-hint" id={`${f('slide-bundled')}-hint`}>The hero photos that come with the site.</small>
            <label htmlFor={f('slide-photo-file')}>Or upload a photo</label>
            <input id={f('slide-photo-file')} className="doc-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy}
              aria-describedby={`${f('slide-photo-file')}-hint ${f('slide-photo-file')}-error`} onChange={onUpload} />
            <small className="field-hint" id={`${f('slide-photo-file')}-hint`}>{busy === 'uploading' ? 'Uploading…' : 'JPEG, PNG or WebP, up to 5 MB. A wide photo suits the hero best.'}</small>
            <p className="form-error" id={`${f('slide-photo-file')}-error`} aria-live="polite">{photoError}</p>
            <label htmlFor={f('slide-img')}>Or the address of an uploaded photo</label>
            <input id={f('slide-img')} value={bundled ? '' : draft.img} maxLength={1000} autoComplete="off" spellCheck={false}
              aria-invalid={bundled ? undefined : invalid('img')} aria-describedby={describedBy(f('slide-img'), true)}
              onChange={(e) => onSet('img', e.target.value)} />
            <small className="field-hint" id={`${f('slide-img')}-hint`}>{offSite
              ? 'Photos on other sites are blocked by the site’s security settings. Upload the photo instead.'
              : previewBroken
                ? 'The photo at that address didn’t load. Check it, or upload the photo again.'
                : 'An upload fills this in.'}</small>
            <p className="form-error" id={`${f('slide-img')}-error`}>{err('img')}</p>
          </div>
        </div>
      </div>
      <div className="full">
        <label htmlFor={f('slide-alt')}>Description of the photo</label>
        <input id={f('slide-alt')} value={draft.alt} maxLength={ALT_MAX * 2} autoComplete="off" required
          aria-invalid={invalid('alt')} aria-describedby={describedBy(f('slide-alt'), true)} onChange={(e) => onSet('alt', e.target.value)} />
        <small className="field-hint" id={`${f('slide-alt')}-hint`}>{`What the photo shows, for people who can’t see it, e.g. “BIC lighters in a counter display tray”. Up to ${ALT_MAX} characters.`}</small>
        <p className="form-error" id={`${f('slide-alt')}-error`}>{err('alt')}</p>
      </div>
      <div>
        <label htmlFor={f('slide-dept')}>Links to</label>
        <select id={f('slide-dept')} value={draft.goCat} aria-invalid={invalid('goCat')} aria-describedby={`${f('slide-dept')}-error`}
          onChange={(e) => onSet('goCat', e.target.value)}>
          <option value="">No link</option>
          {departments.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          {!knownDept && <option value={draft.goCat}>{`${draft.goCat} (not in the catalog)`}</option>}
        </select>
        <p className="form-error" id={`${f('slide-dept')}-error`}>{err('goCat')}</p>
      </div>
      <div className="full consent">
        <input id={f('slide-nicotine')} type="checkbox" checked={draft.nicotineWarning} onChange={(e) => onSet('nicotineWarning', e.target.checked)} />
        <label htmlFor={f('slide-nicotine')}>Shows a nicotine product (adds the FDA warning)</label>
      </div>
      <div className="full consent">
        <input id={f('slide-active')} type="checkbox" checked={draft.active} onChange={(e) => onSet('active', e.target.checked)} />
        <label htmlFor={f('slide-active')}>Shown on the home page</label>
      </div>
      <div className="full dialog-actions">
        <button className="button" type="submit" disabled={!!busy}>{busy === 'saving' ? 'Saving…' : (isNew ? 'Add photo' : 'Save photo')}</button>
        <button className="button ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="full form-error" role="alert">{formError}</p>
    </form>
  );
}
