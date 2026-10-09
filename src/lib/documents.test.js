// License proof uploads (AW-197, AW-207, AW-254): the path is
// {user id}/{type}/{time}-{file}, the replaced file stays in the bucket for
// the document history, and a refusal by the database names the upload limit.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [], uploadErrors: {} }));

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
    upload: async (path, body, options) => {
      mock.calls.push(['upload', path, options, body]);
      const type = path.split('/')[1];
      return { error: mock.uploadErrors[type] || mock.uploadError };
    },
    remove: async (paths) => { mock.calls.push(['remove', paths]); return { data: null, error: mock.removeError }; },
    createSignedUrl: async (path, expiresIn) => {
      mock.calls.push(['sign', path, expiresIn]);
      return mock.signError ? { data: null, error: mock.signError } : { data: { signedUrl: `https://files.example.test/${path}?e=${expiresIn}` }, error: null };
    },
  };
  return {
    supabase: { from: table, storage: { from: () => bucket } },
    isBackendConfigured: true,
    AUTH_STORAGE_KEY: 'aw-auth',
  };
});

const {
  DOCUMENTS_REFUSED_MESSAGE, DOCUMENT_UPLOAD_FAILED_MESSAGE, FILE_MISSING_MESSAGE, FILE_TOO_LARGE_MESSAGE, FILE_TYPE_MESSAGE,
  createDocumentViewUrl, documentErrorMessage, isDocumentPermissionError, openDocument, shortFileName,
  uploadProfileDocument, uploadSelectedProof, validateDocumentFile,
} = await import('./documents.js');
const { unavailableMessage } = await import('./errors.js');

const SESSION = { user: { id: 'u1' } };
const file = (name) => ({ name, type: 'application/pdf', size: 1000 });

