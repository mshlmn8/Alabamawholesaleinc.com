// The apply page's license panel says how many files are on file and lets the
// applicant open one (AW-099, Cursor PR #13). Each document uploads as its
// own state machine: the input is cleared after every pick, stays focusable
// while busy, and a failure keeps the file for Try again (AW-095, AW-257,
// AW-264). The application's fields show a chosen file as a chip with Remove
// (AW-244).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { FILE_TOO_LARGE_MESSAGE } from '../lib/documents.js';
import { ApplicationDocuments, DocumentUploads, documentsSummary } from './DocumentUploads.jsx';

const LICENSE = { document_type: 'tobacco_license', storage_path: 'u1/tobacco_license/1-license.pdf', uploaded_at: '2026-10-01T12:00:00Z', original_filename: 'license.pdf' };
const RESALE = { document_type: 'resale_certificate', storage_path: 'u1/resale_certificate/2-resale.pdf', uploaded_at: '2026-10-02T12:00:00Z', original_filename: 'resale.pdf' };

const docs = vi.hoisted(() => ({ rows: [], url: 'https://example.test/signed', fail: false, uploads: [], upload: null }));
vi.mock('../lib/documents.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listProfileDocuments: vi.fn(async () => docs.rows),
  createDocumentViewUrl: vi.fn(async () => {
    if (docs.fail) throw new Error('no');
    return docs.url;
  }),
  uploadProfileDocument: vi.fn(async (session, type, file) => {
    docs.uploads.push([type, file]);
    return docs.upload(type, file);
  }),
}));

function panel(props = {}) {
  const value = { session: { user: { id: 'u1' } }, loading: false, isBackendConfigured: true };
  return render(<AuthContext.Provider value={value}><ApplicationDocuments status="pending" {...props} /></AuthContext.Provider>);
}

const pdf = (name = 'license.pdf', size = 2000) => new File(['x'.repeat(size)], name, { type: 'application/pdf' });
const saved = (type, file) => ({ attempted: true, document_type: type, storage_path: `u1/${type}/9-${file.name}`, original_filename: file.name, uploaded_at: '2026-10-09T12:00:00Z' });
// A promise the test settles by hand, for a document that is still uploading.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const licenseInput = () => document.getElementById('apply-doc-tobacco_license');
const licenseStatus = () => document.getElementById('apply-doc-tobacco_license-status');
// Picks `file` in a file input the way a browser does, and records what the
// handler writes to its value.
async function pick(input, file) {
  const writes = [];
  Object.defineProperty(input, 'value', { configurable: true, get: () => '', set: (v) => { writes.push(v); } });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  return writes;
}

beforeEach(() => {
  docs.uploads = [];
  docs.upload = (type, file) => saved(type, file);
});
afterEach(() => vi.restoreAllMocks());

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

