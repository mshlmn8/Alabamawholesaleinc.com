// After an upload goes through, the panel loads the list again. When that
// load fails or takes too long, the saved file still shows as uploaded and
// no "did not upload" error appears under it (AW-195).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { listProfileDocuments, uploadProfileDocument } from '../lib/documents.js';
import { ApplicationDocuments } from './DocumentUploads.jsx';

const docs = vi.hoisted(() => ({ lists: 0, failFrom: Infinity }));
vi.mock('../lib/documents.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // The first load answers []; from load number `failFrom` on, loads fail.
    listProfileDocuments: vi.fn(async () => {
      docs.lists += 1;
      if (docs.lists >= docs.failFrom) throw Object.assign(new Error('The request took too long.'), { name: 'TimeoutError', code: 'timeout' });
      return [];
    }),
    uploadProfileDocument: vi.fn(async (_session, type, file) => ({
      attempted: true, profile_id: 'u1', document_type: type, storage_path: `u1/${type}/1-${file.name}`,
      original_filename: file.name, uploaded_at: '2026-10-09T12:00:00Z',
    })),
    // The content check is documents.test.js's; any file passes here.
    checkDocumentFile: vi.fn(async () => null),
  };
});

afterEach(() => {
  Object.assign(docs, { lists: 0, failFrom: Infinity });
  listProfileDocuments.mockClear();
  uploadProfileDocument.mockClear();
});

describe('ApplicationDocuments after an upload (AW-195)', () => {
  it('keeps the saved file as uploaded, with no error, when the list doesn’t load again', async () => {
    docs.failFrom = 2;
    const value = { session: { user: { id: 'u1' } }, loading: false, isBackendConfigured: true };
    render(<AuthContext.Provider value={value}><ApplicationDocuments status="pending" /></AuthContext.Provider>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No documents yet.'));
    const input = document.getElementById('apply-doc-tobacco_license');
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'license.pdf', { type: 'application/pdf' });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(listProfileDocuments).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 2 documents received.'));
    const row = document.querySelector('.doc-status[data-document-status="uploaded"]');
    expect(row.textContent).toMatch(/^Uploaded on October 9, 2026 · license\.pdf/);
    expect(document.querySelectorAll('.form-error:not(:empty)')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });
});
