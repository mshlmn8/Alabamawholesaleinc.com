// Admin -> Orders' Realtime client (AW-179): built in the admin code the way
// supabase-js builds it, and told about every sign-in, token refresh and
// sign-out. Tokens and addresses are test values.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from '@supabase/realtime-js';
import { realtimeFor, resetRealtimeForTests } from './realtime.js';

afterEach(() => resetRealtimeForTests());

function siteClient() {
  let listener = null;
  return {
    emit: (event, session) => listener(event, session),
    auth: { onAuthStateChange: vi.fn((callback) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; }) },
    realtimeSettings: () => ({
      url: 'wss://testproject.supabase.co/realtime/v1',
      key: 'test-anon-key',
      headers: { 'X-Client-Info': 'supabase-js/2.117.2; runtime=web' },
      fetch: vi.fn(),
      accessToken: vi.fn(async () => 'test-anon-key'),
    }),
  };
}

describe('realtimeFor', () => {
  it('uses a client that has channel() as it is, and needs a client', () => {
    const fake = { channel: vi.fn(), removeChannel: vi.fn() };
    expect(realtimeFor(fake)).toBe(fake);
    expect(realtimeFor(null)).toBeNull();
    expect(realtimeFor({})).toBeNull();
  });

  it('builds one RealtimeClient on the project’s socket, with the anon key as apikey', () => {
    const client = siteClient();
    const live = realtimeFor(client);
    expect(realtimeFor(client)).toBe(live);
    const channel = live.channel('admin-orders');
    expect(channel.topic).toBe('realtime:admin-orders');
    const socket = channel.socket;
    expect(socket).toBeInstanceOf(RealtimeClient);
    expect(socket.endpointURL()).toMatch(/^wss:\/\/testproject\.supabase\.co\/realtime\/v1\/websocket\?apikey=test-anon-key&vsn=/);
    expect(live.removeChannel(channel)).toBeInstanceOf(Promise);
  });

  it('sets the socket’s token on sign-in, refresh and sign-out, as supabase-js does', async () => {
    const setAuth = vi.spyOn(RealtimeClient.prototype, 'setAuth').mockResolvedValue(undefined);
    const client = siteClient();
    const live = realtimeFor(client);
    // At once, from the accessToken callback, so a channel joins with the token (ready()).
    expect(setAuth.mock.calls).toEqual([[]]);
    await expect(live.ready()).resolves.toBeUndefined();
    setAuth.mockClear();
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    client.emit('INITIAL_SESSION', { access_token: 'token-1' });
    client.emit('INITIAL_SESSION', { access_token: 'token-1' });
    client.emit('TOKEN_REFRESHED', { access_token: 'token-2' });
    client.emit('USER_UPDATED', { access_token: 'token-3' });
    client.emit('SIGNED_OUT', null);
    client.emit('SIGNED_IN', { access_token: 'token-4' });
    expect(setAuth.mock.calls).toEqual([['token-1'], ['token-2'], [], ['token-4']]);
  });
});
