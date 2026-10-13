// The toast (AW-072, AW-042): what src/lib/toast.js holds, drawn near the
// bottom of the window. App renders it once; onAction(actionId) runs the
// action ('open-cart' opens the cart drawer).
//
// - It lives in its own <div id="aw-toasts"> directly in <body>, outside
//   #root and the dialog layers (#aw-layers): a dialog makes #root inert,
//   and the toast must not change under it. A dialog's scrim covers it
//   (.toast-root sits below .aw-layer).
// - It never takes focus and is not a live region: showToast() speaks the
//   text through the shared announce(), so each event is heard once.
// - While it shows, .toast-root is a landmark, a region named Notifications
//   (NEW-042): the host sits outside main, the header and the footer, and
//   content outside every landmark is skipped by landmark navigation (axe
//   'region'). The landmark goes with the toast, so no empty one is left.
//   Keyboard users reach its buttons with Tab (it is last in the page); when
//   the toast goes away under focus, focus goes back to the control it came
//   from, never to <body>.
// - It hides after TOAST_MS. Hovering or focusing it pauses that, and the
//   time starts again when the pointer and focus leave (WCAG 2.2.1).
// - When it would cover the control that has focus (an add button low on a
//   phone screen), the page scrolls that control clear of it (WCAG 2.4.11).

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { TOAST_MS, dismissToast, getToast, subscribeToast } from '../lib/toast.js';
import { focusPageHeading } from '../lib/router.js';
import { Icon } from './Icon.jsx';

const HOST_ID = 'aw-toasts';
// Space kept between the toast and a control scrolled clear of it.
const CLEARANCE = 12;

let host = null;

function toastHost() {
  if (host && host.isConnected) return host;
  host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

// Scrolls the page so the focused control on it isn't under the toast. The
// toast's place is read without its entry animation's offset (offsetTop
// within the fixed .toast-root ignores transforms).
function uncover(box) {
  const active = document.activeElement;
  const page = document.getElementById('root');
  if (!box || !active || !page || !page.contains(active)) return;
  const control = active.getBoundingClientRect();
  const rect = box.getBoundingClientRect();
  const top = (box.offsetParent ? box.offsetParent.getBoundingClientRect().top : rect.top) + box.offsetTop;
  const bottom = top + box.offsetHeight;
  const across = control.left < rect.right && control.right > rect.left;
  const covered = control.bottom > top - CLEARANCE && control.top < bottom;
  if (across && covered) window.scrollBy(0, control.bottom - top + CLEARANCE);
}

export function Toast({ onAction }) {
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast);
  const id = toast?.id ?? null;
  // The toast the pointer is over and the one focus is in, by id, so a new
  // toast starts with its full time.
  const [hoverId, setHoverId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const paused = id != null && (hoverId === id || focusId === id);
  const boxRef = useRef(null);
  // The last control focused outside the toast, where focus goes back to.
  const lastOutside = useRef(null);

  useEffect(() => {
    const note = (event) => {
      const el = event.target;
      if (el instanceof Element && !el.closest(`#${HOST_ID}`)) lastOutside.current = el;
    };
    document.addEventListener('focusin', note);
    return () => document.removeEventListener('focusin', note);
  }, []);

  useEffect(() => {
    if (id == null || paused) return undefined;
    const timer = window.setTimeout(() => dismissToast(id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [id, paused]);

  // After the page has moved focus for this change (the card's stepper).
  useEffect(() => {
    if (id == null) return undefined;
    const frame = window.requestAnimationFrame(() => uncover(boxRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [id]);

  if (!toast) return null;

  // Focus inside the toast goes back to the page before the toast goes.
  const returnFocus = () => {
    if (!boxRef.current?.contains(document.activeElement)) return;
    const back = lastOutside.current;
    if (back?.isConnected) {
      back.focus({ preventScroll: true });
      if (document.activeElement === back) return;
    }
    focusPageHeading();
  };
  const runAction = () => {
    returnFocus();
    dismissToast(id);
    onAction?.(toast.action.id);
  };
  const close = () => {
    returnFocus();
    dismissToast(id);
  };
  const blur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusId(null);
  };

  return createPortal(
    <div className="toast-root" role="region" aria-label="Notifications">
      {/* Keyed by toast, so a repeat of the same message shows again. */}
      <div className="toast" key={id} ref={boxRef}
           onMouseEnter={() => setHoverId(id)} onMouseLeave={() => setHoverId(null)}
           onFocus={() => setFocusId(id)} onBlur={blur}>
        <p className="toast-text">{toast.text}</p>
        {toast.action && <button className="button on-dark sm toast-action" type="button" onClick={runAction}>{toast.action.label}</button>}
        <button className="icon-btn toast-close" type="button" onClick={close} aria-label="Dismiss"><Icon name="close" /></button>
      </div>
    </div>,
    toastHost(),
  );
}
