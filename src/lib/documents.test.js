// License proof uploads (AW-197, AW-207): the path stays
// {user id}/{type}/{file}, a failed removal of the replaced file is reported
// instead of ignored, and a refusal by the database says the proof is locked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ existing: null, uploadError: null, rowError: null, removeError: null, calls: [] }));

vi.mock('./supabase.js', () => {
  const table = () => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: mock.existing, error: null }),
      upsert: async (row, options) => { mock.calls.push(['upsert', row, options]); return { error: mock.rowError }; },
    };
    return q;
  };
  const bucket = {
    upload: async (path, _file, options) => { mock.calls.push(['upload', path, options]); return { error: mock.uploadError }; },
    remove: async (paths) => { mock.calls.push(['remove', paths]); return { data: null, error: mock.removeError }; },
  };
  return {
    supabase: { from: table, storage: { from: () => bucket } },
    isBackendConfigured: true,
    AUTH_STORAGE_KEY: 'aw-auth',
  };
});

const { DOCUMENTS_LOCKED_MESSAGE, documentErrorMessage, isDocumentPermissionError, uploadProfileDocument } = await import('./documents.js');

const SESSION = { user: { id: 'u1' } };
const file = (name) => ({ name, type: 'application/pdf', size: 1000 });

beforeEach(() => {
  Object.assign(mock, { existing: null, uploadError: null, rowError: null, removeError: null, calls: [] });
});

describe('uploadProfileDocument', () => {
  it('stores the file at {user id}/{type}/{file} and removes the one it replaces', async () => {
    mock.existing = { storage_path: 'u1/tobacco_license/old.pdf' };
    const saved = await uploadProfileDocument(SESSION, 'tobacco_license', file('New license.pdf'));
    expect(saved).toMatchObject({ attempted: true, storage_path: 'u1/tobacco_license/New_license.pdf' });
    expect(saved.cleanup).toBeUndefined();
    expect(mock.calls.map(([kind, arg]) => [kind, arg])).toEqual([
      ['upload', 'u1/tobacco_license/New_license.pdf'],
      ['upsert', expect.objectContaining({ profile_id: 'u1', document_type: 'tobacco_license', storage_path: 'u1/tobacco_license/New_license.pdf' })],
      ['remove', ['u1/tobacco_license/old.pdf']],
    ]);
  });

  it('says so when the replaced file could not be removed', async () => {
    mock.existing = { storage_path: 'u1/resale_certificate/old.pdf' };
    mock.removeError = { message: 'network' };
    const saved = await uploadProfileDocument(SESSION, 'resale_certificate', file('cert.pdf'));
    expect(saved).toMatchObject({ attempted: true, storage_path: 'u1/resale_certificate/cert.pdf', cleanup: 'failed' });
  });

  it('passes on a refusal, which reads as locked proof', async () => {
    mock.uploadError = { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' };
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', file('l.pdf')).catch((e) => e);
    expect(err).toBe(mock.uploadError);
    expect(documentErrorMessage(err)).toBe(DOCUMENTS_LOCKED_MESSAGE);
  });
});

describe('documentErrorMessage', () => {
  it('maps row-level security refusals from the database and Storage', () => {
    expect(isDocumentPermissionError({ code: '42501', message: 'new row violates row-level security policy for table "profile_documents"' })).toBe(true);
    expect(isDocumentPermissionError({ status: 403, message: 'Forbidden' })).toBe(true);
    expect(isDocumentPermissionError({ message: 'new row violates row-level security policy' })).toBe(true);
    expect(isDocumentPermissionError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isDocumentPermissionError(null)).toBe(false);
    expect(DOCUMENTS_LOCKED_MESSAGE).toBe('Documents can’t be changed after approval. Email them to the trade desk.');
  });

  it('keeps the old message for other failures', () => {
    expect(documentErrorMessage(new Error('That file is over the 10 MB limit.'))).not.toBe(DOCUMENTS_LOCKED_MESSAGE);
  });
});
