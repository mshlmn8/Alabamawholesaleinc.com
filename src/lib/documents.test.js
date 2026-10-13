// License proof uploads (AW-197, AW-207, AW-254): the path is
// {user id}/{type}/{time}-{file}, the replaced file stays in the bucket for
// the document history, and a refusal by the database names the upload limit.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [], uploadErrors: {}, uploadQueue: [] }));

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
      // uploadQueue: one answer per upload, in order, before the defaults.
      if (mock.uploadQueue.length) return { error: mock.uploadQueue.shift() };
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
  DOCUMENT_ACCEPT, DOCUMENT_CONTENT_MESSAGE, DOCUMENTS_REFUSED_MESSAGE, DOCUMENT_UPLOAD_FAILED_MESSAGE, FILE_MISSING_MESSAGE,
  FILE_TOO_LARGE_MESSAGE, FILE_TYPE_MESSAGE, MAX_DOCUMENT_BYTES, checkDocumentFile, createDocumentViewUrl, documentErrorMessage,
  isDocumentPermissionError, isDuplicateObjectError, openDocument, shortFileName, sniffDocumentType, uploadProfileDocument,
  uploadSelectedProof, validateDocumentFile,
} = await import('./documents.js');
const { OFFLINE_MESSAGE, slowMessage, unavailableMessage } = await import('./errors.js');

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
  Object.assign(mock, { existing: null, uploadError: null, rowError: null, removeError: null, signError: null, calls: [], uploadErrors: {}, uploadQueue: [] });
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

  it('never overwrites a stored file: the upload goes with upsert off (AW-197)', async () => {
    await uploadProfileDocument(SESSION, 'tobacco_license', file('license.pdf'));
    await uploadProfileDocument(SESSION, 'resale_certificate', fileOf('resale.png', HEADERS.png, 'image/png'));
    const uploads = mock.calls.filter(([kind]) => kind === 'upload');
    expect(uploads).toHaveLength(2);
    for (const [, , options] of uploads) expect(options.upsert).toBe(false);
  });

  it('tries once more under a new name when the name is taken, and files the second path', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    mock.uploadQueue = [{ statusCode: '409', error: 'Duplicate', message: 'The resource already exists', status: 400 }, null];
    const saved = await uploadProfileDocument(SESSION, 'tobacco_license', file('license.pdf'));
    const uploads = mock.calls.filter(([kind]) => kind === 'upload').map(([, path, options]) => [path, options.upsert]);
    // Date.now() hasn't moved, so the second name is a millisecond later.
    expect(uploads).toEqual([
      ['u1/tobacco_license/1700000000000-license.pdf', false],
      ['u1/tobacco_license/1700000000001-license.pdf', false],
    ]);
    expect(saved.storage_path).toBe('u1/tobacco_license/1700000000001-license.pdf');
    expect(mock.calls.at(-1)).toEqual(['upsert', expect.objectContaining({ storage_path: 'u1/tobacco_license/1700000000001-license.pdf' }), { onConflict: 'profile_id,document_type' }]);
    now.mockRestore();
  });

  it('retries a taken name only once, and never retries any other refusal', async () => {
    const taken = { statusCode: '409', error: 'Duplicate', message: 'The resource already exists', status: 409 };
    mock.uploadQueue = [taken, taken];
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', file('license.pdf')).catch((e) => e);
    expect(err).toBe(taken);
    expect(mock.calls.filter(([kind]) => kind === 'upload')).toHaveLength(2);
    expect(mock.calls.some(([kind]) => kind === 'upsert')).toBe(false);
    expect(documentErrorMessage(err)).toBe(DOCUMENT_UPLOAD_FAILED_MESSAGE);

    mock.calls = [];
    mock.uploadQueue = [{ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy', status: 400 }];
    await uploadProfileDocument(SESSION, 'tobacco_license', file('license.pdf')).catch(() => {});
    expect(mock.calls.filter(([kind]) => kind === 'upload')).toHaveLength(1);
  });

  it('knows Storage’s taken-name answer', () => {
    expect(isDuplicateObjectError({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })).toBe(true);
    expect(isDuplicateObjectError({ status: 409, message: 'x' })).toBe(true);
    expect(isDuplicateObjectError({ status: 400, code: 'KeyAlreadyExists', message: 'x' })).toBe(true);
    expect(isDuplicateObjectError({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe(false);
    expect(isDuplicateObjectError({ statusCode: '413', message: 'Payload too large' })).toBe(false);
    expect(isDuplicateObjectError(null)).toBe(false);
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
    // Only whitespace may come before '%PDF-', within the 1024 bytes read.
    const blank = new Array(1000).fill(0x20);
    expect(await sniffDocumentType(fileOf('late.pdf', [...blank, ...HEADERS.pdf]))).toBe('pdf');
    expect(await sniffDocumentType(fileOf('too-late.pdf', [...new Array(1024).fill(0x20), ...HEADERS.pdf]))).toBeNull();
    // Nothing to read.
    expect(await sniffDocumentType(null)).toBeNull();
    expect(await sniffDocumentType({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBeNull();
  });

  it('takes a PDF only when %PDF- starts it, after at most a byte order mark and whitespace', async () => {
    const bytes = (text) => [...text].map((c) => c.charCodeAt(0));
    // The marker at byte 0.
    expect(await sniffDocumentType(fileOf('a.pdf', HEADERS.pdf))).toBe('pdf');
    expect(await checkDocumentFile(fileOf('a.pdf', HEADERS.pdf, 'application/pdf'))).toBeNull();
    // A UTF-8 byte order mark, then whitespace, then the marker.
    const bom = [0xef, 0xbb, 0xbf];
    expect(await sniffDocumentType(fileOf('bom.pdf', [...bom, ...HEADERS.pdf]))).toBe('pdf');
    expect(await sniffDocumentType(fileOf('bom-space.pdf', [...bom, ...bytes(' \r\n\t\f'), ...HEADERS.pdf]))).toBe('pdf');
    expect(await checkDocumentFile(fileOf('bom.pdf', [...bom, ...HEADERS.pdf], ''))).toBeNull();
    // A web page with the marker at byte 200: readers might open it, it isn't taken.
    const page = bytes('<!doctype html><html><body><script>alert(1)</script>').concat(new Array(200).fill(0x20)).slice(0, 200);
    expect(page).toHaveLength(200);
    const html = fileOf('license.pdf', [...page, ...HEADERS.pdf], 'application/pdf');
    expect(await sniffDocumentType(html)).toBeNull();
    expect(await checkDocumentFile(html)).toBe(DOCUMENT_CONTENT_MESSAGE);
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', html).catch((e) => e);
    expect(err).toMatchObject({ code: 'invalid_file', message: DOCUMENT_CONTENT_MESSAGE });
    expect(mock.calls).toEqual([]);
    // Anything else in front, even one byte, or a BOM that isn't at byte 0.
    expect(await sniffDocumentType(fileOf('x.pdf', [0x00, ...HEADERS.pdf]))).toBeNull();
    expect(await sniffDocumentType(fileOf('x.pdf', [...bytes('x'), ...HEADERS.pdf]))).toBeNull();
    expect(await sniffDocumentType(fileOf('x.pdf', [0x20, ...bom, ...HEADERS.pdf]))).toBeNull();
    expect(await sniffDocumentType(fileOf('x.pdf', [...bom, ...bom, ...HEADERS.pdf]))).toBeNull();
    // Half a marker isn't one.
    expect(await sniffDocumentType(fileOf('x.pdf', bytes('%PDF'), '', 4))).toBeNull();
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
    expect(validateDocumentFile(heic)).toBe('IMG_0001.heic isn’t a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(heic)).toBe('IMG_0001.heic isn’t a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(fileOf('IMG_0001.HEIF', HEADERS.jpeg, ''))).toBe('IMG_0001.HEIF isn’t a PDF, JPG or PNG file.');
    expect(await checkDocumentFile(fileOf('burst.heic', HEADERS.jpeg, 'image/heic-sequence'))).toBe('burst.heic isn’t a PDF, JPG or PNG file.');
    expect(DOCUMENT_ACCEPT).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
    expect(validateDocumentFile(null)).toBe('Choose a PDF, JPG or PNG file.');
    const big = { name: 'big.pdf', type: 'application/pdf', size: MAX_DOCUMENT_BYTES + 1, slice: vi.fn() };
    expect(validateDocumentFile(big)).toBe('big.pdf is over the 10 MB limit.');
    expect(await checkDocumentFile(big)).toBe('big.pdf is over the 10 MB limit.');
    // Refused before any byte is read.
    expect(big.slice).not.toHaveBeenCalled();
  });
});

describe('the stored file type (AW-347, AW-251)', () => {
  // supabase-js sends a File as a multipart part of the file's own type and
  // ignores contentType then, so the body itself carries the stored type:
  // the type the file's content was sniffed as. HEIC is no longer taken, so
  // AW-251's HEIC-sequence mapping is moot.
  it('sends a file whose own type isn’t its sniffed type as a slice of that type', async () => {
    for (const [name, head, type, stored] of [
      ['scan.png', HEADERS.png, '', 'image/png'],
      ['scan.JPG', HEADERS.jpeg, 'application/octet-stream', 'image/jpeg'],
      ['photo.jpeg', HEADERS.jpeg, 'image/jpg', 'image/jpeg'],
      ['license.pdf', HEADERS.pdf, '', 'application/pdf'],
    ]) {
      mock.calls = [];
      const picked = fileOf(name, head, type);
      await uploadProfileDocument(SESSION, 'tobacco_license', picked);
      expect(mock.calls[0][2], name).toMatchObject({ contentType: stored });
      const body = mock.calls[0][3];
      expect(body, name).toBeInstanceOf(Blob);
      expect(body.type, name).toBe(stored);
      expect(body.size, name).toBe(picked.size);
    }
    mock.calls = [];
    const pdf = fileOf('license.pdf', HEADERS.pdf, 'application/pdf');
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
    expect(validateDocumentFile({ name: 'notes.txt', type: 'text/plain', size: 10 })).toBe('notes.txt isn’t a PDF, JPG or PNG file.');
    expect(validateDocumentFile({ name: 'scan.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toBe('scan.pdf is over the 10 MB limit.');
    expect(validateDocumentFile({ name: `${'x'.repeat(60)}.docx`, type: '', size: 10 })).toBe('xxxxxxxxxxxxxxxxxxxxxxxxxx…xxxxx.docx isn’t a PDF, JPG or PNG file.');
    expect(validateDocumentFile({ name: 'IMG_0001.HEIC', type: 'image/heic-sequence', size: 10 })).toBe('IMG_0001.HEIC isn’t a PDF, JPG or PNG file.');
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
    expect(FILE_TYPE_MESSAGE).toBe('Use a PDF, JPG or PNG file.');
  });

  it('says the upload service is unavailable when the network or server fails', () => {
    expect(documentErrorMessage(new TypeError('Failed to fetch'))).toBe(unavailableMessage('Document upload'));
    expect(documentErrorMessage({ statusCode: '500', status: 500, message: 'Internal Server Error' })).toBe(unavailableMessage('Document upload'));
  });

  it('says so when the browser is offline or the request gave up (AW-344, AW-194)', () => {
    expect(documentErrorMessage({ name: 'TimeoutError', message: 'The request took too long.' })).toBe(slowMessage('Document upload'));
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(documentErrorMessage(new TypeError('Failed to fetch'))).toBe(OFFLINE_MESSAGE);
    online.mockRestore();
  });

  it('shows this file’s own check, naming the file, and the generic sentence for anything else', async () => {
    const err = await uploadProfileDocument(SESSION, 'tobacco_license', { name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }).catch((e) => e);
    expect(documentErrorMessage(err)).toBe('big.pdf is over the 10 MB limit.');
    const wrong = await uploadProfileDocument(SESSION, 'tobacco_license', { name: 'notes.txt', type: 'text/plain', size: 10 }).catch((e) => e);
    expect(documentErrorMessage(wrong)).toBe('notes.txt isn’t a PDF, JPG or PNG file.');
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
