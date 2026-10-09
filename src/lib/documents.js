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
import { describeError } from './errors.js';
import { REQUEST_TIMEOUT_MS, timeoutSignal } from './network.js';
import { fetchAllRows } from './paging.js';

export const DOCUMENT_BUCKET = 'application-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

// PDF, JPG or PNG only (AW-347). HEIC/HEIF is no longer offered: Chrome and
// Firefox can't show it to staff (the admin's View link downloaded an
// unreadable file), and iPhone Safari converts a photo to JPEG when the
// picker doesn't list HEIC. The bucket's allowed_mime_types still has
// image/heic and image/heif (20260927180000, no migration), so files sent
// before this still open. With no HEIC there is no HEIC-sequence content
// type to map either, which makes AW-251 moot.
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export const DOCUMENT_TYPES = [
  { id: 'tobacco_license', label: 'State retail tobacco license' },
  { id: 'resale_certificate', label: 'Resale certificate' },
];

const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
const MIME_FOR_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
// What sniffDocumentType() must find in a file with each extension.
const TYPE_FOR_EXT = { pdf: 'pdf', jpg: 'jpeg', jpeg: 'jpeg', png: 'png' };
const MIME_FOR_TYPE = { pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png' };

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

export function documentErrorMessage(err) {
  if (isDocumentPermissionError(err)) return DOCUMENTS_REFUSED_MESSAGE;
  return describeError(err, 'Document upload', 'That file did not upload. You can try again, or send proof later.');
}

const extensionOf = (file) => (file?.name || '').split('.').pop()?.toLowerCase();

// The quick check, by name, declared type and size: synchronous, so a pick
// can be refused at once. checkDocumentFile() adds the content check.
export function validateDocumentFile(file) {
  if (!file) return 'Choose a PDF, JPG or PNG file.';
  const ext = extensionOf(file);
  const mime = (file.type || '').toLowerCase();
  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk = !mime || mime === 'application/octet-stream' || ALLOWED_MIME.has(mime);
  if (!extOk || !mimeOk) return 'Use a PDF, JPG or PNG file.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'That file is over the 10 MB limit.';
  return null;
}

// How many bytes from the start of a file sniffDocumentType() reads. A PDF
// reader accepts '%PDF-' anywhere in the first 1024.
const SNIFF_BYTES = 1024;
const PDF_MARKER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function readHead(file) {
  const head = file.slice(0, SNIFF_BYTES);
  if (typeof head.arrayBuffer === 'function') return new Uint8Array(await head.arrayBuffer());
  // Browsers without Blob.arrayBuffer() (Safari before 14).
  return new Uint8Array(await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(head);
  }));
}

const matchesAt = (bytes, signature, at = 0) => signature.every((byte, i) => bytes[at + i] === byte);
function contains(bytes, marker) {
  for (let at = 0; at + marker.length <= bytes.length; at++) {
    if (matchesAt(bytes, marker, at)) return true;
  }
  return false;
}

// What a file's first bytes say it is (AW-347): 'pdf', 'jpeg', 'png', or
// null for anything else, or a file that can't be read. Its name and the
// type the browser declares (often empty or application/octet-stream) say
// nothing about what is inside.
export async function sniffDocumentType(file) {
  if (!file || typeof file.slice !== 'function') return null;
  let bytes;
  try {
    bytes = await readHead(file);
  } catch {
    return null;
  }
  if (matchesAt(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (matchesAt(bytes, PNG_SIGNATURE)) return 'png';
  if (contains(bytes, PDF_MARKER)) return 'pdf';
  return null;
}

export const DOCUMENT_CONTENT_MESSAGE = 'That file doesn’t look like a PDF, JPG or PNG. Choose the original file, or email it to the trade desk.';

// validateDocumentFile(), then the content must be a PDF, JPEG or PNG that
// matches the extension (.jpg and .jpeg are both JPEG). Returns
// { problem, type }: problem is null for a good file, type its sniffed type.
async function inspectDocumentFile(file) {
  const problem = validateDocumentFile(file);
  if (problem) return { problem, type: null };
  const type = await sniffDocumentType(file);
  if (!type || type !== TYPE_FOR_EXT[extensionOf(file)]) return { problem: DOCUMENT_CONTENT_MESSAGE, type };
  return { problem: null, type };
}

// The full check before a file is accepted (AW-347): a message, or null.
// Only the browser looks at the bytes: storage checks the declared type
// and nothing reads the file on the server (BACKEND.md, documents).
// TODO(owner): Should uploaded licence documents also be checked on the server, by a Supabase Edge Function that reads each new file's first bytes and removes one that isn't a real PDF, JPEG or PNG? Not built: today only the site checks, so an upload made outside the site can still store a disguised file. (AW-347)
export async function checkDocumentFile(file) {
  return (await inspectDocumentFile(file)).problem;
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

// The sniffed type when it is known (AW-347), else what the file declares.
function contentTypeFor(file, type = null) {
  if (MIME_FOR_TYPE[type]) return MIME_FOR_TYPE[type];
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_MIME.has(mime)) return mime;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  return MIME_FOR_EXT[ext] || 'application/octet-stream';
}

// Gives up after REQUEST_TIMEOUT_MS (AW-194) and throws, like any failed
// load. Uploads have no time limit: a large file on a slow line takes long.
export async function listProfileDocuments(userId) {
  if (!supabase || !userId) return [];
  const t = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .from('profile_documents')
      .select('profile_id, document_type, storage_path, original_filename, uploaded_at')
      .eq('profile_id', userId)
      .abortSignal(t.signal);
    if (error) throw error;
    return data || [];
  } finally {
    t.clear();
  }
}

// Every account's documents (Admin -> Accounts), a page of 1000 at a time
// (AW-199), ordered by the table's unique key.
export async function listAllProfileDocuments() {
  if (!supabase) return [];
  const { data, error } = await fetchAllRows(() => supabase
    .from('profile_documents')
    .select('profile_id, document_type, storage_path, original_filename, uploaded_at')
    .order('profile_id')
    .order('document_type'));
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
  // A disguised file is refused here, before anything reaches storage.
  const { problem, type } = await inspectDocumentFile(file);
  if (problem) throw new Error(problem);

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

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { upsert: true, contentType: contentTypeFor(file, type) });
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

export async function uploadSelectedProof(session, filesByType) {
  if (!supabase || !session?.user?.id) return { attempted: false };
  let attempted = false;
  for (const doc of DOCUMENT_TYPES) {
    const file = filesByType?.[doc.id];
    if (!file) continue;
    attempted = true;
    await uploadProfileDocument(session, doc.id, file);
  }
  return { attempted };
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