describe('ApplicationDocuments uploads (AW-095, AW-257, AW-264)', () => {
  it('names the hidden input by its document and the Choose file label, and hides the legend', async () => {
    docs.rows = [];
    panel();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No documents yet.'));
    const input = licenseInput();
    expect(input.className).toBe('doc-file sr-only');
    expect(input.disabled).toBe(false);
    expect(computeAccessibleName(input)).toBe('State retail tobacco license Choose file');
    const choose = input.nextElementSibling;
    expect([choose.tagName, choose.className, choose.htmlFor]).toEqual(['LABEL', 'button ghost sm doc-choose', input.id]);
    expect(document.querySelector('legend').className).toBe('sr-only');
    // The pending panel has no eyebrow: the page already says so (AW-258).
    expect(document.querySelector('.doc-panel .eyebrow')).toBeNull();
  });

  it('clears the input after every pick, so the same file again uploads again', async () => {
    docs.rows = [];
    panel();
    await waitFor(() => expect(licenseInput().closest('fieldset').disabled).toBe(false));
    const file = pdf();
    expect(await pick(licenseInput(), file)).toEqual(['']);
    await waitFor(() => expect(licenseStatus().textContent).toBe('Uploaded on October 9, 2026 · license.pdfView your state retail tobacco license'));
    // Now a record is on file: Replace file.
    expect(licenseInput().nextElementSibling.textContent).toBe('Replace file');
    expect(await pick(licenseInput(), file)).toEqual(['']);
    await waitFor(() => expect(docs.uploads).toHaveLength(2));
    expect(docs.uploads.map(([type, f]) => [type, f])).toEqual([['tobacco_license', file], ['tobacco_license', file]]);
  });

  it('keeps focus on the input while it uploads: aria-disabled, never disabled, and a pick is ignored', async () => {
    docs.rows = [];
    const upload = deferred();
    docs.upload = () => upload.promise;
    panel();
    await waitFor(() => expect(licenseInput().closest('fieldset').disabled).toBe(false));
    const input = licenseInput();
    input.focus();
    await pick(input, pdf());
    expect(licenseStatus().textContent).toBe('Uploading license.pdf…');
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(input);
    // A click opens no picker, and a change that gets through is ignored.
    expect(fireEvent.click(input)).toBe(false);
    await pick(input, pdf('other.pdf'));
    expect(docs.uploads).toHaveLength(1);
    await act(async () => { upload.resolve(saved('tobacco_license', pdf())); });
    expect(input.hasAttribute('aria-disabled')).toBe(false);
    expect(fireEvent.click(input)).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(licenseStatus().textContent).toMatch(/^Uploaded on October 9, 2026 · license\.pdf/);
  });

  it('says which file failed, keeps the one on file, and Try again sends the same file', async () => {
    docs.rows = [LICENSE];
    const failing = deferred();
    docs.upload = () => failing.promise;
    panel();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 2 documents received.'));
    const file = pdf('new-license.pdf');
    await pick(licenseInput(), file);
    await act(async () => { failing.reject({ statusCode: '413', status: 400, message: 'The object exceeded the maximum allowed size' }); });
    expect(licenseStatus().dataset.documentStatus).toBe('failed');
    expect(licenseStatus().textContent).toBe('Couldn’t upload new-license.pdf.Try again uploading your state retail tobacco license');
    const kept = document.getElementById('apply-doc-tobacco_license-kept');
    expect(kept.textContent).toBe('Still on file: Uploaded on October 1, 2026 · license.pdfView your state retail tobacco license');
    // Storage's own text never shows (AW-084).
    expect(screen.getByRole('alert').textContent).toBe(FILE_TOO_LARGE_MESSAGE);
    expect(licenseInput().getAttribute('aria-describedby').split(' ')).toEqual([
      'apply-doc-tobacco_license-hint', 'apply-doc-tobacco_license-status', 'apply-doc-tobacco_license-kept', 'apply-doc-tobacco_license-error',
    ]);
    // Try again: the same File, focus on the input while it goes up.
    docs.upload = (type, f) => saved(type, f);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again uploading your state retail tobacco license' })); });
    expect(docs.uploads.map(([, f]) => f)).toEqual([file, file]);
    expect(document.activeElement).toBe(licenseInput());
    await waitFor(() => expect(licenseStatus().textContent).toMatch(/^Uploaded on October 9, 2026 · new-license\.pdf/));
    expect(document.getElementById('apply-doc-tobacco_license-kept')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
  });

  it('names a refused file, and shortens a long name with the full one in its title', async () => {
    const long = 'TEST_ONLY_State_retail_tobacco_license_2026_renewal_Pending_Mart_LLC_Birmingham_scan01.pdf';
    docs.rows = [{ ...LICENSE, original_filename: long }];
    panel();
    await waitFor(() => expect(licenseStatus().textContent).toMatch(/^Uploaded on/));
    const name = licenseStatus().querySelector('span[title]');
    expect(name.textContent).toBe('Uploaded on October 1, 2026 · TEST_ONLY_State_retail_tob…scan01.pdf');
    expect(name.title).toBe(long);
    await pick(licenseInput(), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert').textContent).toBe('notes.txt isn’t a PDF, JPG, PNG or HEIC file.');
    expect(docs.uploads).toEqual([]);
  });

  it('puts the panel id on the section, for /account#documents (AW-085)', async () => {
    docs.rows = [];
    panel({ id: 'documents' });
    expect(document.querySelector('section.doc-panel').id).toBe('documents');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No documents yet.'));
  });
});

describe('DocumentUploads on the application (AW-244)', () => {
  function Form() {
    const [files, setFiles] = useState({});
    const [errors, setErrors] = useState({});
    return (
      <DocumentUploads
        files={files}
        errors={errors}
        onPick={(type, file, problem) => {
          setFiles((prev) => ({ ...prev, [type]: file }));
          setErrors((prev) => ({ ...prev, [type]: problem }));
        }}
      />
    );
  }

  it('shows a chosen file as a chip with its size and Remove, and Remove puts focus back on the input', async () => {
    render(<Form />);
    const input = document.getElementById('aw-doc-resale_certificate');
    // ('Resale certificate Optional Choose file' in the browser: jsdom's name
    // drops the space that starts the Optional span.)
    expect(computeAccessibleName(input)).toMatch(/^Resale certificate ?Optional Choose file$/);
    expect(await pick(input, pdf('resale.pdf', 3000))).toEqual(['']);
    const chip = document.getElementById('aw-doc-resale_certificate-selected');
    expect(chip.textContent).toBe('resale.pdf · 3 KBRemove Resale certificate');
    expect(input.getAttribute('aria-describedby')).toBe('aw-doc-resale_certificate-hint aw-doc-resale_certificate-selected');
    expect(screen.queryByText(/Selected:/)).toBeNull();
    expect(input.nextElementSibling.textContent).toBe('Replace file');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Resale certificate' }));
    expect(document.getElementById('aw-doc-resale_certificate-selected')).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-describedby')).toBe('aw-doc-resale_certificate-hint');
    expect(input.nextElementSibling.textContent).toBe('Choose file');
  });

  it('names a file that is too large', async () => {
    render(<Form />);
    const input = document.getElementById('aw-doc-tobacco_license');
    await pick(input, { name: 'scan.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 });
    expect(screen.getByRole('alert').textContent).toBe('scan.pdf is over the 10 MB limit.');
    expect(document.getElementById('aw-doc-tobacco_license-selected')).toBeNull();
  });
});
