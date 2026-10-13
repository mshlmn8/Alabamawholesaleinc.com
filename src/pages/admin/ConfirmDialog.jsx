// A confirmation for an admin action that discards or changes something
// (AW-118, AW-202): a title, what will happen, and two buttons. With
// `reasonLabel` it also asks for a reason, which it requires (unless
// `reasonOptional`: onConfirm then gets null for a blank one), at most
// `reasonMax` characters when that is set (AW-112). Focus starts on
// the cancel button; Escape, Back and the backdrop cancel; ModalLayer gives
// focus back to the control that opened it, or to `returnFocus` (a ref) when
// that holds an element at close: a confirmed change that removes its opener
// fills it in (NEW-004). historyEntry={false}: Back
// doesn't close it (its own history entry would be in the way when its
// confirm button leaves the page, as the product editor's do).
// children: more fields between the body and the buttons (the account to
// link a converted quote to, AW-024); their state stays with the caller.
//
// Admin-local for now: the commerce lane is building a site dialog and toast
// at the same time, and the two are meant to be unified when they merge.

import { useId, useRef, useState } from 'react';
import { ModalLayer } from '../../components/ModalLayer.jsx';

export function ConfirmDialog({
  title, body, confirmLabel, cancelLabel = 'Cancel', reasonLabel = null, reasonHint = null, reasonOptional = false, reasonMax = null,
  busy = false, onConfirm, onCancel, historyEntry = true, returnFocus = null, children = null,
}) {
  const id = useId();
  const cancelRef = useRef(null);
  const reasonRef = useRef(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const confirm = () => {
    if (!reasonLabel) {
      onConfirm();
      return;
    }
    const text = reason.trim();
    const problem = !text && !reasonOptional
      ? 'Enter a reason to continue.'
      : reasonMax && text.length > reasonMax
        ? `Keep it to ${reasonMax.toLocaleString('en-US')} characters or fewer (it has ${text.length.toLocaleString('en-US')}).`
        : '';
    if (problem) {
      setReasonError(problem);
      reasonRef.current?.focus();
      return;
    }
    onConfirm(text || null);
  };
  const describedBy = [reasonHint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ');

  return (
    <ModalLayer onClose={onCancel} initialFocus={cancelRef} returnFocus={returnFocus} historyEntry={historyEntry}>
      {/* Backdrop click is a mouse shortcut; Escape (ModalLayer) and the cancel button are the keyboard paths. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="overlay" onClick={onCancel}>
        {/* Keeps clicks inside the dialog from reaching the backdrop. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
        <div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}
          onClick={(e) => e.stopPropagation()}>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="desc" id={`${id}-body`}>{body}</p>
          {children}
          {reasonLabel && (
            <div className="form-grid confirm-reason">
              <div className="full">
                <label htmlFor={`${id}-reason`}>{reasonLabel}</label>
                <textarea
                  id={`${id}-reason`} ref={reasonRef} rows={3} required={!reasonOptional} value={reason}
                  aria-invalid={reasonError ? true : undefined} aria-describedby={describedBy}
                  onChange={(e) => { setReason(e.target.value); if (reasonError) setReasonError(''); }}
                />
                {reasonHint && <small className="field-hint" id={`${id}-hint`}>{reasonHint}</small>}
                <p className="form-error" id={`${id}-error`}>{reasonError}</p>
              </div>
            </div>
          )}
          <div className="dialog-actions">
            <button className="button" type="button" disabled={busy} onClick={confirm}>{confirmLabel}</button>
            <button className="button ghost" type="button" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
