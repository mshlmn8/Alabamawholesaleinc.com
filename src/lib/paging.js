// Every row of a PostgREST read, a page at a time (AW-199). Pure apart from
// the query builder it is handed (paging.test.js).
//
// PostgREST answers a read with at most its max-rows setting (1000 on
// Supabase) and says nothing about the rest, so a list read in one request
// silently stops at row 1000. fetchAllRows asks for ranges of `pageSize`
// rows until a page comes back short, or `max` rows are in:
//
//   const { data, error, status, truncated } = await fetchAllRows(
//     () => client.from('profiles').select('*').order('created_at', { ascending: false }).order('id'),
//   );
//
// makeQuery() is called again for each page (a builder is spent once it is
// awaited) and must order the rows deterministically, ending with a unique
// column (the id), or rows can repeat or go missing between pages.
// pageSize must not exceed the project's max-rows, or every page would look
// short. truncated: `max` rows came back, so there may be more.
// { data: null, error, status } on the first error, with the HTTP status
// (adminData.js withStatus reads it).

export const PAGE_SIZE = 1000;
export const MAX_ROWS = 20000;

export async function fetchAllRows(makeQuery, { pageSize = PAGE_SIZE, max = MAX_ROWS } = {}) {
  const data = [];
  let status = null;
  for (let from = 0; from < max; from += pageSize) {
    const to = Math.min(from + pageSize, max) - 1;
    let result;
    try {
      result = await makeQuery().range(from, to);
    } catch (error) {
      return { data: null, error, status: null, truncated: false };
    }
    if (result?.error) return { data: null, error: result.error, status: result.status ?? null, truncated: false };
    status = result?.status ?? status;
    const rows = Array.isArray(result?.data) ? result.data : [];
    data.push(...rows);
    if (rows.length < to - from + 1) return { data, error: null, status, truncated: false };
  }
  return { data, error: null, status, truncated: true };
}
