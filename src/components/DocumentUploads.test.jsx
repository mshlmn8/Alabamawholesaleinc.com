// The apply page's license panel says how many files are on file and lets the
// applicant open one (AW-099, Cursor PR #13). A list that didn't load is never
// shown as "Not uploaded" (AW-195), and a picked file is checked by its
// content (AW-347).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { DOCUMENT_CONTENT_MESSAGE, checkDocumentFile, listProfileDocuments } from '../lib/documents.js';
import { ApplicationDocuments, DocumentUploads, documentsSummary } from './DocumentUploads.jsx';

const LICENSE = { document_type: 'tobacco_license', storage_path: 'u1/tobacco_license/1-license.pdf', uploaded_at: '2026-10-01T12:00:00Z', original_filename: 'license.pdf' };
const RESALE = { document_type: 'resale_certificate', storage_path: 'u1/resale_certificate/2-resale.pdf', uploaded_at: '2026-10-02T12:00:00Z', original_filename: 'resale.pdf' };

const docs = vi.hoisted(() => ({ rows: [], url: 'https://example.test/signed', fail: false, listFails: 0, hold: null }));
vi.mock('../lib/documents.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // listFails: how many loads fail next; hold: a promise the next load waits for.
    listProfileDocuments: vi.fn(async () => {
      if (docs.hold) await docs.hold;
      if (docs.listFails > 0) {
        docs.listFails -= 1;
        throw new TypeError('Failed to fetch');
      }
      return docs.rows;
    }),
    createDocumentViewUrl: vi.fn(async () => {
      if (docs.fail) throw new Error('no');
      return docs.url;
    }),
    checkDocumentFile: vi.fn(actual.checkDocumentFile),
  };
});

function panel() {
  const value = { session: { user: { id: 'u1' } }, loading: false, isBackendConfigured: true };
  return render(<AuthContext.Provider value={value}><ApplicationDocuments status="pending" /></AuthContext.Provider>);
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(docs, { listFails: 0, hold: null });
  listProfileDocuments.mockClear();
});

describe('documentsSummary', () => {
  it('counts the files on file, and says nothing while they load', () => {
    expect(documentsSummary(null)).toBe('');
    expect(documentsSummary([])).toBe('No documents yet.');
    expect(documentsSummary([LICENSE])).toBe('1 of 2 documents received.');
    expect(documentsSummary([LICENSE, RESALE])).toBe('Both documents received. A trade rep will check them with your application.');
    // An approved account is past the application.
    expect(documentsSummary([LICENSE, RESALE], 'approved')).toBe('Both documents received.');
  });
});

describe('ApplicationDocuments', () => {
  it('says both files are received, drops "Optional", and opens a file in a new tab', async () => {
    docs.rows = [LICENSE, RESALE];
    docs.fail = false;
    const tab = { opener: 'x', location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab);
    panel();
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Both documents received/));
    expect(screen.queryByText(/Optional/)).toBeNull();
    expect(screen.getByText('Uploading a new file replaces the one on file.')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View your state retail tobacco license' })); });
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('https://example.test/signed');
  });

  it('closes the tab and says so when the file can’t be opened', async () => {
    docs.rows = [LICENSE];
    docs.fail = true;
    const tab = { opener: 'x', location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab);
    panel();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 2 documents received.'));
    expect(screen.queryByRole('button', { name: 'View your resale certificate' })).toBeNull();
    // The received file's status starts with the drawn check, not a text glyph (AW-293).
    const received = document.querySelector('.doc-status[data-document-status="uploaded"]');
    expect(received.firstElementChild.matches('svg.icon')).toBe(true);
    expect(received.textContent).not.toMatch(/✓/);
    expect(document.querySelector('.doc-status.is-missing svg')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'View your state retail tobacco license' })); });
    expect(tab.close).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t open your state retail tobacco license. Try again.');
  });
});

const statuses = () => [...document.querySelectorAll('.doc-status')].map((p) => ({
  state: p.dataset.documentStatus, missing: p.classList.contains('is-missing'), icon: !!p.querySelector('svg'), text: p.textContent,
}));

