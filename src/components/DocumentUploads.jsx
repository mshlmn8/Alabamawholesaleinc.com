// Optional license and resale proof. The number fields stay required; these
// files can be added now or emailed later. Controls stay disabled when the
// account backend is not configured.
//
// On the apply page and a pending account's My account (ApplicationDocuments)
// the panel says how many of the two files are on file, and each one on file
// can be opened (AW-099, Cursor PR #13).
//
// Each document is its own small state machine there (AW-095): idle, then
// uploading the file just chosen, then idle with the new record, or failed
// with that file kept for Try again and the record still on file named
// beneath it. The native file input is visually hidden behind a 'Choose
// file' label styled as a button (AW-244); it is never disabled while its
// document uploads, so keyboard focus stays on it (AW-257), and it is
// cleared after every pick, so choosing the same file again uploads again.
// TODO(owner): Which staff email address (or channel) should hear when an applicant uploads license documents? No alert is sent yet. (AW-099)

import { useEffect, useRef, useState } from 'react';
import { COMPANY } from '../data/content.js';
import { useAuth } from '../lib/auth.jsx';
import { announce } from '../lib/announce.js';
import { useOnlineStatus } from '../lib/useOnlineStatus.js';
import { Icon } from './Icon.jsx';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPES,
  checkDocumentFile,
  createDocumentViewUrl,
  documentErrorMessage,
  formatUploadedOn,
  listProfileDocuments,
  prepareDocumentStorage,
  shortFileName,
  uploadProfileDocument,
  validateDocumentFile,
} from '../lib/documents.js';

// '120 KB': a chosen file's size, rounded up, never 0.
const kilobytes = (size) => `${Math.max(1, Math.ceil((Number(size) || 0) / 1024)).toLocaleString('en-US')} KB`;
// 'Uploaded on October 1, 2026 · license.pdf', the name shortened (AW-264).
const uploadedLine = (record) => `${formatUploadedOn(record.uploaded_at)}${record.original_filename ? ` · ${shortFileName(record.original_filename)}` : ''}`;

