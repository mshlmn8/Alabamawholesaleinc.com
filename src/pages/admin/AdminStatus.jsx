// What an admin action did (AW-202): one polite status line at the foot of
// the screen, with an optional Undo, that clears itself after 8 seconds
// (counted again from the start once the pointer or the focus leaves it, so
// an Undo being reached for doesn't vanish; AW-112).
// The <p role="status"> is always rendered, so screen readers announce each
// new message, and its text is its only child (Google Translate safety).
// Errors stay next to what failed, as role="alert" text; this is for
// successes.
//
// Admin-local for now: the commerce lane is building a site toast at the
// same time, and the two are meant to be unified when they merge.
//
//   const status = useAdminStatus();
//   status.show('Saved.', { undo: async () => { … }, undoLabel: 'Undo' });
//   <AdminStatus status={status} />

import { useCallback, useEffect, useState } from 'react';

export const STATUS_MS = 8000;
const FREE = { pointer: false, focus: false };

export function useAdminStatus(ms = STATUS_MS) {
  const [message, setMessage] = useState(null); // { text, undo, undoLabel }
  // The pointer or the focus is on the status line: it stays.
  const [held, setHeld] = useState(FREE);
  const holding = held.pointer || held.focus;
  // Each message starts unheld (a removed Undo button never says it lost
  // the focus).
  const clear = useCallback(() => {
    setMessage(null);
    setHeld(FREE);
  }, []);
  useEffect(() => {
    if (!message || holding) return undefined;
    const timer = setTimeout(clear, ms);
    return () => clearTimeout(timer);
  }, [message, ms, holding, clear]);
  const show = useCallback((text, { undo = null, undoLabel = 'Undo' } = {}) => {
    setMessage({ text, undo, undoLabel });
    setHeld(FREE);
  }, []);
  const hold = useCallback((how, on) => setHeld((h) => (h[how] === on ? h : { ...h, [how]: on })), []);
  return { message, show, clear, hold };
}

export function AdminStatus({ status }) {
  const { message, clear, hold } = status;
  const undo = () => {
    const action = message?.undo;
    clear();
    action?.();
  };
  return (
    <div className={`admin-status${message ? ' is-shown' : ''}`}
      onMouseEnter={() => hold?.('pointer', true)} onMouseLeave={() => hold?.('pointer', false)}
      onFocus={() => hold?.('focus', true)} onBlur={() => hold?.('focus', false)}>
      <p className="admin-status-text" role="status">{message ? message.text : ''}</p>
      {message?.undo && (
        <button className="button xs on-dark" type="button" onClick={undo}>{message.undoLabel}</button>
      )}
    </div>
  );
}

// A load that failed: what went wrong and a way to try again (AW-202), in
// place of an empty list.
export function LoadProblem({ message, onRetry, retrying = false }) {
  return (
    <div className="admin-load-problem" role="alert">
      <p className="form-error">{message}</p>
      <button className="button xs ghost" type="button" disabled={retrying} onClick={onRetry}>{retrying ? 'Trying again…' : 'Try again'}</button>
    </div>
  );
}
