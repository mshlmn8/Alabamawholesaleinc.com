// Optional license and resale proof. The number fields stay required; these
// files can be added now or emailed later. Controls stay disabled when the
// account backend is not configured.
//
// On the apply page (ApplicationDocuments) the panel says how many of the two
// files are on file, and each one on file can be opened (AW-099, Cursor PR
// #13).
// TODO(owner): Which staff email address (or channel) should hear when an applicant uploads license documents? No alert is sent yet. (AW-099)

import { useEffect, useRef, useState } from 'react';
import { COMPANY } from '../data/content.js';
import { useAuth } from '../lib/auth.jsx';
import { Icon } from './Icon.jsx';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPES,
  createDocumentViewUrl,
  documentErrorMessage,
  formatUploadedOn,
  listProfileDocuments,
  uploadProfileDocument,
  validateDocumentFile,
} from '../lib/documents.js';

function DocumentFields({
  idPrefix,
  disabled,
  files,
  errors,
  records,
  busy,
  showStatus,
  onPick,
}) {
  const [viewError, setViewError] = useState(null);
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
  const onChange = (type) => (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      onPick(type, null, null);
      return;
    }
    const problem = validateDocumentFile(file);
    if (problem) event.target.value = '';
    onPick(type, problem ? null : file, problem);
  };

  return (
    <fieldset className="doc-uploads" disabled={disabled}>
      <legend>{showStatus ? 'Upload or replace' : 'Optional documents'}</legend>
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
        const error = errors?.[doc.id];
        const record = (records || []).find(row => row.document_type === doc.id);
        const describedBy = [hintId, showStatus ? statusId : null, error ? errorId : null].filter(Boolean).join(' ');
        const isBusy = !!busy?.[doc.id];
        let status = 'Not uploaded';
        if (records == null) status = 'Checking…';
        else if (isBusy) status = 'Uploading…';
        else if (record) status = `${formatUploadedOn(record.uploaded_at)}${record.original_filename ? ` · ${record.original_filename}` : ''}`;
        return (
          <div className="doc-upload" key={doc.id}>
            <label htmlFor={id}>
              <span>{doc.label}</span>
              {!showStatus && <span className="optional"> Optional</span>}
            </label>
            <input
              id={id}
              className="doc-file"
              type="file"
              name={doc.id}
              accept={DOCUMENT_ACCEPT}
              disabled={disabled || isBusy}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={describedBy}
              onChange={onChange(doc.id)}
            />
            <small className="field-hint" id={hintId}>PDF, JPG, PNG, or HEIC. 10 MB maximum. One file; choosing another replaces it.</small>
            {showStatus && (
              <p className={`doc-status${record ? '' : ' is-missing'}`} id={statusId} data-document-status={record ? 'uploaded' : 'missing'} aria-live="polite">
                {record && <Icon name="check" />}
                <span>{status}</span>
                {record && !isBusy && (
                  <button type="button" className="text-link doc-view" onClick={() => openFile(doc, record)}>
                    <span>View</span> <span className="sr-only">{`your ${doc.label.toLowerCase()}`}</span>
                  </button>
                )}
              </p>
            )}
            {files?.[doc.id] && !showStatus && (
              <p className="doc-status" aria-live="polite">{`Selected: ${files[doc.id].name}`}</p>
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
      busy={{}}
      showStatus={false}
      onPick={onPick}
    />
  );
}

// Signed-in account: status per document, upload or replace now. Approved
// and suspended accounts can send a renewed license too (AW-254).
const PROOF_EYEBROW = {
  pending: 'WHILE YOUR APPLICATION IS PENDING',
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

export function ApplicationDocuments({ disabled = false, status = 'pending' }) {
  const { session, loading, isBackendConfigured } = useAuth();
  const [records, setRecords] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState({});
  const tokens = useRef({});
  const touched = useRef(false);
  const userId = session?.user?.id;
  const controlsDisabled = disabled || !isBackendConfigured || loading || !userId || records == null;

  useEffect(() => {
    if (!isBackendConfigured || !userId) {
      setRecords(isBackendConfigured ? null : []);
      return undefined;
    }
    let cancelled = false;
    listProfileDocuments(userId)
      .then(rows => {
        if (cancelled || touched.current) return;
        setRecords(rows);
      })
      .catch(() => { if (!cancelled && !touched.current) setRecords([]); });
    return () => { cancelled = true; };
  }, [isBackendConfigured, userId]);

  const onPick = async (type, file, problem) => {
    touched.current = true;
    setErrors(prev => ({ ...prev, [type]: problem }));
    if (problem || !file) return;
    if (!session?.user?.id || !isBackendConfigured) return;
    const token = (tokens.current[type] || 0) + 1;
    tokens.current[type] = token;
    setBusy(current => ({ ...current, [type]: true }));
    try {
      const saved = await uploadProfileDocument(session, type, file);
      if (tokens.current[type] !== token) return;
      if (!saved?.attempted) return;
      setRecords(prev => {
        const next = (prev || []).filter(row => row.document_type !== type);
        next.push(saved);
        return next;
      });
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
    } catch (err) {
      if (tokens.current[type] !== token) return;
      setErrors(prev => ({ ...prev, [type]: documentErrorMessage(err) }));
    } finally {
      if (tokens.current[type] === token) setBusy(current => ({ ...current, [type]: false }));
    }
  };

  const summary = documentsSummary(records, status);

  return (
    <section className="doc-panel" aria-labelledby="proof-title">
      <p className="eyebrow">{PROOF_EYEBROW[status] || PROOF_EYEBROW.pending}</p>
      <h2 id="proof-title">License documents</h2>
      {/* Always rendered, so the count is announced when it changes. */}
      <p className="doc-summary" role="status">{summary}</p>
      <DocumentFields
        idPrefix="apply-doc"
        disabled={controlsDisabled}
        files={{}}
        errors={errors}
        records={records}
        busy={busy}
        showStatus
        onPick={onPick}
      />
    </section>
  );
}
