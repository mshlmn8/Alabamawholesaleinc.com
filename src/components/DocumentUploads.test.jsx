// The apply page's license panel says how many files are on file and lets the
// applicant open one (AW-099, Cursor PR #13).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { ApplicationDocuments, documentsSummary } from './DocumentUploads.jsx';

const LICENSE = { document_type: 'tobacco_license', storage_path: 'u1/tobacco_license/1-license.pdf', uploaded_at: '2026-10-01T12:00:00Z', original_filename: 'license.pdf' };
const RESALE = { document_type: 'resale_certificate', storage_path: 'u1/resale_certificate/2-resale.pdf', uploaded_at: '2026-10-02T12:00:00Z', original_filename: 'resale.pdf' };

const docs = vi.hoisted(() => ({ rows: [], url: 'https://example.test/signed', fail: false }));
vi.mock('../lib/documents.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listProfileDocuments: vi.fn(async () => docs.rows),
  createDocumentViewUrl: vi.fn(async () => {
    if (docs.fail) throw new Error('no');
    return docs.url;
  }),
}));

function panel() {
  const value = { session: { user: { id: 'u1' } }, loading: false, isBackendConfigured: true };
  return render(<AuthContext.Provider value={value}><ApplicationDocuments status="pending" /></AuthContext.Provider>);
}

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

describe('ApplicationDocuments file names (AW-264)', () => {
  it('shortens a long name, with the full one in its title', async () => {
    const long = 'TEST_ONLY_State_retail_tobacco_license_2026_renewal_Pending_Mart_LLC_Birmingham_scan01.pdf';
    docs.rows = [{ ...LICENSE, original_filename: long }];
    docs.fail = false;
    panel();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 2 documents received.'));
    const name = document.querySelector('#apply-doc-tobacco_license-status span[title]');
    expect(name.textContent).toBe('Uploaded on October 1, 2026 · TEST_ONLY_State_retail_tob…scan01.pdf');
    expect(name.title).toBe(long);
  });
});