function DocumentFields({
  idPrefix,
  disabled,
  files,
  errors,
  records,
  loadError = false,
  states,
  showStatus,
  onPick,
  onRetry,
}) {
  const [viewError, setViewError] = useState(null);
  // Each document's file input, to take focus back when the control that
  // had it (Remove, Try again) goes away.
  const inputs = useRef({});
  // The latest pick per input: a slower content check of an earlier file
  // never overrides it.
  const picks = useRef({});
  // The tab opens inside the click (a popup blocker would stop a window opened
  // after the signed address arrives), then goes to the file.
  const openFile = async (doc, record) => {
    setViewError(null);
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await createDocumentViewUrl(record.storage_path);
      if (!url) throw new Error('No address');
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      setViewError(`Couldn’t open your ${doc.label.toLowerCase()}. Try again.`);
    }
  };
  const isBusy = (type) => states?.[type]?.status === 'uploading';
  // The input is cleared after every pick, so choosing the same file again
  // (after a failure) fires change once more (AW-095). A pick while that
  // document uploads is ignored. The name and size are checked at once, then
  // what the file's first bytes say it is (AW-347): a renamed program or web
  // page is refused like a wrong type.
  const onChange = (type) => async (event) => {
    const input = event.target;
    const file = input.files?.[0] || null;
    input.value = '';
    if (!file || isBusy(type)) return;
    const pick = (picks.current[type] || 0) + 1;
    picks.current[type] = pick;
    const problem = validateDocumentFile(file) || await checkDocumentFile(file);
    if (picks.current[type] !== pick) return;
    onPick(type, problem ? null : file, problem);
    if (!problem && !showStatus) announce(`${shortFileName(file.name)} chosen.`);
  };
  // A busy input stays focusable (aria-disabled, AW-257); its click, or its
  // label's, opens no file picker.
  const blockWhileBusy = (type) => (event) => {
    if (isBusy(type)) event.preventDefault();
  };
  const remove = (doc) => {
    onPick(doc.id, null, null);
    inputs.current[doc.id]?.focus();
    announce(`${doc.label} file removed.`);
  };
  const retry = (type) => {
    inputs.current[type]?.focus();
    onRetry?.(type);
  };

  return (
    <fieldset className="doc-uploads" disabled={disabled}>
      {/* The panel's heading names the documents (AW-258). */}
      <legend className={showStatus ? 'sr-only' : undefined}>{showStatus ? 'Upload or replace' : 'Optional documents'}</legend>
      <p className="doc-uploads-note" id={`${idPrefix}-later`}>
        {showStatus
          ? 'Uploading a new file replaces the one on file.'
          : <>Upload your state retail tobacco license and resale certificate now, or send proof later to{' '}
            <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</>}
      </p>
      {DOCUMENT_TYPES.map(doc => {
        const id = `${idPrefix}-${doc.id}`;
        const hintId = `${id}-hint`;
        const errorId = `${id}-error`;
        const statusId = `${id}-status`;
        const keptId = `${id}-kept`;
        const selectedId = `${id}-selected`;
        const error = errors?.[doc.id];
        const record = (records || []).find(row => row.document_type === doc.id);
        const state = states?.[doc.id];
        const busy = state?.status === 'uploading';
        const failed = state?.status === 'failed' ? state.attempt : null;
        const chosen = showStatus ? null : files?.[doc.id];
        const describedBy = [
          hintId,
          showStatus ? statusId : null,
          failed && record ? keptId : null,
          chosen ? selectedId : null,
          error ? errorId : null,
        ].filter(Boolean).join(' ');
        let shown = 'missing';
        let status = 'Not uploaded';
        let title;
        // A list that didn't load says nothing about the file (AW-195).
        if (loadError && !record) {
          shown = 'unknown';
          status = 'Couldn’t check this document right now';
        } else if (records == null) status = 'Checking…';
        else if (busy) {
          status = `Uploading ${shortFileName(state.attempt?.name)}…`;
          title = state.attempt?.name;
        } else if (failed) {
          shown = 'failed';
          status = `Couldn’t upload ${shortFileName(failed.name)}.`;
          title = failed.name;
        } else if (record) {
          shown = 'uploaded';
          status = uploadedLine(record);
          title = record.original_filename || undefined;
        }
        const viewButton = (
          <button type="button" className="text-link doc-view" onClick={() => openFile(doc, record)}>
            <span>View</span> <span className="sr-only">{`your ${doc.label.toLowerCase()}`}</span>
          </button>
        );
        return (
          <div className="doc-upload" key={doc.id}>
            <label htmlFor={id}>
              <span>{doc.label}</span>
              {!showStatus && <span className="optional"> Optional</span>}
            </label>
            <input
              id={id}
              ref={(el) => { inputs.current[doc.id] = el; }}
              className="doc-file sr-only"
              type="file"
              name={doc.id}
              accept={DOCUMENT_ACCEPT}
              aria-disabled={busy ? 'true' : undefined}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={describedBy}
              onChange={onChange(doc.id)}
              onClick={blockWhileBusy(doc.id)}
            />
            {/* The visible control: a second label for the hidden input, so
                a click opens the file picker. */}
            <label htmlFor={id} className="button ghost sm doc-choose">{record || chosen ? 'Replace file' : 'Choose file'}</label>
            <small className="field-hint" id={hintId}>PDF, JPG or PNG. 10 MB maximum. One file; choosing another replaces it.</small>
            {showStatus && (
              <p className={`doc-status${shown === 'missing' ? ' is-missing' : ''}`} id={statusId} data-document-status={shown} aria-live="polite">
                {shown === 'uploaded' && <Icon name="check" />}
                {shown === 'failed' && <Icon name="alert" />}
                <span title={title}>{status}</span>
                {shown === 'uploaded' && viewButton}
                {shown === 'failed' && (
                  <button type="button" className="text-link doc-retry" onClick={() => retry(doc.id)}>
                    <span>Try again</span> <span className="sr-only">{`uploading your ${doc.label.toLowerCase()}`}</span>
                  </button>
                )}
              </p>
            )}
            {/* After a failed upload, the file still on file (AW-095). */}
            {showStatus && failed && record && (
              <p className="doc-status" id={keptId} data-document-status="uploaded">
                <Icon name="check" />
                <span title={record.original_filename || undefined}>{`Still on file: ${uploadedLine(record)}`}</span>
                {viewButton}
              </p>
            )}
            {/* The chosen file, with Remove (AW-244). */}
            {chosen && (
              <p className="doc-status" id={selectedId}>
                <span title={chosen.name}>{`${shortFileName(chosen.name)} · ${kilobytes(chosen.size)}`}</span>
                <button type="button" className="text-link doc-remove" onClick={() => remove(doc)}>
                  <span>Remove</span> <span className="sr-only">{doc.label}</span>
                </button>
              </p>
            )}
            {error && <p className="form-error" id={errorId} role="alert">{error}</p>}
          </div>
        );
      })}
      {viewError && <p className="form-error" role="alert">{viewError}</p>}
    </fieldset>
  );
}

// Signup form: hold the chosen files. The parent uploads after sign-up only
// when that call returns a session.
export function DocumentUploads({ idPrefix = 'aw-doc', disabled = false, files, errors, onPick }) {
  return (
    <DocumentFields
      idPrefix={idPrefix}
      disabled={disabled}
      files={files}
      errors={errors}
      records={[]}
      states={{}}
      showStatus={false}
      onPick={onPick}
    />
  );
}

// Signed-in account: status per document, upload or replace now. Approved
// and suspended accounts can send a renewed license too (AW-254). A pending
// account's panel has no eyebrow: the page already says it is pending
// (AW-258).
const PROOF_EYEBROW = {
  approved: 'KEEP YOUR LICENSE ON FILE',
  suspended: 'SEND UPDATED PROOF',
};

// How many of the license files are on file (AW-099): '' while they load.
export function documentsSummary(records, status = 'pending') {
  if (records == null) return '';
  const received = DOCUMENT_TYPES.filter(doc => records.some(row => row.document_type === doc.id)).length;
  if (received === DOCUMENT_TYPES.length) {
    return status === 'pending'
      ? 'Both documents received. A trade rep will check them with your application.'
      : 'Both documents received.';
  }
  if (received > 0) return `${received} of ${DOCUMENT_TYPES.length} documents received.`;
  return 'No documents yet.';
}

