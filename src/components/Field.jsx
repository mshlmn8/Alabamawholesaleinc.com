// One way to lay out a form field and show what is wrong with it (AW-173),
// instead of the browser's validation bubbles, which vanish after a moment,
// flag one field at a time and leave nothing for a screen reader.
//
//   <ValidatedForm onSubmit={send} validate={(form) => ({ id: message })}>
//     <Field id="quote-business" label="Business"><input id="quote-business" required … /></Field>
//     <Field id="quote-notes" label="Notes" optional full><input id="quote-notes" … /></Field>
//     <Field id="quote-age" label="I confirm …" inline><input id="quote-age" type="checkbox" required … /></Field>
//   </ValidatedForm>
//
// ValidatedForm is a <form noValidate>. On submit it checks every control
// (required, type, pattern, min/max, minlength, plus the optional
// validate(form)); when one fails it shows each message under its field,
// moves focus to the first, and does not call onSubmit. A field's message
// goes when that field changes, and all of them on the next good submit.
//
// Field renders the label (with a muted ' (optional)' when optional), the
// control, the hint (small#<id>-hint) and the error (p#<id>-error, always
// there and empty until needed, so translated pages keep working). The
// control gets aria-invalid and an aria-describedby that adds the hint and
// the error to its own ids. An aria-invalid the page already sets (a server
// refusal about that field) is kept. `inline` is a checkbox row: the box,
// then its running-text label. `full` spans both columns of .form-grid;
// `className` adds others to the field's box (the quote form's 'half').
// A control that lays itself out (PasswordField) reads its message with
// useFieldError(id) and renders the same p#<id>-error.
// Messages come from src/lib/fieldErrors.js. Required fields are not marked
// one by one: the form says 'All fields are required unless marked
// optional.' and the others say '(optional)'.

import { Children, cloneElement, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formFieldErrors } from '../lib/fieldErrors.js';
import { announce } from '../lib/announce.js';

const FieldErrors = createContext(null);
const NO_ERRORS = {};

// Space-separated ids, each once, in order.
const idList = (...lists) => [...new Set(lists.flatMap((ids) => String(ids || '').split(/\s+/)).filter(Boolean))].join(' ');

export function ValidatedForm({ onSubmit, validate, onChange, children, ...props }) {
  const [errors, setErrors] = useState(NO_ERRORS);
  // The control to focus once its message and aria-invalid are on the page,
  // so a screen reader reads them with it.
  const focusNext = useRef(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    const el = focusNext.current;
    focusNext.current = null;
    el?.focus?.();
  }, [focusRequest]);

  const handleSubmit = (event) => {
    const found = formFieldErrors(event.currentTarget, validate);
    if (found.length) {
      event.preventDefault();
      setErrors(Object.fromEntries(found.map(({ id, message }) => [id, message])));
      focusNext.current = found[0].el;
      setFocusRequest((n) => n + 1);
      // Focus reads the message out with the field; a field that already has
      // focus (Enter pressed in it) is not read again, so say it (AW-247).
      if (found[0].el && found[0].el === found[0].el.ownerDocument?.activeElement) announce(found[0].message);
      return;
    }
    setErrors(NO_ERRORS);
    onSubmit?.(event);
  };
  // Changing a field takes its message away.
  const handleChange = (event) => {
    const { id } = event.target;
    setErrors((current) => {
      if (!id || !current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    onChange?.(event);
  };
  const context = useMemo(() => ({ errors }), [errors]);

  return (
    <FieldErrors.Provider value={context}>
      <form noValidate {...props} onSubmit={handleSubmit} onChange={handleChange}>{children}</form>
    </FieldErrors.Provider>
  );
}

// The field's control with its aria attributes added. A component of its own,
// so the markup below holds an element, not a function's result.
function Control({ element, ...aria }) {
  return cloneElement(element, aria);
}

// The message ValidatedForm has for control `id`, '' when none (or outside
// a ValidatedForm).
export function useFieldError(id) {
  const errors = useContext(FieldErrors)?.errors || NO_ERRORS;
  return errors[id] || '';
}

export function Field({ id, label, hint, full = false, optional = false, inline = false, className, children }) {
  const error = useFieldError(id);
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const child = Children.only(children);
  const describedBy = idList(child.props['aria-describedby'], hintId, error ? errorId : null);
  const control = (
    <Control element={child} id={child.props.id || id}
             aria-invalid={error ? true : child.props['aria-invalid']} aria-describedby={describedBy || undefined} />
  );
  const labelEl = optional
    ? <label htmlFor={id}><span>{label}</span><span className="field-optional"> (optional)</span></label>
    : <label htmlFor={id}>{label}</label>;

  return (
    <div className={[full && 'full', className].filter(Boolean).join(' ') || undefined}>
      {inline ? <div className="consent">{control}{labelEl}</div> : labelEl}
      {inline ? null : control}
      {hint && <small className="field-hint" id={hintId}>{hint}</small>}
      <p className="form-error field-error" id={errorId}>{error}</p>
    </div>
  );
}
