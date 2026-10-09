// What an admin action did (AW-202): one polite status line at the foot of
// the screen, with an optional Undo, that clears itself after 8 seconds.
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

export function useAdminStatus(ms = STATUS_MS) {
  const [message, setMessage] = useState(null); // { text, undo, undoLabel }
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), ms);
    return () => clearTimeout(timer);
  }, [message, ms]);
  const show = useCallback((text, { undo = null, undoLabel = 'Undo' } = {}) => setMessage({ text, undo, undoLabel }), []);
  const clear = useCallback(() => setMessage(null), []);
  return { message, show, clear };
}

export function AdminStatus({ status }) {
  const { message, clear } = status;
  const undo = () => {
    const action = message?.undo;
    clear();
    action?.();
  };
  return (
    <div className={`admin-status${message ? ' is-shown' : ''}`}>
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
