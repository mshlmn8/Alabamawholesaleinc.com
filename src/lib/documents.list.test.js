// The licence documents list gives up after REQUEST_TIMEOUT_MS (AW-194), and
// clears its timer when it answers. (The page's message for a failed load is
// DocumentUploads'.)
import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ calls: [], stall: false }));
vi.mock('./supabase.js', () => {
  const from = (table) => {
    const call = { table, eq: null, signal: null };
    const query = {
      select: () => query,
      eq: (column, value) => { call.eq = [column, value]; return query; },
      abortSignal: (signal) => {
        call.signal = signal;
        db.calls.push(call);
        if (!db.stall) return Promise.resolve({ data: [{ document_type: 'tobacco_license' }], error: null });
        return new Promise((resolve) => {
          signal.addEventListener('abort', () => resolve({ data: null, error: { message: `${signal.reason.name}: ${signal.reason.message}`, code: '' } }));
        });
      },
    };
    return query;
  };
  return { supabase: { from, storage: { from: () => ({}) } }, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { listProfileDocuments } = await import('./documents.js');
const { REQUEST_TIMEOUT_MS, isTimeoutError } = await import('./network.js');

afterEach(() => {
  vi.useRealTimers();
  db.calls.length = 0;
  db.stall = false;
});

describe('listProfileDocuments', () => {
  it('reads the account’s rows with a time limit, and clears it', async () => {
    vi.useFakeTimers();
    expect(await listProfileDocuments('u1')).toEqual([{ document_type: 'tobacco_license' }]);
    expect(db.calls[0]).toMatchObject({ table: 'profile_documents', eq: ['profile_id', 'u1'] });
    expect(db.calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('throws a timeout after 20 s instead of waiting for ever', async () => {
    vi.useFakeTimers();
    db.stall = true;
    const caught = listProfileDocuments('u1').catch((e) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(isTimeoutError(await caught)).toBe(true);
  });
});
