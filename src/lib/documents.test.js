// License proof uploads (AW-197, AW-207, AW-254): the path is
// {user id}/{type}/{time}-{file}, the replaced file stays in the bucket for
// the document history, and a refusal by the database names the upload limit.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [] }));

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
  DOCUMENT_ACCEPT, DOCUMENT_CONTENT_MESSAGE, DOCUMENTS_REFUSED_MESSAGE, MAX_DOCUMENT_BYTES, checkDocumentFile, createDocumentViewUrl,
  documentErrorMessage, isDocumentPermissionError, openDocument, sniffDocumentType, uploadProfileDocument, validateDocumentFile,
} = await import('./documents.js');

const SESSION = { user: { id: 'u1' } };
// Real file headers (AW-347), padded to a believable size.
const HEADERS = {
  pdf: [...'%PDF-1.7\n'].map((c) => c.charCodeAt(0)),
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d],
  exe: [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00], // MZ, a Windows program
  html: [...'<!doctype html><script>alert(1)</script>'].map((c) => c.charCodeAt(0)),
};
const fileOf = (name, head, type = '', size = 2000) => new File([new Uint8Array(head), new Uint8Array(Math.max(0, size - head.length))], name, { type });
const file = (name) => fileOf(name, HEADERS.pdf, 'application/pdf');

beforeEach(() => {
  Object.assign(mock, { existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [] });
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

  it('refuses a disguised file before anything reaches storage (AW-347)', async () => {
    const err = await uploadProfileDocument(SESSION, 'resale_certificate', fileOf('resale.png', HEADERS.exe, 'application/octet-stream')).catch((e) => e);
    expect(err.message).toBe(DOCUMENT_CONTENT_MESSAGE);
    expect(mock.calls).toEqual([]);
  });

  it('labels the upload with the sniffed type, whatever the browser declared (AW-347)', async () => {
    await uploadProfileDocument(SESSION, 'tobacco_license', fileOf('scan.png', HEADERS.png, ''));
    await uploadProfileDocument(SESSION, 'tobacco_license', fileOf('scan.JPG', HEADERS.jpeg, 'application/octet-stream'));
    await uploadProfileDocument(SESSION, 'tobacco_license', fileOf('license.pdf', HEADERS.pdf, 'application/pdf'));
    expect(mock.calls.filter(([kind]) => kind === 'upload').map(([, , options]) => options.contentType))
      .toEqual(['image/png', 'image/jpeg', 'application/pdf']);
  });

  it('passes on a refusal, which names the upload limit', async () => {
    mock.uploadError = { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' };
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', file('l.pdf')).catch((e) => e);
    expect(err).toBe(mock.uploadError);
    expect(documentErrorMessage(err)).toBe(DOCUMENTS_REFUSED_MESSAGE);
  });
});

describe('checking a file by its content (AW-347)', () => {
  it('reads real PDF, JPEG and PNG headers', async () => {
    expect(await sniffDocumentType(fileOf('a.pdf', HEADERS.pdf))).toBe('pdf');
    expect(await sniffDocumentType(fileOf('a.jpg', HEADERS.jpeg))).toBe('jpeg');
    expect(await sniffDocumentType(fileOf('a.png', HEADERS.png))).toBe('png');
    expect(await sniffDocumentType(fileOf('a.pdf', HEADERS.html))).toBeNull();
    // A PDF reader takes the header anywhere in the first 1024 bytes.
    const junk = new Array(1000).fill(0x20);
    expect(await sniffDocumentType(fileOf('late.pdf', [...junk, ...HEADERS.pdf]))).toBe('pdf');
    expect(await sniffDocumentType(fileOf('too-late.pdf', [...new Array(1024).fill(0x20), ...HEADERS.pdf]))).toBeNull();
    // Nothing to read.
    expect(await sniffDocumentType(null)).toBeNull();
    expect(await sniffDocumentType({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBeNull();
  });

  it('falls back to FileReader where a Blob has no arrayBuffer() (Safari before 14)', async () => {
    const old = {
      name: 'scan.png',
      slice: () => Object.defineProperty(new Blob([new Uint8Array(HEADERS.png)]), 'arrayBuffer', { value: undefined }),
    };
    expect(await sniffDocumentType(old)).toBe('png');
  });

  it('reads only the first 1024 bytes', async () => {
    const f = fileOf('big.pdf', HEADERS.pdf, 'application/pdf', 5000);
    const slice = vi.spyOn(f, 'slice');
    await sniffDocumentType(f);
    expect(slice).toHaveBeenCalledWith(0, 1024);
  });

  it('accepts real files whose content matches the extension', async () => {
    expect(await checkDocumentFile(fileOf('license.pdf', HEADERS.pdf, 'application/pdf'))).toBeNull();
    expect(await checkDocumentFile(fileOf('license.PDF', HEADERS.pdf, ''))).toBeNull();
    expect(await checkDocumentFile(fileOf('photo.jpg', HEADERS.jpeg, 'image/jpeg'))).toBeNull();
    expect(await checkDocumentFile(fileOf('photo.jpeg', HEADERS.jpeg, 'image/jpg'))).toBeNull();
    expect(await checkDocumentFile(fileOf('scan.png', HEADERS.png, 'image/png'))).toBeNull();
  });

  it('refuses a program, a web page, or a file whose content and name disagree', async () => {
    // Both passed the old check by name and declared type alone.
    expect(validateDocumentFile(fileOf('resale.png', HEADERS.exe, 'application/octet-stream'))).toBeNull();
    expect(await checkDocumentFile(fileOf('resale.png', HEADERS.exe, 'application/octet-stream'))).toBe(DOCUMENT_CONTENT_MESSAGE);
    expect(validateDocumentFile(fileOf('license.pdf', HEADERS.html, ''))).toBeNull();
    expect(await checkDocumentFile(fileOf('license.pdf', HEADERS.html, ''))).toBe(DOCUMENT_CONTENT_MESSAGE);
    expect(await checkDocumentFile(fileOf('photo.jpg', HEADERS.png, 'image/jpeg'))).toBe(DOCUMENT_CONTENT_MESSAGE);
    expect(await checkDocumentFile(fileOf('scan.pdf', HEADERS.jpeg, 'application/pdf'))).toBe(DOCUMENT_CONTENT_MESSAGE);
    expect(DOCUMENT_CONTENT_MESSAGE).toBe('That file doesn’t look like a PDF, JPG or PNG. Choose the original file, or email it to the trade desk.');
  });

  it('no longer takes HEIC, and keeps the size limit', async () => {
    const heic = fileOf('IMG_0001.heic', [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], 'image/heic');
    expect(validateDocumentFile(heic)).toBe('Use a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(heic)).toBe('Use a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(fileOf('IMG_0001.HEIF', HEADERS.jpeg, ''))).toBe('Use a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(fileOf('burst.heic', HEADERS.jpeg, 'image/heic-sequence'))).toBe('Use a PDF, JPG or PNG file.');
    expect(DOCUMENT_ACCEPT).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
    expect(validateDocumentFile(null)).toBe('Choose a PDF, JPG or PNG file.');
    const big = { name: 'big.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES + 1, slice: vi.fn() };
    expect(validateDocumentFile(big)).toBe('That file is over the 10 MB limit.');
    expect(await checkDocumentFile(big)).toBe('That file is over the 10 MB limit.');
    // Refused before any byte is read.
    expect(big.slice).not.toHaveBeenCalled();
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
