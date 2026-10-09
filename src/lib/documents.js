// Optional trade-application proof: state retail tobacco license and resale
// certificate. Numbers stay required on the profile; these files are not.
// Uploads run only when a session exists. The storage path is
// {user id}/{document type}/{time}-{file}: every upload is a new object, and
// the replaced one stays in the bucket, so profile_document_history
// (20261008193000) still points at a file when a license is renewed (AW-197,
// AW-254). Since 20261009140000 the storage and profile_documents policies
// require exactly that layout and accept at most 10 uploads per account in
// 24 hours (AW-207).

import { supabase } from './supabase.js';
import { isNetworkError, unavailableMessage } from './errors.js';

export const DOCUMENT_BUCKET = 'application-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif';

export const DOCUMENT_TYPES = [
  { id: 'tobacco_license', label: 'State retail tobacco license' },
  { id: 'resale_certificate', label: 'Resale certificate' },
];

const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const MIME_FOR_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

// What an applicant sees when the database refuses a document upload: with
// the client's own path, that is the upload limit (AW-207).
export const DOCUMENTS_REFUSED_MESSAGE = 'We couldn’t accept that file (at most 10 uploads a day). Email it to the trade desk instead.';

// A refusal by row-level security: 42501 from PostgREST, or a 403 / RLS
// message from Storage.
export function isDocumentPermissionError(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  const status = String(err.statusCode ?? err.status ?? '');
  return code === '42501' || status === '403' || /row-level security/i.test(String(err.message || ''));
}

