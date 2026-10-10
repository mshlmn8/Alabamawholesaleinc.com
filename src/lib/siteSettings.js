// The site's contact facts as staff set them in Admin -> Site settings
// (AW-030): the announcement bar's messages, the public phone and email, the
// hours and the address, from public.site_settings
// (supabase/migrations/20261014121000_site_settings.sql), with content.js's
// values until they arrive and whenever they can't (src/data/siteFacts.js).
//
//   useSite()               the facts to print (siteFacts' shape); re-renders
//                           only when they change
//   refreshSiteSettings()   loads the row again (Admin, after a save)
//   showSiteSettings(row)   shows a row at once (Admin's saved row)
//
// - One load per page load, the first time a component reads the facts (the
//   trade bar does, on every page). Nothing is remembered between page
//   loads: localStorage holds only the cart and the age confirmation.
// - A missing table (a database without 20261014121000: PGRST205 or 42P01),
//   any other error, a timeout or no backend keep content.js's values.
// - currentSite() (siteFacts.js) follows the store, for the error messages,
//   the order email and the will-call address an order sends.

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_SITE, setCurrentSite, siteFacts } from '../data/siteFacts.js';
import { isMissingSchema } from '../pages/admin/adminData.js';
import { CATALOG_TIMEOUT_MS } from './catalog.jsx';
import { supabase as defaultClient } from './supabase.js';

export const SITE_SETTINGS_COLUMNS = 'announcements,phone,email,hours,street,city,state,zip,updated_at';
export const SITE_SETTINGS_TIMEOUT_MS = CATALOG_TIMEOUT_MS;

// status: 'default' (nothing loaded yet) | 'loading' | 'live' | 'missing' (no
// table) | 'error' | 'static' (no backend). row: the last row read (null for none).
let client = defaultClient;
let state = { site: DEFAULT_SITE, row: null, status: 'default' };
let started = false;
let inflight = null;
let signature = 'null';
const listeners = new Set();

const setState = (next) => {
  state = next;
  setCurrentSite(next.site);
  for (const listener of listeners) listener();
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getSiteSettingsState = () => state;

// A row on screen: the same values keep the same facts object, so nothing
// re-renders.
function show(row, status) {
  const next = JSON.stringify(row ?? null);
  if (next === signature) {
    if (state.status !== status) setState({ ...state, status });
    return;
  }
  signature = next;
  setState({ site: row ? siteFacts(row) : DEFAULT_SITE, row: row ?? null, status });
}

function load(force = false) {
  if (!client) {
    if (state.status !== 'static') setState({ ...state, status: 'static' });
    return Promise.resolve(state);
  }
  if (inflight) return inflight;
  if (started && !force) return Promise.resolve(state);
  started = true;
  const from = client;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SITE_SETTINGS_TIMEOUT_MS) : 0;
  if (state.status === 'default') setState({ ...state, status: 'loading' });
  const run = (async () => {
    try {
      let query = from.from('site_settings').select(SITE_SETTINGS_COLUMNS).eq('id', true);
      if (controller) query = query.abortSignal(controller.signal);
      const { data, error } = await query.maybeSingle();
      if (from !== client) return state; // reset meanwhile (tests)
      if (error) setState({ ...state, status: isMissingSchema(error) ? 'missing' : 'error' });
      else show(data, 'live');
    } catch {
      if (from === client) setState({ ...state, status: 'error' });
    } finally {
      clearTimeout(timer);
      if (from === client) inflight = null;
    }
    return state;
  })();
  inflight = run;
  return run;
}

const getSite = () => state.site;
export function useSite() {
  const site = useSyncExternalStore(subscribe, getSite, getSite);
  useEffect(() => { load(); }, []);
  return site;
}

export const refreshSiteSettings = () => load(true);
export const showSiteSettings = (row) => show(row, 'live');

// Tests: back to content.js's values, nothing loaded, with `client` (null for
// no backend; the app's Supabase client when left out).
export function resetSiteSettingsForTests({ client: next = defaultClient } = {}) {
  client = next;
  started = false;
  inflight = null;
  signature = 'null';
  setState({ site: DEFAULT_SITE, row: null, status: 'default' });
}
