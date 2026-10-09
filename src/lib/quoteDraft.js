// A draft of the quote form (AW-080), so what a buyer typed survives leaving
// /quote (a line's product link, the breadcrumb, Back) and a reload.
//
// The store keeps ONE record in sessionStorage (STORAGE.quoteDraft), for this
// tab only: { owner, data, savedAt }. `owner` is the cart owner App computes
// (cartOwner(): a user id, the saved session's id while the account loads,
// or 'guest'); a draft is read back only for the same owner. `data` holds the
// buyer's contact details and ship-to address, the delivery method, the
// preferred date and the notes, checked and cut to the form's limits on the
// way in and out; damaged values read as no draft. It never holds the
// tobacco license answers (licenseNo, resaleCert, purchasers21): like the
// application form (AuthModal), the attestation is given fresh each time.
// Where sessionStorage is blocked or full there is simply no draft.
//
// A draft holds contact details: never in a URL or a log. It is cleared on a
// successful submit (QuotePage) and on sign-out (App.handleLogout), and
// discarded when another account takes over the page.
//
// Precedence on /quote (plan/conflicts.md, AW-080 + AW-102 + AW-186 +
// AW-190): the empty form, then this owner's draft, then the profile, which
// fills only the fields still empty (src/lib/quoteForm.js).

import { useEffect, useRef } from 'react';
import { STORAGE } from '../data/content.js';
import { routeStateCode } from '../data/quoteRules.js';
import { GUEST } from './cartStorage.js';

const KEY = STORAGE.quoteDraft;
// How long after the last keystroke the draft is saved.
export const DRAFT_SAVE_MS = 300;

// Text fields kept, with the form's maxLength for each.
const TEXT_LIMITS = Object.freeze({
  business: 200, contact: 120, email: 254, phone: 40,
  shipStreet: 200, shipCity: 100, shipZip: 10, notes: 2000,
});
const DELIVERY = ['delivery', 'willcall'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const validOwner = (owner) => typeof owner === 'string' && owner.length > 0;

// The fields a draft may hold, from `data` (the form, or a stored draft):
// strings cut to their limit, a delivery method the form offers, a route
// state, a YYYY-MM-DD date. Anything else is left out, so the form keeps its
// own value for it. Never the license answers.
export function draftFields(data) {
  const out = {};
  if (!isPlainObject(data)) return out;
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (typeof data[field] === 'string') out[field] = data[field].slice(0, max);
  }
  if (DELIVERY.includes(data.delivery)) out.delivery = data.delivery;
  if (typeof data.shipState === 'string') out.shipState = data.shipState === '' ? '' : (routeStateCode(data.shipState) ?? '');
  if (typeof data.preferredDate === 'string' && (data.preferredDate === '' || DATE.test(data.preferredDate))) out.preferredDate = data.preferredDate;
  return out;
}

function sessionArea() {
  try {
    return window.sessionStorage || null;
  } catch {
    return null; // blocked site data, some private modes, sandboxed frames
  }
}

// The draft saved for `owner`, as form fields, or null.
export function readQuoteDraft(owner) {
  if (!validOwner(owner)) return null;
  try {
    const raw = sessionArea()?.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!isPlainObject(record) || record.owner !== owner || !isPlainObject(record.data)) return null;
    return draftFields(record.data);
  } catch {
    return null; // damaged value or blocked storage: no draft
  }
}

// Keeps `data` as `owner`'s draft, replacing any draft before it.
export function writeQuoteDraft(owner, data) {
  if (!validOwner(owner)) return;
  try {
    sessionArea()?.setItem(KEY, JSON.stringify({ owner, data: draftFields(data), savedAt: Date.now() }));
  } catch {
    // Full or blocked: no draft.
  }
}

// Bumped by every clear, so a save scheduled before it never brings the
// draft back.
let generation = 0;

// Forgets the draft (a successful submit, sign-out, another account).
export function clearQuoteDraft() {
  generation += 1;
  try {
    sessionArea()?.removeItem(KEY);
  } catch {
    // Blocked: there was nothing stored.
  }
}

function flush(pending) {
  const save = pending.current;
  pending.current = null;
  if (save && save.generation === generation) writeQuoteDraft(save.owner, save.data);
}

// Saves QuotePage's form as `owner`'s draft once the buyer has edited it:
// DRAFT_SAVE_MS after the last edit, and at once when the page goes (a link,
// Back, a reload or closing the tab). Returns { edited() } for the change
// handlers and { submitted() } for a successful submit.
//
// When the owner changes from an account to another one, or to a guest (a
// sign-out here or in another tab, an ended session), that account's draft
// is discarded. A guest who signs in keeps what is on the page; it is saved
// for the account on the next edit.
export function useQuoteDraft(owner, data) {
  const edited = useRef(false);
  const pending = useRef(null); // { owner, data, generation }
  const draftOwner = useRef(owner);

  useEffect(() => {
    const was = draftOwner.current;
    if (was === owner) return;
    draftOwner.current = owner;
    edited.current = false;
    pending.current = null;
    if (validOwner(was) && was !== GUEST) clearQuoteDraft();
  }, [owner]);

  useEffect(() => {
    if (!edited.current || !validOwner(owner)) return undefined;
    pending.current = { owner, data, generation };
    const timer = setTimeout(() => flush(pending), DRAFT_SAVE_MS);
    return () => clearTimeout(timer);
  }, [owner, data]);

  useEffect(() => {
    const onPageHide = () => flush(pending);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      flush(pending);
    };
  }, []);

  return {
    edited: () => { edited.current = true; },
    submitted: () => {
      edited.current = false;
      pending.current = null;
      clearQuoteDraft();
    },
  };
}