// A file name as the page shows it (AW-264): up to `max` characters whole,
// a longer one as its first 26 and last 10 (which keep the extension) around
// an ellipsis. The full name goes in a title attribute beside it. Counted in
// code points, so an emoji is never cut in half.
export function shortFileName(name, max = 40) {
  const chars = Array.from(String(name ?? ''));
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, 26).join('')}…${chars.slice(-10).join('')}`;
}

// What a picked file that can't be sent says, here and from Storage. A file
// checked here is named (AW-244); Storage's refusals don't say which file.
export const FILE_MISSING_MESSAGE = 'Choose a PDF, JPG, PNG, or HEIC file.';
export const FILE_TYPE_MESSAGE = 'Use a PDF, JPG, PNG, or HEIC file.';
export const FILE_TOO_LARGE_MESSAGE = 'That file is over the 10 MB limit.';
export const DOCUMENT_UPLOAD_FAILED_MESSAGE = 'That file did not upload. You can try again, or send proof later.';
const fileLabel = (name) => shortFileName(name) || 'That file';
export const fileTypeMessage = (name) => `${fileLabel(name)} isn’t a PDF, JPG, PNG or HEIC file.`;
export const fileTooLargeMessage = (name) => `${fileLabel(name)} is over the 10 MB limit.`;

// Storage answers a too-large or wrong-type file with its own status code
// (often inside an HTTP 400) and English text.
const storageStatus = (err) => [err?.statusCode, err?.status].map((v) => String(v ?? ''));

// The sentence for a failed upload (AW-084). Never the error's own text:
// Storage's and the database's messages ('new row violates row-level security
// policy', 'mime type image/heic-sequence is not supported') mean nothing to
// an applicant.
export function documentErrorMessage(err) {
  if (isDocumentPermissionError(err)) return DOCUMENTS_REFUSED_MESSAGE;
  // This file's own check (uploadProfileDocument), before anything is sent:
  // only its own sentences, for the file it checked.
  if (err?.code === 'invalid_file') {
    const own = [FILE_MISSING_MESSAGE, fileTypeMessage(err.fileName), fileTooLargeMessage(err.fileName)];
    return own.find((text) => text === err.message) || FILE_TYPE_MESSAGE;
  }
  const message = String(err?.message || '');
  const status = storageStatus(err);
  if (status.includes('413') || /exceeded the maximum allowed size|payload too large/i.test(message)) return FILE_TOO_LARGE_MESSAGE;
  if (status.includes('415') || err?.code === 'invalid_mime_type' || /mime type/i.test(message)) return FILE_TYPE_MESSAGE;
  if (isNetworkError(err) || Number(err?.status) >= 500) return unavailableMessage('Document upload');
  return DOCUMENT_UPLOAD_FAILED_MESSAGE;
}

export function validateDocumentFile(file) {
  if (!file) return FILE_MISSING_MESSAGE;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk = !mime || mime === 'application/octet-stream' || ALLOWED_MIME.has(mime);
  if (!extOk || !mimeOk) return fileTypeMessage(file.name);
  if (file.size > MAX_DOCUMENT_BYTES) return fileTooLargeMessage(file.name);
  return null;
}

export function formatUploadedOn(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Uploaded';
  const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `Uploaded on ${formatted}`;
}

function safeFilename(name) {
  const base = String(name || 'document').split(/[/\\]/).pop();
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '');
  return (cleaned || 'document').slice(0, 180);
}

// The bucket takes only pdf, jpeg, png, heic and heif
// (20260927180000_application_documents.sql). Some iPhone photos report the
// HEIC/HEIF sequence types, which the bucket would refuse after the file
// passed the check above (AW-251), so they go up as the plain type.
const STORED_MIME = {
  'image/jpg': 'image/jpeg',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heif',
};

function contentTypeFor(file) {
  const mime = (file.type || '').toLowerCase();
  if (STORED_MIME[mime]) return STORED_MIME[mime];
  if (ALLOWED_MIME.has(mime)) return mime;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  return MIME_FOR_EXT[ext] || 'application/octet-stream';
}

// What goes up for `file` as `type`. supabase-js sends a File or Blob as
// multipart form data, and Storage takes the type of that part, which is the
// file's own: the contentType option only travels with a raw body. A file
// whose own type isn't the one to store (a HEIC sequence, or none at all)
// goes up as a slice of itself with that type; slice copies nothing.
function uploadBody(file, type) {
  if ((file.type || '').toLowerCase() === type || typeof file.slice !== 'function') return file;
  return file.slice(0, file.size, type);
}

export async function listProfileDocuments(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('profile_documents')
    .select('profile_id, document_type, storage_path, original_filename, uploaded_at')
    .eq('profile_id', userId);
  if (error) throw error;
  return data || [];
}

export async function listAllProfileDocuments() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profile_documents')
    .select('profile_id, document_type, storage_path, original_filename, uploaded_at');
  if (error) throw error;
  return data || [];
}

// No-ops when there is no session, so a signup that still needs email
// confirmation never calls storage. The caller can retry once a session exists.
export async function uploadProfileDocument(session, documentType, file) {
  if (!supabase || !session?.user?.id) return { attempted: false };
  if (!DOCUMENT_TYPES.some(doc => doc.id === documentType)) {
    throw new Error('Unknown document.');
  }
  const problem = await validateDocumentFile(file);
  if (problem) throw Object.assign(new Error(problem), { code: 'invalid_file', fileName: file?.name });

  const userId = session.user.id;
  // A new object name keeps the previous file in the bucket when a license is renewed.
  const path = `${userId}/${documentType}/${Date.now()}-${safeFilename(file.name)}`;

  const { error: existingError } = await supabase
    .from('profile_documents')
    .select('storage_path')
    .eq('profile_id', userId)
    .eq('document_type', documentType)
    .maybeSingle();
  if (existingError) throw existingError;

  const contentType = contentTypeFor(file);
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, uploadBody(file, contentType), { upsert: true, contentType });
  if (uploadError) throw uploadError;

  const uploaded_at = new Date().toISOString();
  const row = {
    profile_id: userId,
    document_type: documentType,
    storage_path: path,
    original_filename: String(file.name || 'document').slice(0, 240),
    uploaded_at,
  };
  const { error: rowError } = await supabase
    .from('profile_documents')
    .upsert(row, { onConflict: 'profile_id,document_type' });
  if (rowError) throw rowError;

  return { attempted: true, ...row };
}

// Uploads each chosen file in turn. One that fails doesn't stop the next
// (AW-085): results says, per document type, { ok: true, record } or
// { ok: false, error } (the error as thrown; show documentErrorMessage(error)).
export async function uploadSelectedProof(session, filesByType) {
  if (!supabase || !session?.user?.id) return { attempted: false, results: {} };
  let attempted = false;
  const results = {};
  for (const doc of DOCUMENT_TYPES) {
    const file = filesByType?.[doc.id];
    if (!file) continue;
    attempted = true;
    try {
      const record = await uploadProfileDocument(session, doc.id, file);
      results[doc.id] = { ok: true, record };
    } catch (error) {
      results[doc.id] = { ok: false, error };
    }
  }
  return { attempted, results };
}

// A signed URL for a stored document, valid for `expiresIn` seconds.
export async function createDocumentViewUrl(storagePath, expiresIn = 600) {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw error || new Error('Could not open that file.');
  return data.signedUrl;
}

// How long a document link opened from Admin -> Accounts stays valid (AW-208).
export const DOCUMENT_VIEW_SECONDS = 60;

// Opens a stored document in a new tab, signed at the moment it is clicked
// with a short expiry (AW-208): nothing is signed ahead of time, so no link
// on screen goes stale. The tab opens at once, inside the click, so popup
// blockers allow it, and the signed URL is loaded into it when it arrives.
// Returns { ok: true, url, blocked } (blocked: no tab could be opened, so
// the caller offers `url` as a link) or { ok: false, error }, after closing
// the tab.
export async function openDocument(storagePath, { expiresIn = DOCUMENT_VIEW_SECONDS } = {}) {
  let tab = null;
  try {
    tab = window.open('', '_blank');
  } catch {
    tab = null;
  }
  // The document's page gets no handle on this one (what noopener does;
  // window.open with 'noopener' returns no tab to load the URL into).
  if (tab) {
    try { tab.opener = null; } catch { /* already cut off */ }
  }
  try {
    const url = await createDocumentViewUrl(storagePath, expiresIn);
    if (!url) throw new Error('Could not open that file.');
    if (!tab) return { ok: true, url, blocked: true };
    tab.location.replace(url);
    return { ok: true, url, blocked: false };
  } catch (error) {
    try { tab?.close(); } catch { /* already closed */ }
    return { ok: false, error };
  }
}