// A document's state in ApplicationDocuments (AW-095): idle, uploading
// `attempt`, or failed with `attempt` kept for Try again and `error` said.
const IDLE = { status: 'idle', attempt: null, error: null };

// `id` goes on the panel, for links to it (/account#documents, AW-085).
export function ApplicationDocuments({ disabled = false, status = 'pending', id }) {
  const { session, loading, isBackendConfigured } = useAuth();
  const [records, setRecords] = useState(null);
  // A failed load leaves records null (AW-195): it never reads as "Not
  // uploaded". loadKey is bumped to load again.
  const [loadError, setLoadError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [docs, setDocs] = useState({});
  const tokens = useRef({});
  const touched = useRef(false);
  const userId = session?.user?.id;
  const controlsDisabled = disabled || !isBackendConfigured || loading || !userId || records == null;

  useEffect(() => {
    if (!isBackendConfigured || !userId) {
      // Unchanged since AW-254; the React Compiler checks this component
      // now that onPick has no try/finally (AW-095).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecords(isBackendConfigured ? null : []);
      return undefined;
    }
    // Uploads and View links need Storage's code, which loads on demand (AW-179).
    prepareDocumentStorage();
    let cancelled = false;
    listProfileDocuments(userId)
      .then(rows => {
        if (cancelled || touched.current) return;
        setLoadError(false);
        setRecords(rows);
      })
      .catch(() => { if (!cancelled && !touched.current) setLoadError(true); });
    return () => { cancelled = true; };
  }, [isBackendConfigured, userId, loadKey]);

  // Try again: 'Checking…' until the list answers.
  const retryLoad = () => {
    setLoadError(false);
    setRecords(null);
    setLoadKey(key => key + 1);
  };
  // Back online after a failed load: try again by itself.
  const online = useOnlineStatus();
  const [wasOnline, setWasOnline] = useState(online);
  if (wasOnline !== online) {
    setWasOnline(online);
    if (online && loadError) retryLoad();
  }

  const setDoc = (type, next) => setDocs(prev => ({ ...prev, [type]: { ...IDLE, ...next } }));

  const upload = async (type, file) => {
    if (!session?.user?.id || !isBackendConfigured) return;
    const token = (tokens.current[type] || 0) + 1;
    tokens.current[type] = token;
    setDoc(type, { status: 'uploading', attempt: file });
    let saved;
    try {
      saved = await uploadProfileDocument(session, type, file);
    } catch (err) {
      if (tokens.current[type] === token) setDoc(type, { status: 'failed', attempt: file, error: documentErrorMessage(err) });
      return;
    }
    if (tokens.current[type] !== token) return;
    setDoc(type, IDLE);
    if (!saved?.attempted) return;
    setRecords(prev => {
      const next = (prev || []).filter(row => row.document_type !== type);
      next.push(saved);
      return next;
    });
    // The list again, so the panel shows what the database holds. The file
    // is uploaded either way: a list that fails (or takes too long) keeps the
    // row just saved, and never calls the upload failed (AW-195).
    try {
      const rows = await listProfileDocuments(session.user.id);
      if (tokens.current[type] !== token) return;
      setRecords(current => {
        const latest = new Map((current || []).map(row => [row.document_type, row]));
        for (const row of rows) {
          const kept = latest.get(row.document_type);
          if (!kept || String(row.uploaded_at) >= String(kept.uploaded_at)) latest.set(row.document_type, row);
        }
        return Array.from(latest.values());
      });
    } catch {
      // Keep the saved row.
    }
  };

  const onPick = (type, file, problem) => {
    touched.current = true;
    if (problem) {
      setDoc(type, { error: problem });
      return;
    }
    if (file) upload(type, file);
  };
  // Try again sends the file that failed, without picking it again.
  const onRetry = (type) => {
    const attempt = docs[type]?.attempt;
    if (attempt) upload(type, attempt);
  };

  const summary = documentsSummary(records, status);
  const errors = Object.fromEntries(Object.entries(docs).map(([type, doc]) => [type, doc.error]));
  const eyebrow = PROOF_EYEBROW[status];

  return (
    <section className="doc-panel" id={id} aria-labelledby="proof-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id="proof-title">License documents</h2>
      {/* Always rendered, so the count is announced when it changes. */}
      <p className="doc-summary" role="status">{summary}</p>
      {loadError && (
        <p className="form-error" role="alert">
          <span>We couldn’t load your document status.</span>{' '}
          <button className="text-link" type="button" onClick={retryLoad}>Try again</button>
        </p>
      )}
      <DocumentFields
        idPrefix="apply-doc"
        disabled={controlsDisabled}
        files={{}}
        errors={errors}
        records={records}
        loadError={loadError}
        states={docs}
        showStatus
        onPick={onPick}
        onRetry={onRetry}
      />
    </section>
  );
}
