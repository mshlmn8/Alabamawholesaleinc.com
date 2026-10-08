// License proof uploads (AW-197, AW-207, AW-254): the path is
// {user id}/{type}/{time}-{file}, the replaced file stays in the bucket for
// the document history, and a refusal by the database names the upload limit.
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

const { DOCUMENTS_REFUSED_MESSAGE, documentErrorMessage, isDocumentPermissionError, uploadProfileDocument } = await import('./documents.js');

const SESSION = { user: { id: 'u1' } };
const file = (name) => ({ name, type: 'application/pdf', size: 1000 });

beforeEach(() => {
  Object.assign(mock, { existing: null, uploadError: null, rowError: null, removeError: null, calls: [] });
});

describe('uploadProfileDocument', () => {
  it('stores a new object at {user id}/{type}/{time}-{file} and keeps the one it replaces', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    mock.existing = { storage_path: 'u1/tobacco_license/old.pdf' };
    const saved = await uploadProfileDocument(SESSION, 'tobacco_license', file('New license.pdf'));
    const path = 'u1/tobacco_license/1700000000000-New_license.pdf';
    expect(saved).toMatchObject({ attempted: true, storage_path: path });
    expect(mock.calls.map(([kind, arg]) => [kind, arg])).toEqual([
      ['upload', path],
      ['upsert', expect.objectContaining({ profile_id: 'u1', document_type: 'tobacco_license', storage_path: path })],
    ]);
    vi.restoreAllMocks();
  });

  it('passes on a refusal, which names the upload limit', async () => {
    mock.uploadError = { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' };
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', file('l.pdf')).catch((e) => e);
    expect(err).toBe(mock.uploadError);
    expect(documentErrorMessage(err)).toBe(DOCUMENTS_REFUSED_MESSAGE);
  });
});

describe('documentErrorMessage', () => {
  it('maps row-level security refusals from the database and Storage', () => {
    expect(isDocumentPermissionError({ code: '42501', message: 'new row violates row-level security policy for table "profile_documents"' })).toBe(true);
    expect(isDocumentPermissionError({ status: 403, message: 'Forbidden' })).toBe(true);
    expect(isDocumentPermissionError({ message: 'new row violates row-level security policy' })).toBe(true);
    expect(isDocumentPermissionError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isDocumentPermissionError(null)).toBe(false);
    expect(DOCUMENTS_REFUSED_MESSAGE).toMatch(/at most 10 uploads a day/);
  });

  it('keeps the old message for other failures', () => {
    expect(documentErrorMessage(new Error('That file is over the 10 MB limit.'))).not.toBe(DOCUMENTS_REFUSED_MESSAGE);
  });
});
