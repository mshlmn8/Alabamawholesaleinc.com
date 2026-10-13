// The site's Supabase client (AW-179): built from auth-js and postgrest-js
// the way supabase-js's createClient builds it, with Storage loaded on
// demand. Requests go to a stand-in fetch; the URL, key and tokens are test
// values.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthClient } from '@supabase/auth-js';
import { AUTH_STORAGE_KEY, CLIENT_INFO, SUPABASE_JS_VERSION, createSiteClient } from './supabase.js';
import { preloadStorage, storageOf } from './storageClient.js';

const URL_ = 'https://testproject.supabase.co';
const KEY = 'test-anon-key';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clients = [];
function makeClient(respond = () => json([])) {
  const calls = [];
  const fetchImpl = vi.fn(async (input, init) => {
    calls.push({ url: String(input), method: init?.method || 'GET', headers: new Headers(init?.headers), body: init?.body });
    return respond(String(input), init);
  });
  const client = createSiteClient(URL_, KEY, { fetchImpl });
  clients.push(client);
  return { client, calls, fetchImpl };
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.auth.stopAutoRefresh?.();
    client.auth.broadcastChannel?.close?.();
  }
  localStorage.clear();
});

const readJson = (path) => JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));

describe('the packages', () => {
  it('pins auth-js, postgrest-js, realtime-js and storage-js to the versions supabase-js 2.117.2 used, and nothing else from Supabase', () => {
    const { dependencies } = readJson('package.json');
    const supabase = Object.keys(dependencies).filter((name) => name.startsWith('@supabase/')).sort();
    expect(supabase).toEqual(['@supabase/auth-js', '@supabase/postgrest-js', '@supabase/realtime-js', '@supabase/storage-js']);
    for (const name of supabase) {
      expect(dependencies[name], name).toBe(SUPABASE_JS_VERSION);
      expect(readJson(`node_modules/${name}/package.json`).version, name).toBe(SUPABASE_JS_VERSION);
    }
    expect(CLIENT_INFO).toBe('supabase-js/2.117.2; runtime=web');
  });
});

describe('createSiteClient', () => {
  it('signs in with auth-js, keeping the session under aw-auth, with email links left to authLink.js', () => {
    const { client } = makeClient();
    expect(client.auth).toBeInstanceOf(AuthClient);
    expect(AUTH_STORAGE_KEY).toBe('aw-auth');
    expect(client.auth).toMatchObject({
      storageKey: 'aw-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit',
      url: `${URL_}/auth/v1`,
    });
    expect(client.auth.headers).toMatchObject({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'X-Client-Info': CLIENT_INFO });
    // Nothing here is supabase-js's createClient: no Realtime, Storage or Functions until asked.
    expect(client).not.toHaveProperty('realtime');
    expect(client).not.toHaveProperty('storage');
    expect(client).not.toHaveProperty('functions');
    expect(() => createSiteClient('', KEY)).toThrow();
  });

  it('queries PostgREST at /rest/v1 with the apikey and, signed out, the anon key as the bearer', async () => {
    const { client, calls } = makeClient(() => json([{ id: 1 }]));
    const { data, error } = await client.from('products').select('id').eq('active', true);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1 }]);
    expect(calls[0].url).toBe(`${URL_}/rest/v1/products?select=id&active=eq.true`);
    expect(calls[0].headers.get('apikey')).toBe(KEY);
    expect(calls[0].headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(calls[0].headers.get('x-client-info')).toBe(CLIENT_INFO);
  });

  it('sends the signed-in session’s token as the bearer', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('aw-auth', JSON.stringify({
      access_token: 'session-token', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'buyer@example.test', app_metadata: {}, user_metadata: {} },
    }));
    const { client, calls } = makeClient(() => json(null));
    await client.rpc('my_prices', {}, { get: true });
    const call = calls.find((c) => c.url.includes('/rest/v1/'));
    expect(call.url).toBe(`${URL_}/rest/v1/rpc/my_prices`);
    expect(call.method).toBe('GET');
    expect(call.headers.get('authorization')).toBe('Bearer session-token');
    expect(call.headers.get('apikey')).toBe(KEY);
  });

  it('calls a function with POST by default, and the schema of the database API', async () => {
    const { client, calls } = makeClient(() => json({ ok: true }));
    await client.rpc('submit_quote', { p_items: [] });
    expect(calls[0]).toMatchObject({ url: `${URL_}/rest/v1/rpc/submit_quote`, method: 'POST', body: '{"p_items":[]}' });
    await client.schema('public').from('orders').select('id');
    expect(calls[1].url).toBe(`${URL_}/rest/v1/orders?select=id`);
  });

  it('loads Storage the first time it is needed, at /storage/v1 with the same headers', async () => {
    const { client, calls } = makeClient(() => json({ Key: 'application-documents/u1/x.pdf' }));
    const [first, second] = await Promise.all([client.loadStorage(), client.loadStorage()]);
    expect(first).toBe(second);
    expect(client.storage).toBe(first);
    expect(await storageOf(client)).toBe(first);
    const { error } = await first.from('application-documents').upload('u1/tobacco_license/1-x.pdf', new Blob(['%PDF']), { upsert: false, contentType: 'application/pdf' });
    expect(error).toBeNull();
    expect(calls[0].url).toBe(`${URL_}/storage/v1/object/application-documents/u1/tobacco_license/1-x.pdf`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers.get('apikey')).toBe(KEY);
    expect(calls[0].headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(first.from('product-images').getPublicUrl('products/1/a.jpg').data.publicUrl)
      .toBe(`${URL_}/storage/v1/object/public/product-images/products/1/a.jpg`);
  });

  it('gives Admin’s Realtime the socket address, the key and the session token', async () => {
    const { client } = makeClient();
    const settings = client.realtimeSettings();
    expect(settings.url).toBe('wss://testproject.supabase.co/realtime/v1');
    expect(settings.key).toBe(KEY);
    expect(settings.headers).toEqual({ 'X-Client-Info': CLIENT_INFO });
    expect(await settings.accessToken()).toBe(KEY);
  });
});

describe('storageOf / preloadStorage', () => {
  it('uses a client’s Storage as it is, loads it when it can, and says so when there is none', async () => {
    const fake = { storage: { from: vi.fn() } };
    expect(await storageOf(fake)).toBe(fake.storage);
    const loaded = { from: vi.fn() };
    const lazy = { loadStorage: vi.fn(async () => loaded) };
    expect(await storageOf(lazy)).toBe(loaded);
    await expect(storageOf(null)).rejects.toThrow(/storage/i);
    await expect(storageOf({})).rejects.toThrow(/storage/i);
  });

  it('preloads quietly, once loaded or without a loader does nothing', async () => {
    const failing = { loadStorage: vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))) };
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    preloadStorage(failing);
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(failing.loadStorage).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    const ready = { storage: {}, loadStorage: vi.fn() };
    preloadStorage(ready);
    expect(ready.loadStorage).not.toHaveBeenCalled();
    expect(() => preloadStorage(null)).not.toThrow();
  });
});
