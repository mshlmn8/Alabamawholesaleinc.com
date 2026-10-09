// The cart toast (AW-072, AW-042): a short message near the bottom of the
// window that confirms an add, with one action ("View quote"). App renders it
// once (src/components/Toast.jsx); anything can show one.
//
// One toast at a time: a new one replaces the last. showToast also speaks the
// text through the shared live region (announce(), src/lib/announce.js), so
// the toast itself is never a second live region and each event is spoken
// once. For a change that needs no toast, call announce() alone, never both.
//
// The store holds plain data only ({ id, text, action }, where action is
// { id, label } or null): the component maps an action id to what it does
// (App: 'open-cart' opens the cart drawer). Read it with
// useSyncExternalStore(subscribeToast, getToast).

import { announce } from './announce.js';

// How long a toast stays on screen; hovering or focusing it pauses this.
export const TOAST_MS = 6000;

let current = null;
let lastId = 0;
const listeners = new Set();

const emit = () => {
  for (const listener of [...listeners]) listener();
};

export function subscribeToast(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The toast on show, or null.
export function getToast() {
  return current;
}

// Shows `text` (replacing any toast on show) and speaks it once. Returns the
// new toast's id.
export function showToast({ text, action = null }) {
  lastId += 1;
  current = {
    id: lastId,
    text: String(text || ''),
    action: action ? { id: String(action.id), label: String(action.label) } : null,
  };
  announce(current.text);
  emit();
  return current.id;
}

// Hides the toast. With an id, only that toast: a timer that outlived its
// toast leaves a newer one alone.
export function dismissToast(id) {
  if (!current || (id != null && current.id !== id)) return;
  current = null;
  emit();
}
