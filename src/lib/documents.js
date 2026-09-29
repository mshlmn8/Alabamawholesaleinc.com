// Optional trade-application proof: state retail tobacco license and resale
// certificate. Numbers stay required on the profile; these files are not.
// Uploads run only when a session exists. The storage path is
// {user id}/{document type}/{file}; since 20260928124000 the storage and
// profile_documents policies require exactly that layout, allow changes only
// while the account is pending (the proof is locked once approved, AW-197),
// and cap a user at 10 files (AW-207).

import { supabase } from './supabase.js';
import { describeError } from './errors.js';

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

// What an applicant sees when the database refuses a document change: the
// account is no longer pending (AW-197).
export const DOCUMENTS_LOCKED_MESSAGE = 'Documents can’t be changed after approval. Email them to the trade desk.';

// A refusal by row-level security: 42501 from PostgREST, or a 403 / RLS
// message from Storage.
export function isDocumentPermissionError(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  const status = String(err.statusCode ?? err.status ?? '');
  return code === '42501' || status === '403' || /row-level security/i.test(String(err.message || ''));
}

export function documentErrorMessage(err) {
  if (isDocumentPermissionError(err)) return DOCUMENTS_LOCKED_MESSAGE;
  return describeError(err, 'Document upload', 'That file did not upload. You can try again, or send proof later.');
}

export function validateDocumentFile(file) {
  if (!file) return 'Choose a PDF, JPG, PNG, or HEIC file.';
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  const mime = (file.type || '').toLowerCase();
  const extOk = ALLOWED_EXT.has(ext);
  const mimeOk = !mime || mime === 'application/octet-stream' || ALLOWED_MIME.has(mime);
  if (!extOk || !mimeOk) return 'Use a PDF, JPG, PNG, or HEIC file.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'That file is over the 10 MB limit.';
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

function contentTypeFor(file) {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_MIME.has(mime)) return mime;
  const ext = (file.name || '').split('.').pop()?.toLowerCase();
  return MIME_FOR_EXT[ext] || 'application/octet-stream';
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
  const problem = validateDocumentFile(file);
  if (problem) throw new Error(problem);

  const userId = session.user.id;
  const path = `${userId}/${documentType}/${safeFilename(file.name)}`;

  const { data: existing, error: existingError } = await supabase
    .from('profile_documents')
    .select('storage_path')
    .eq('profile_id', userId)
    .eq('document_type', documentType)
    .maybeSingle();
  if (existingError) throw existingError;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { upsert: true, contentType: contentTypeFor(file) });
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

  // The replaced file. If it can't be removed, the new one is still saved;
  // cleanup: 'failed' says an old file was left behind (it counts towards
  // the 10-file limit until removed).
  if (existing?.storage_path && existing.storage_path !== path) {
    const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([existing.storage_path]);
    if (removeError) return { attempted: true, ...row, cleanup: 'failed' };
  }

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

export async function createDocumentViewUrl(storagePath) {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(storagePath, 600);
  if (error || !data?.signedUrl) throw error || new Error('Could not open that file.');
  return data.signedUrl;
}
