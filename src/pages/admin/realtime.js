// Realtime for Admin -> Orders (AW-111), and only there (AW-179): the site's
// Supabase client (src/lib/supabase.js) leaves Realtime and its Phoenix
// socket out, so storefront visitors never download them. This file, part of
// the admin code, builds the RealtimeClient the way supabase-js's
// createClient does (supabase-js 2.117.2): the project's /realtime/v1
// socket with the anon key as apikey, the signed-in session's token through
// the accessToken callback, and setAuth() on every sign-in, token refresh
// and sign-out, so the socket always speaks as the admin who is signed in.
//
//   realtimeFor(client)  { channel, removeChannel, removeAllChannels, ready }
//                        for useLiveOrders (liveOrders.js); a client that has
//                        channel() already (a test's fake, or supabase-js)
//                        is used as it is; null without a client. ready()
//                        resolves once the socket has the session's token:
//                        supabase-js sets it at start, long before a channel
//                        joins, so a channel joins as the admin, never as a
//                        guest first; subscribeOrders waits for it.

import { RealtimeClient } from '@supabase/realtime-js';

let shared = null; // { client, live }

export function realtimeFor(client) {
  if (!client) return null;
  if (typeof client.channel === 'function') return client;
  if (typeof client.realtimeSettings !== 'function') return null;
  if (shared?.client === client) return shared.live;
  const { url, key, headers, fetch, accessToken } = client.realtimeSettings();
  const realtime = new RealtimeClient(url, { headers, accessToken, fetch, params: { apikey: key } });
  // supabase-js's _handleTokenChanged.
  let token;
  client.auth?.onAuthStateChange?.((event, session) => {
    const next = session?.access_token;
    if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && token !== next) {
      token = next;
      Promise.resolve(realtime.setAuth(next)).catch(() => {});
    } else if (event === 'SIGNED_OUT') {
      Promise.resolve(realtime.setAuth()).catch(() => {});
      token = undefined;
    }
  });
  // The token now, from the accessToken callback (the session's, else the anon key).
  const ready = Promise.resolve(realtime.setAuth()).catch(() => {});
  const live = {
    ready: () => ready,
    channel: (name, options = { config: {} }) => realtime.channel(name, options),
    removeChannel: (channel) => realtime.removeChannel(channel),
    removeAllChannels: () => realtime.removeAllChannels(),
  };
  shared = { client, live };
  return live;
}

export function resetRealtimeForTests() {
  shared = null;
}
