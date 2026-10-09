// fetchAllRows (AW-199): ranges until a short page, a fresh builder per page,
// the first error with its status, and the row cap.
import { describe, expect, it } from 'vitest';
import { MAX_ROWS, PAGE_SIZE, fetchAllRows } from './paging.js';

// A fake table behind a builder that records each range it was asked for.
function fakeTable(count, { failAt = null } = {}) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
  const calls = [];
  const builders = new Set();
  const makeQuery = () => {
    const builder = {
      range(from, to) {
        builders.add(builder);
        calls.push([from, to]);
        if (failAt === from) return Promise.resolve({ data: null, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 });
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null, status: to - from + 1 < rows.length ? 206 : 200 });
      },
    };
    return builder;
  };
  return { makeQuery, calls, builders };
}

describe('fetchAllRows', () => {
  it('reads one page when the rows fit in it', async () => {
    const table = fakeTable(3);
    const result = await fetchAllRows(table.makeQuery);
    expect(result).toMatchObject({ error: null, truncated: false });
    expect(result.data.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(table.calls).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it('asks for the next range until a page comes back short, with a fresh builder each time', async () => {
    const table = fakeTable(2500);
    const result = await fetchAllRows(table.makeQuery);
    expect(result.data).toHaveLength(2500);
    expect(result.data.at(-1).id).toBe(2500);
    expect(table.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(table.builders.size).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it('asks once more when the last page was exactly full', async () => {
    const table = fakeTable(4);
    const result = await fetchAllRows(table.makeQuery, { pageSize: 2 });
    expect(table.calls).toEqual([[0, 1], [2, 3], [4, 5]]);
    expect(result.data).toHaveLength(4);
  });

  it('stops at max rows and says the list may go on', async () => {
    const table = fakeTable(25);
    const result = await fetchAllRows(table.makeQuery, { pageSize: 10, max: 15 });
    expect(table.calls).toEqual([[0, 9], [10, 14]]);
    expect(result.data).toHaveLength(15);
    expect(result.truncated).toBe(true);
    expect(MAX_ROWS).toBe(20000);
  });

  it('returns the first error with its HTTP status, and no rows', async () => {
    const table = fakeTable(30, { failAt: 10 });
    const result = await fetchAllRows(table.makeQuery, { pageSize: 10 });
    expect(result).toEqual({ data: null, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401, truncated: false });
    expect(table.calls).toEqual([[0, 9], [10, 19]]);
  });

  it('turns a thrown builder into an error result', async () => {
    const boom = new TypeError('Failed to fetch');
    const result = await fetchAllRows(() => ({ range: () => Promise.reject(boom) }));
    expect(result).toEqual({ data: null, error: boom, status: null, truncated: false });
  });
});
