// Admin -> Site settings (/admin/settings, AW-030; owner answer 2026-10):
// the announcement bar's messages, the public phone and email, the opening
// hours and the warehouse address, which every page prints. Approved admin
// and staff accounts change them here instead of in the code; they are kept
// in public.site_settings (20261014121000_site_settings.sql) and the site
// reads them through src/lib/siteSettings.js.
//
// One form, saved together. Each group can go back to the site's own values
// (those in src/data/content.js), which are then stored as null, so they
// keep following the code. The checks are siteSettingsForm.js's, the same as
// the table's. Unsaved changes ask before the page is left (useLeaveGuard).
// A database without the table says it needs the update and shows the site's
// own values without a Save.

import { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SETTINGS_LIMITS } from '../../data/siteFacts.js';
import { showSiteSettings } from '../../lib/siteSettings.js';
import { LoadProblem } from './AdminStatus.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import { NO_ROWS, adminErrorMessage, checkedWrite, isMissingSchema, withStatus } from './adminData.js';
import { adminDateTime } from './dates.js';
import {
  DEFAULT_DRAFT, SITE_SETTINGS_SELECT, draftChanged, draftFromRow, isOwn, messagesPhone, rowFromDraft, shownAnnouncements, withOwn,
} from './siteSettingsForm.js';

export const SETTINGS_MISSING = 'Site settings need the October 2026 database update (see BACKEND.md). Until then the site shows the details below, which are built into it.';
export const SETTINGS_SAVED = 'Saved the site settings. Pages opened from now on show them.';
// The fields in the order the form shows them, for the first error's focus.
const ORDER = (draft) => [
  'announcements', ...shownAnnouncements(draft).map((_, i) => `announcement:${i}`), 'phone', 'email',
  'hours', ...draft.hours.flatMap((_, i) => [`days:${i}`, `time:${i}`]), 'street', 'city', 'state', 'zip',
];

// A refused save, in staff wording.
export function settingsSaveError(error) {
  if (error?.code === NO_ROWS) return 'The settings weren’t saved: your account isn’t allowed to change them.';
  if (String(error?.code) === '23514') return 'The settings weren’t saved: the database refused a value. Check them and try again.';
  return adminErrorMessage(error, 'The settings weren’t saved');
}

// Saves `row` into the one row (id = true), and reads it back. A table that
// lost its row gets it again.
export async function saveSettings(client, row) {
  const updated = await checkedWrite(client.from('site_settings').update(row).eq('id', true), SITE_SETTINGS_SELECT);
  if (updated.error?.code !== NO_ROWS) return { data: updated.data?.[0] ?? null, error: updated.error };
  const inserted = await client.from('site_settings').insert({ id: true, ...row }).select(SITE_SETTINGS_SELECT);
  const error = withStatus(inserted || {});
  return { data: error ? null : (Array.isArray(inserted.data) ? inserted.data[0] : inserted.data) ?? null, error };
}

// "Use the site's own …": puts a group back as content.js has it.
function OwnButton({ shown, disabled, onClick, label }) {
  return shown ? <button className="button xs text" type="button" disabled={disabled} onClick={onClick}>{label}</button> : null;
}

// A field's error line, always there for aria-describedby (empty without one).
function FieldError({ id, message }) {
  return <p className="form-error" id={id}>{message || ''}</p>;
}