beforeEach(() => {
  Object.assign(mock, { existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [], uploadErrors: {} });
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

describe('the bucket’s file types (AW-251)', () => {
  it('sends HEIC and HEIF sequence photos as plain HEIC and HEIF, which the bucket accepts', async () => {
    for (const [type, stored] of [['image/heic-sequence', 'image/heic'], ['image/heif-sequence', 'image/heif'], ['image/jpg', 'image/jpeg'], ['image/png', 'image/png'], ['', 'application/pdf']]) {
      mock.calls = [];
      const name = type ? 'IMG_0001.HEIC' : 'license.pdf';
      await uploadProfileDocument(SESSION, 'tobacco_license', { name, type, size: 1000 });
      expect(mock.calls[0][2], type).toMatchObject({ contentType: stored });
    }
  });

  // supabase-js sends a File as a multipart part of the file's own type and
  // ignores contentType then, so the body itself carries the stored type.
  it('sends a file whose own type the bucket would refuse as a slice of the stored type', async () => {
    for (const [type, name, stored] of [['image/heic-sequence', 'IMG_0001.HEIC', 'image/heic'], ['', 'IMG_0002.heic', 'image/heic'], ['', 'license.pdf', 'application/pdf']]) {
      mock.calls = [];
      const picked = new File(['test only'], name, { type });
      await uploadProfileDocument(SESSION, 'tobacco_license', picked);
      const body = mock.calls[0][3];
      expect(body, name).toBeInstanceOf(Blob);
      expect(body.type, name).toBe(stored);
      expect(body.size, name).toBe(picked.size);
    }
    mock.calls = [];
    const pdf = new File(['%PDF test only'], 'license.pdf', { type: 'application/pdf' });
    await uploadProfileDocument(SESSION, 'tobacco_license', pdf);
    expect(mock.calls[0][3]).toBe(pdf);
  });
});

describe('shortFileName (AW-264)', () => {
  it('keeps a name of up to 40 characters, and shortens a longer one around an ellipsis, extension kept', () => {
    expect(shortFileName('license.pdf')).toBe('license.pdf');
    const forty = `${'a'.repeat(36)}.pdf`;
    expect(shortFileName(forty)).toBe(forty);
    const long = 'TEST_ONLY_State_retail_tobacco_license_2026_renewal_Pending_Mart_LLC_Birmingham_scan01.pdf';
    expect(shortFileName(long)).toBe('TEST_ONLY_State_retail_tob…scan01.pdf');
    expect(Array.from(shortFileName(long))).toHaveLength(37);
    expect(shortFileName(long, 100)).toBe(long);
    expect(shortFileName(null)).toBe('');
  });

  it('never cuts an emoji in half', () => {
    const name = `${'😀'.repeat(30)}-scan-of-the-license.pdf`;
    const short = shortFileName(name);
    expect(short.startsWith('😀'.repeat(26))).toBe(true);
    expect(short.endsWith('icense.pdf')).toBe(true);
  });
});

describe('validateDocumentFile (AW-244)', () => {
  it('names the file it refuses', () => {
    expect(validateDocumentFile(null)).toBe(FILE_MISSING_MESSAGE);
    expect(validateDocumentFile({ name: 'notes.txt', type: 'text/plain', size: 10 })).toBe('notes.txt isn’t a PDF, JPG, PNG or HEIC file.');
    expect(validateDocumentFile({ name: 'scan.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toBe('scan.pdf is over the 10 MB limit.');
    expect(validateDocumentFile({ name: `${'x'.repeat(60)}.docx`, type: '', size: 10 })).toBe('xxxxxxxxxxxxxxxxxxxxxxxxxx…xxxxx.docx isn’t a PDF, JPG, PNG or HEIC file.');
    expect(validateDocumentFile({ name: 'IMG_0001.HEIC', type: 'image/heic-sequence', size: 10 })).toBeNull();
  });
});

describe('uploadSelectedProof (AW-085)', () => {
  it('uploads every chosen file, past one that fails, and says how each went', async () => {
    mock.uploadErrors = { tobacco_license: { statusCode: '413', status: 400, message: 'The object exceeded the maximum allowed size' } };
    const outcome = await uploadSelectedProof(SESSION, { tobacco_license: file('license.pdf'), resale_certificate: file('resale.pdf') });
    expect(outcome.attempted).toBe(true);
    expect(outcome.results.tobacco_license).toEqual({ ok: false, error: mock.uploadErrors.tobacco_license });
    expect(documentErrorMessage(outcome.results.tobacco_license.error)).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(outcome.results.resale_certificate).toMatchObject({ ok: true, record: { document_type: 'resale_certificate', original_filename: 'resale.pdf' } });
    expect(mock.calls.filter(([kind]) => kind === 'upload').map(([, path]) => path.split('/')[1])).toEqual(['tobacco_license', 'resale_certificate']);
  });

  it('sends nothing without a session or a file', async () => {
    expect(await uploadSelectedProof(null, { tobacco_license: file('l.pdf') })).toEqual({ attempted: false, results: {} });
    expect(await uploadSelectedProof(SESSION, { tobacco_license: null })).toEqual({ attempted: false, results: {} });
    expect(mock.calls).toEqual([]);
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

  // AW-084: Storage's and the database's own text never reaches the applicant.
  it('names the size limit for a file Storage finds too large', () => {
    expect(documentErrorMessage({ statusCode: '413', status: 400, error: 'Payload too large', message: 'The object exceeded the maximum allowed size' })).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(documentErrorMessage({ status: 413, message: 'Request Entity Too Large' })).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(documentErrorMessage({ status: 400, message: 'The object exceeded the maximum allowed size' })).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(FILE_TOO_LARGE_MESSAGE).toBe('That file is over the 10 MB limit.');
  });

  it('names the file types for a type Storage refuses', () => {
    expect(documentErrorMessage({ statusCode: '415', status: 400, error: 'invalid_mime_type', message: 'mime type image/heic-sequence is not supported' })).toBe(FILE_TYPE_MESSAGE);
    expect(documentErrorMessage({ status: 400, message: 'mime type text/plain is not supported' })).toBe(FILE_TYPE_MESSAGE);
    expect(FILE_TYPE_MESSAGE).toBe('Use a PDF, JPG, PNG, or HEIC file.');
  });

  it('says the upload service is unavailable when the network or server fails', () => {
    expect(documentErrorMessage(new TypeError('Failed to fetch'))).toBe(unavailableMessage('Document upload'));
    expect(documentErrorMessage({ statusCode: '500', status: 500, message: 'Internal Server Error' })).toBe(unavailableMessage('Document upload'));
  });

  it('shows this file’s own check, naming the file, and the generic sentence for anything else', async () => {
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', { name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }).catch((e) => e);
    expect(documentErrorMessage(err)).toBe('big.pdf is over the 10 MB limit.');
    const wrong = await uploadProfileDocument(SESSION, 'tobacco_license', { name: 'notes.txt', type: 'text/plain', size: 10 }).catch((e) => e);
    expect(documentErrorMessage(wrong)).toBe('notes.txt isn’t a PDF, JPG, PNG or HEIC file.');
    expect(mock.calls).toEqual([]);
    for (const raw of [
      { code: '23505', message: 'duplicate key value violates unique constraint "profile_documents_pkey"' },
      { code: 'invalid_file', message: 'Something injected' },
      // Only this file's own sentence for the file it checked.
      { code: 'invalid_file', fileName: 'a.pdf', message: 'b.pdf is over the 10 MB limit.' },
      new Error('Unknown document.'),
      {},
      null,
    ]) {
      const text = documentErrorMessage(raw);
      expect([DOCUMENT_UPLOAD_FAILED_MESSAGE, FILE_TYPE_MESSAGE]).toContain(text);
      expect(text).not.toMatch(/duplicate|injected|Unknown document/);
    }
  });
});

describe('openDocument (AW-208)', () => {
  const fakeTab = () => ({ opener: window, location: { replace: vi.fn() }, close: vi.fn() });

  it('opens the tab inside the click, then loads a URL signed for a minute into it', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    const pending = openDocument('u1/tobacco_license/1-l.pdf');
    // The tab is open before the signing request returns.
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(await pending).toEqual({ ok: true, url: 'https://files.example.test/u1/tobacco_license/1-l.pdf?e=60', blocked: false });
    expect(tab.location.replace).toHaveBeenCalledWith('https://files.example.test/u1/tobacco_license/1-l.pdf?e=60');
    expect(mock.calls).toEqual([['sign', 'u1/tobacco_license/1-l.pdf', 60]]);
    open.mockRestore();
  });

  it('closes the tab when signing fails, and returns the URL when no tab could open', async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    mock.signError = { message: 'Object not found' };
    expect(await openDocument('u1/x.pdf')).toEqual({ ok: false, error: { message: 'Object not found' } });
    expect(tab.close).toHaveBeenCalled();
    mock.signError = null;
    open.mockReturnValue(null);
    expect(await openDocument('u1/x.pdf', { expiresIn: 30 })).toEqual({ ok: true, url: 'https://files.example.test/u1/x.pdf?e=30', blocked: true });
    open.mockRestore();
  });

  it('leaves createDocumentViewUrl at ten minutes for its other callers', async () => {
    await createDocumentViewUrl('u1/x.pdf');
    expect(mock.calls).toEqual([['sign', 'u1/x.pdf', 600]]);
  });
});
