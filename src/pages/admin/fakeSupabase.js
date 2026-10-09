// A fake Supabase client for the admin tests (no network). Every chained
// query is recorded in `calls` and answered by `respond(request)` or, when
// that returns undefined, by the defaults below. Use it from a test as
//
//   vi.mock('../../lib/supabase.js', async () => {
//     const { createFakeSupabase } = await import('./fakeSupabase.js');
//     const fake = createFakeSupabase();
//     return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
//   });
//   const { fake } = await import('../../lib/supabase.js');
//
// and set fake.tables, fake.rpcData or fake.respond per test (fake.reset()
// clears them). A request looks like
//   { kind: 'from', table, op: 'select'|'update'|'insert'|'upsert'|'delete',
//     columns, options, patch, rows, filters: [['eq', 'id', 5], ...],
//     returning, single }
//   { kind: 'rpc', name, args, options, filters, ... }
//   { kind: 'storage', bucket, op: 'createSignedUrl', path, expiresIn, ... }
// Defaults: a select returns fake.tables[table] narrowed by its eq/in
// filters (with { count: 'exact' } also their count, and with head: true no
// rows); a write returns [{ id }] (the eq('id') value) when it asks for rows
// back, else null (an insert returns its rows); rpc returns
// fake.rpcData[name] ?? null; a signed URL is https://files.example.test/<path>
// and a public one https://fake.supabase.co/storage/v1/object/public/<bucket>/<path>
// (the shape the product editor accepts, AW-205).

const FILTERS = ['eq', 'neq', 'in', 'or', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'not', 'filter', 'match', 'contains', 'textSearch'];
const MODIFIERS = ['order', 'range', 'limit', 'abortSignal'];
const WRITES = ['update', 'insert', 'upsert', 'delete'];

const ok = (data) => ({ data, error: null });

function narrow(rows, filters) {
  return filters.reduce((list, [name, column, value]) => {
    if (name === 'eq') return list.filter((row) => !(column in row) || row[column] === value);
    if (name === 'in') return list.filter((row) => !(column in row) || (value || []).includes(row[column]));
    return list;
  }, rows);
}

export function createFakeSupabase(initial = {}) {
  const fake = {
    calls: [],
    tables: {},
    rpcData: {},
    respond: null,
    channels: [],
    reset() {
      fake.calls.length = 0;
      fake.channels.length = 0;
      fake.tables = { ...(initial.tables || {}) };
      fake.rpcData = { ...(initial.rpcData || {}) };
      fake.respond = initial.respond || null;
    },
    // The recorded requests that match, e.g. fake.find({ table: 'orders', op: 'update' }).
    find(match) {
      return fake.calls.filter((call) => Object.entries(match).every(([key, value]) => call[key] === value));
    },
  };

  const defaultResult = (request) => {
    if (request.kind === 'rpc') return ok(fake.rpcData[request.name] ?? null);
    if (request.kind === 'storage') {
      if (request.op === 'createSignedUrl') return ok({ signedUrl: `https://files.example.test/${request.path}` });
      return ok(null);
    }
    if (request.op === 'select') {
      const rows = narrow(fake.tables[request.table] || [], request.filters);
      const result = ok(request.options?.head ? null : (request.single ? (rows[0] ?? null) : rows));
      return request.options?.count ? { ...result, count: rows.length } : result;
    }
    if (!request.returning) return ok(null);
    const id = request.filters.find(([name, column]) => name === 'eq' && column === 'id')?.[2];
    if (request.op === 'insert' || request.op === 'upsert') {
      const rows = Array.isArray(request.rows) ? request.rows : [request.rows];
      return ok(request.single ? rows[0] : rows);
    }
    return ok(request.single ? { id } : [{ id }]);
  };

  const answer = (request) => {
    fake.calls.push(request);
    const custom = fake.respond ? fake.respond(request) : undefined;
    return Promise.resolve(custom === undefined ? defaultResult(request) : custom);
  };

  // One chainable query: every method records itself and returns the
  // builder; awaiting it answers the request.
  const builder = (request) => {
    const q = {
      select(columns = '*', options) {
        if (WRITES.includes(request.op)) request.returning = columns;
        else { request.op = request.op || 'select'; request.columns = columns; request.options = options; }
        return q;
      },
      update(patch, options) { request.op = 'update'; request.patch = patch; request.options = options; return q; },
      insert(rows, options) { request.op = 'insert'; request.rows = rows; request.options = options; return q; },
      upsert(rows, options) { request.op = 'upsert'; request.rows = rows; request.options = options; return q; },
      delete(options) { request.op = 'delete'; request.options = options; return q; },
      maybeSingle() { request.single = 'maybe'; return q; },
      single() { request.single = 'one'; return q; },
      then(resolve, reject) { return answer(request).then(resolve, reject); },
    };
    for (const name of FILTERS) q[name] = (...args) => { request.filters.push([name, ...args]); return q; };
    for (const name of MODIFIERS) q[name] = (...args) => { request.modifiers.push([name, ...args]); return q; };
    return q;
  };

  const client = {
    from: (table) => builder({ kind: 'from', table, op: null, filters: [], modifiers: [] }),
    rpc: (name, args, options) => builder({ kind: 'rpc', name, args, options, op: 'rpc', filters: [], modifiers: [] }),
    storage: {
      from: (bucket) => ({
        createSignedUrl: (path, expiresIn, options) => answer({ kind: 'storage', bucket, op: 'createSignedUrl', path, expiresIn, options }),
        upload: (path, file, options) => answer({ kind: 'storage', bucket, op: 'upload', path, file, options }),
        getPublicUrl: (path) => {
          fake.calls.push({ kind: 'storage', bucket, op: 'getPublicUrl', path });
          return { data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } };
        },
        remove: (paths) => answer({ kind: 'storage', bucket, op: 'remove', paths }),
      }),
    },
    channel(name) {
      const channel = {
        name,
        handlers: [],
        on(...args) { channel.handlers.push(args); return channel; },
        subscribe(callback) { callback?.('SUBSCRIBED'); return channel; },
        unsubscribe: async () => 'ok',
      };
      fake.channels.push(channel);
      return channel;
    },
    removeChannel: async (channel) => {
      const i = fake.channels.indexOf(channel);
      if (i !== -1) fake.channels.splice(i, 1);
      return 'ok';
    },
  };
  fake.client = client;
  fake.reset();
  return fake;
}