export function SiteSettingsTab({ notify }) {
  const id = useId();
  const f = (name) => `${id}-${name}`;
  // { status: 'loading' | 'ready' | 'missing' | 'error', row, error }
  const [load, setLoad] = useState({ status: 'loading', row: null, error: null });
  const [retrying, setRetrying] = useState(false);
  const [saved, setSaved] = useState(DEFAULT_DRAFT);
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const focusAfter = useRef(null);

  const read = () => supabase.from('site_settings').select(SITE_SETTINGS_SELECT).eq('id', true).maybeSingle().then((result) => {
    const error = withStatus(result || {});
    if (error) {
      setLoad({ status: isMissingSchema(error) ? 'missing' : 'error', row: null, error: adminErrorMessage(error, 'The site settings didn’t load') });
      return;
    }
    const row = result.data ?? null;
    const next = draftFromRow(row);
    setLoad({ status: 'ready', row, error: null });
    setSaved(next);
    setDraft(next);
    setErrors({});
  }, (error) => setLoad({ status: 'error', row: null, error: adminErrorMessage(error, 'The site settings didn’t load') }));
  useEffect(() => { read(); }, []);
  const retry = async () => {
    setRetrying(true);
    await read();
    setRetrying(false);
  };

  const dirty = load.status === 'ready' && draftChanged(draft, saved);
  useLeaveGuard(dirty, 'Your changes to the site settings aren’t saved. Leave without saving them?');

  // A focus asked for by an add or remove, once the field is on screen.
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const clearError = (...keys) => setErrors((all) => {
    const next = { ...all };
    for (const key of keys) delete next[key];
    return next;
  });
  const set = (key) => (event) => {
    const value = event.target.value;
    setDraft((d) => ({ ...d, [key]: value }));
    clearError(key);
  };
  // Messages: editing one of the site's own makes them staff's.
  const messages = shownAnnouncements(draft, saved.phone);
  const setMessages = (next) => setDraft((d) => ({ ...d, announcements: next, ownAnnouncements: false }));
  const editMessage = (i) => (event) => {
    const next = [...messages];
    next[i] = event.target.value;
    setMessages(next);
    clearError(`announcement:${i}`, 'announcements');
  };
  const addMessage = () => {
    setMessages([...messages, '']);
    focusAfter.current = f(`announcement-${messages.length}`);
  };
  const removeMessage = (i) => {
    setMessages(messages.filter((_, j) => j !== i));
    setErrors({});
    focusAfter.current = messages.length > 1 ? f(`announcement-${Math.min(i, messages.length - 2)}`) : f('add-message');
  };
  const moveMessage = (i, by) => {
    const next = [...messages];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setMessages(next);
    focusAfter.current = f(`announcement-${i + by}-${by < 0 ? 'up' : 'down'}`);
  };
  // Hours rows.
  const editHours = (i, key) => (event) => {
    const value = event.target.value;
    setDraft((d) => ({ ...d, hours: d.hours.map((h, j) => (j === i ? { ...h, [key]: value } : h)) }));
    clearError(`${key}:${i}`, 'hours');
  };
  const addHours = () => {
    setDraft((d) => ({ ...d, hours: [...d.hours, { days: '', time: '' }] }));
    focusAfter.current = f(`days-${draft.hours.length}`);
  };
  const removeHours = (i) => {
    setDraft((d) => ({ ...d, hours: d.hours.filter((_, j) => j !== i) }));
    setErrors({});
    focusAfter.current = draft.hours.length > 1 ? f(`days-${Math.min(i, draft.hours.length - 2)}`) : f('add-hours');
  };
  const restoreOwn = (group) => {
    setDraft((d) => withOwn(d, group));
    setErrors({});
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy || load.status !== 'ready') return;
    setSaveError('');
    const checked = rowFromDraft(draft);
    setErrors(checked.errors);
    if (!checked.ok) {
      const first = ORDER(draft).find((key) => checked.errors[key]);
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    setBusy(true);
    const { data, error } = await saveSettings(supabase, checked.row);
    setBusy(false);
    if (error) {
      setSaveError(settingsSaveError(error));
      return;
    }
    const row = data ?? checked.row;
    const next = draftFromRow(row);
    setLoad({ status: 'ready', row, error: null });
    setSaved(next);
    setDraft(next);
    // This tab's storefront shows them at once.
    showSiteSettings(row);
    notify?.(SETTINGS_SAVED);
  };
  const discard = () => {
    setDraft(saved);
    setErrors({});
    setSaveError('');
  };

  // Where each error's field is.
  function fieldId(key) {
    if (!key) return null;
    const [kind, i] = key.split(':');
    if (kind === 'announcement') return f(`announcement-${i}`);
    if (kind === 'days' || kind === 'time') return f(`${kind}-${i}`);
    if (kind === 'announcements') return f('add-message');
    if (kind === 'hours') return f('add-hours');
    return f(kind);
  }
  const invalid = (key) => (errors[key] ? true : undefined);
  const describedBy = (key, hint = false) => [hint ? `${fieldId(key)}-hint` : null, `${fieldId(key)}-error`].filter(Boolean).join(' ');

  const readOnly = load.status !== 'ready' || busy;
  const ownProps = (group) => ({ shown: !isOwn(draft, group) && load.status === 'ready', disabled: busy, onClick: () => restoreOwn(group) });

  if (load.status === 'loading') return <p className="result-note">Loading…</p>;
  if (load.status === 'error') return <LoadProblem message={load.error} onRetry={retry} retrying={retrying} />;

  return (
    <div className="site-settings">
      <h2 className="bulk-title">Site settings</h2>
      <p className="pricing-note">
        What every page tells buyers: the bar at the top of the site, the footer, Contact &amp; visit, Help, checkout and receipts.
        Google’s listing and the short page shown while the site loads keep the details built into the site; ask your developer to update those after a change of phone, email, hours or address.
      </p>
      {load.status === 'missing' && <div className="callout info admin-slides-missing"><p>{SETTINGS_MISSING}</p></div>}
      {/* Only a save from Admin names who saved (the row the migration adds has no one). */}
      {load.row?.updated_at && load.row?.updated_by && <p className="result-note">{`Last saved ${adminDateTime(load.row.updated_at)}.`}</p>}

      <form className="site-settings-form" noValidate onSubmit={save} aria-label="Site settings">
        <fieldset className="site-settings-group" disabled={readOnly}>
          <legend>Announcement bar</legend>
          <p className="field-hint" id={f('messages-hint')}>
            {`One message at a time, after “Wholesale to licensed retail businesses only”, which always shows first. Up to ${SETTINGS_LIMITS.announcements} messages of ${SETTINGS_LIMITS.announcement} characters.${draft.ownAnnouncements ? ' These are the site’s own messages; the last one names the phone below.' : ''}`}
          </p>
          <ol className="site-settings-list">
            {messages.map((message, i) => (
              <li key={i} className="site-settings-row">
                <div className="form-grid site-settings-fields">
                  <div className="full">
                    <label htmlFor={f(`announcement-${i}`)}>{`Message ${i + 1}`}</label>
                    <input id={f(`announcement-${i}`)} value={message} maxLength={SETTINGS_LIMITS.announcement * 2} autoComplete="off"
                      aria-invalid={invalid(`announcement:${i}`)} aria-describedby={describedBy(`announcement:${i}`)} onChange={editMessage(i)} />
                    <FieldError id={`${fieldId(`announcement:${i}`)}-error`} message={errors[`announcement:${i}`]} />
                  </div>
                </div>
                <div className="inline-actions site-settings-row-actions">
                  <button className="button xs ghost" type="button" id={f(`announcement-${i}-up`)} disabled={i === 0} onClick={() => moveMessage(i, -1)}>
                    <span>Move up</span> <span className="sr-only">{`message ${i + 1}`}</span>
                  </button>
                  <button className="button xs ghost" type="button" id={f(`announcement-${i}-down`)} disabled={i === messages.length - 1} onClick={() => moveMessage(i, 1)}>
                    <span>Move down</span> <span className="sr-only">{`message ${i + 1}`}</span>
                  </button>
                  <button className="button xs text" type="button" disabled={messages.length <= 1} onClick={() => removeMessage(i)}>
                    <span>Remove</span> <span className="sr-only">{`message ${i + 1}`}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="inline-actions">
            <button className="button xs ghost" type="button" id={f('add-message')} disabled={messages.length >= SETTINGS_LIMITS.announcements}
              aria-describedby={`${f('add-message')}-error`} onClick={addMessage}>Add a message</button>
            <OwnButton {...ownProps('announcements')} label="Use the site’s own messages" />
          </div>
          <FieldError id={`${fieldId('announcements')}-error`} message={errors['announcements']} />
        </fieldset>

        <fieldset className="site-settings-group" disabled={readOnly}>
          <legend>Phone and email</legend>
          <div className="form-grid site-settings-fields">
            <div>
              <label htmlFor={f('phone')}>Public phone</label>
              <input id={f('phone')} type="tel" inputMode="tel" autoComplete="off" value={draft.phone} maxLength={24}
                aria-invalid={invalid('phone')} aria-describedby={describedBy('phone', true)} onChange={set('phone')} />
              <small className="field-hint" id={`${fieldId('phone')}-hint`}>Every Call link and the trade bar. Saved as (205) 555-0123.</small>
              <FieldError id={`${fieldId('phone')}-error`} message={errors['phone']} />
            </div>
            <div>
              <label htmlFor={f('email')}>Public email</label>
              <input id={f('email')} type="email" autoComplete="off" spellCheck={false} value={draft.email} maxLength={SETTINGS_LIMITS.email}
                aria-invalid={invalid('email')} aria-describedby={describedBy('email', true)} onChange={set('email')} />
              <small className="field-hint" id={`${fieldId('email')}-hint`}>Every Email link. Orders still go to the orders inbox.</small>
              <FieldError id={`${fieldId('email')}-error`} message={errors['email']} />
            </div>
          </div>
          <div className="inline-actions"><OwnButton {...ownProps('contact')} label="Use the site’s own phone and email" /></div>
        </fieldset>

        <fieldset className="site-settings-group" disabled={readOnly}>
          <legend>Opening hours</legend>
          <p className="field-hint" id={f('hours-hint')}>
            {`As buyers should read them, one row per run of days, up to ${SETTINGS_LIMITS.hours} rows. While they differ from the site’s own, Contact & visit doesn’t show “Open now”.`}
          </p>
          <ol className="site-settings-list">
            {draft.hours.map((row, i) => (
              <li key={i} className="site-settings-row">
                <div className="form-grid site-settings-fields">
                  <div>
                    <label htmlFor={f(`days-${i}`)}>{`Days, row ${i + 1}`}</label>
                    <input id={f(`days-${i}`)} value={row.days} maxLength={SETTINGS_LIMITS.days * 2} autoComplete="off"
                      aria-invalid={invalid(`days:${i}`)} aria-describedby={describedBy(`days:${i}`)} onChange={editHours(i, 'days')} />
                    <FieldError id={`${fieldId(`days:${i}`)}-error`} message={errors[`days:${i}`]} />
                  </div>
                  <div>
                    <label htmlFor={f(`time-${i}`)}>{`Hours, row ${i + 1}`}</label>
                    <input id={f(`time-${i}`)} value={row.time} maxLength={SETTINGS_LIMITS.time * 2} autoComplete="off"
                      aria-invalid={invalid(`time:${i}`)} aria-describedby={describedBy(`time:${i}`)} onChange={editHours(i, 'time')} />
                    <FieldError id={`${fieldId(`time:${i}`)}-error`} message={errors[`time:${i}`]} />
                  </div>
                </div>
                <div className="inline-actions site-settings-row-actions">
                  <button className="button xs text" type="button" disabled={draft.hours.length <= 1} onClick={() => removeHours(i)}>
                    <span>Remove</span> <span className="sr-only">{`hours row ${i + 1}`}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="inline-actions">
            <button className="button xs ghost" type="button" id={f('add-hours')} disabled={draft.hours.length >= SETTINGS_LIMITS.hours}
              aria-describedby={`${f('add-hours')}-error`} onClick={addHours}>Add a row</button>
            <OwnButton {...ownProps('hours')} label="Use the site’s own hours" />
          </div>
          <FieldError id={`${fieldId('hours')}-error`} message={errors['hours']} />
        </fieldset>

        <fieldset className="site-settings-group" disabled={readOnly}>
          <legend>Warehouse address</legend>
          <p className="field-hint">Where buyers pick up will-call orders, as Contact &amp; visit, the footer and receipts print it.</p>
          <div className="form-grid site-settings-fields">
            <div className="full">
              <label htmlFor={f('street')}>Street</label>
              <input id={f('street')} value={draft.street} maxLength={SETTINGS_LIMITS.street * 2} autoComplete="off"
                aria-invalid={invalid('street')} aria-describedby={describedBy('street')} onChange={set('street')} />
              <FieldError id={`${fieldId('street')}-error`} message={errors['street']} />
            </div>
            <div>
              <label htmlFor={f('city')}>City</label>
              <input id={f('city')} value={draft.city} maxLength={SETTINGS_LIMITS.city * 2} autoComplete="off"
                aria-invalid={invalid('city')} aria-describedby={describedBy('city')} onChange={set('city')} />
              <FieldError id={`${fieldId('city')}-error`} message={errors['city']} />
            </div>
            <div className="site-settings-state">
              <label htmlFor={f('state')}>State</label>
              <input id={f('state')} value={draft.state} maxLength={2} autoComplete="off" autoCapitalize="characters"
                aria-invalid={invalid('state')} aria-describedby={describedBy('state')} onChange={set('state')} />
              <FieldError id={`${fieldId('state')}-error`} message={errors['state']} />
            </div>
            <div>
              <label htmlFor={f('zip')}>ZIP code</label>
              <input id={f('zip')} value={draft.zip} maxLength={10} inputMode="numeric" autoComplete="off"
                aria-invalid={invalid('zip')} aria-describedby={describedBy('zip')} onChange={set('zip')} />
              <FieldError id={`${fieldId('zip')}-error`} message={errors['zip']} />
            </div>
          </div>
          <div className="inline-actions"><OwnButton {...ownProps('address')} label="Use the site’s own address" /></div>
        </fieldset>

        {load.status === 'ready' && (
          <div className="dialog-actions site-settings-actions">
            <button className="button" type="submit" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save site settings'}</button>
            {dirty && !busy && <button className="button ghost" type="button" onClick={discard}>Discard changes</button>}
          </div>
        )}
        <p className="form-error" role="alert">{saveError}</p>
      </form>
      {load.status === 'ready' && messagesPhone(draft, saved.phone) !== saved.phone && draft.ownAnnouncements && (
        <p className="result-note">The bar’s volume-pricing message will name the new phone.</p>
      )}
    </div>
  );
}