describe('ApplicationDocuments when the list doesn’t load (AW-195)', () => {
  it('says it couldn’t check, never "Not uploaded", and Try again shows the files', async () => {
    docs.rows = [LICENSE];
    docs.listFails = 1;
    panel();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('We couldn’t load your document status. Try again');
    expect(statuses()).toEqual([
      { state: 'unknown', missing: false, icon: false, text: 'Couldn’t check this document right now' },
      { state: 'unknown', missing: false, icon: false, text: 'Couldn’t check this document right now' },
    ]);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByText('Not uploaded')).toBeNull();
    // Nothing can be uploaded until the list is known.
    for (const input of document.querySelectorAll('input[type=file]')) expect(input.disabled).toBe(true);

    let answer;
    docs.hold = new Promise((resolve) => { answer = resolve; });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(statuses().map((s) => s.text)).toEqual(['Checking…', 'Checking…']);
    await act(async () => { answer(); docs.hold = null; });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 2 documents received.'));
    expect(statuses()).toEqual([
      { state: 'uploaded', missing: false, icon: true, text: 'Uploaded on October 1, 2026 · license.pdfView your state retail tobacco license' },
      { state: 'missing', missing: true, icon: false, text: 'Not uploaded' },
    ]);
    expect(listProfileDocuments).toHaveBeenCalledTimes(2);
    for (const input of document.querySelectorAll('input[type=file]')) expect(input.disabled).toBe(false);
  });

  it('tries again by itself when the connection comes back', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    docs.rows = [LICENSE, RESALE];
    docs.listFails = 1;
    panel();
    await screen.findByRole('alert');
    onLine.mockReturnValue(true);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Both documents received/));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(listProfileDocuments).toHaveBeenCalledTimes(2);
  });
});

// The application form's optional files (AW-347).
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const MZ = [0x4d, 0x5a, 0x90, 0x00];
const fileOf = (name, head, type = '') => new File([new Uint8Array(head), new Uint8Array(500)], name, { type });

function Picker() {
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const onPick = (type, file, problem) => {
    setErrors((prev) => ({ ...prev, [type]: problem }));
    setFiles((prev) => ({ ...prev, [type]: file }));
  };
  return <DocumentUploads files={files} errors={errors} onPick={onPick} />;
}
const resaleInput = () => document.getElementById('aw-doc-resale_certificate');
const pick = (input, file) => fireEvent.change(input, { target: { files: file ? [file] : [] } });

describe('picking a document (AW-347)', () => {
  it('refuses a disguised file inline, and takes a real PNG', async () => {
    render(<Picker />);
    const input = resaleInput();
    expect(input.getAttribute('accept')).toBe('.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png');
    expect(screen.getAllByText('PDF, JPG or PNG. 10 MB maximum. One file; choosing another replaces it.')).toHaveLength(2);
    pick(input, fileOf('resale.png', MZ, 'application/octet-stream'));
    expect(await screen.findByText(DOCUMENT_CONTENT_MESSAGE)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('');
    expect(screen.queryByText(/^Selected:/)).toBeNull();

    pick(input, fileOf('resale.png', PNG, 'image/png'));
    expect(await screen.findByText('Selected: resale.png')).toBeTruthy();
    expect(screen.queryByText(DOCUMENT_CONTENT_MESSAGE)).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('refuses a wrong extension at once, without reading the file', async () => {
    render(<Picker />);
    checkDocumentFile.mockClear();
    pick(resaleInput(), fileOf('IMG_0001.heic', PNG, 'image/heic'));
    expect(await screen.findByText('Use a PDF, JPG or PNG file.')).toBeTruthy();
    expect(checkDocumentFile).not.toHaveBeenCalled();
  });

  it('keeps the later pick when an earlier file’s check answers last', async () => {
    render(<Picker />);
    let finishFirst;
    checkDocumentFile.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    const input = resaleInput();
    pick(input, fileOf('first.png', PNG, 'image/png'));
    pick(input, fileOf('second.png', MZ, 'image/png'));
    expect(await screen.findByText(DOCUMENT_CONTENT_MESSAGE)).toBeTruthy();
    await act(async () => { finishFirst(null); });
    expect(screen.queryByText('Selected: first.png')).toBeNull();
    expect(screen.getByText(DOCUMENT_CONTENT_MESSAGE)).toBeTruthy();
  });
});
