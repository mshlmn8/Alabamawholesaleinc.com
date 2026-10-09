// A password box with its label, a Show/Hide button beside it and, for a new
// password, the length rule under it that says when it is met (AW-248). Used
// by the sign-in and application forms in AuthModal and by /reset-password.
//
// The button sits beside the box, not over it: a field takes no padding of
// its own (one field system). Its name says what it will do, 'Show password'
// or 'Hide password', so it needs no aria-pressed. The password is hidden
// again when its form is submitted, so it is not left on screen.

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

// TODO(owner): Does the Supabase Auth password policy require more than 8 characters (character classes, leaked-password protection)? The forms check the length only; stricter server rules come back as a friendly weak-password message. (AW-248)
export const PASSWORD_MIN_LENGTH = 8;
const RULE = `At least ${PASSWORD_MIN_LENGTH} characters`;
const RULE_MET = `${RULE}: done`;

export function PasswordField({
  id, label, value, onChange, autoComplete, required = false, minLength, hint, showRule = false, inputRef, className,
  'aria-describedby': describedByMore, ...inputProps
}) {
  const [shown, setShown] = useState(false);
  const input = useRef(null);
  // inputRef (an object or a callback) gets the <input>, for focus().
  useImperativeHandle(inputRef, () => input.current, []);

  // Hidden again on submit, whether the form goes through or not.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return undefined;
    const hide = () => setShown(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  const met = String(value ?? '').length >= PASSWORD_MIN_LENGTH;
  // The hint and rule, then anything the caller adds (an error's id).
  const describedBy = [hint && `${id}-hint`, showRule && `${id}-rule`, describedByMore].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          {...inputProps}
          ref={input}
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={describedBy}
        />
        <button className="button ghost sm pw-toggle" type="button" aria-controls={id} onClick={() => setShown((s) => !s)}>
          <span>{shown ? 'Hide' : 'Show'}</span>{' '}<span className="sr-only">password</span>
        </button>
      </div>
      {hint && <small className="field-hint" id={`${id}-hint`}>{hint}</small>}
      {showRule && (
        <p className="field-hint pw-rule" id={`${id}-rule`} aria-live="polite">
          {met && <Icon name="check" />}
          <span>{met ? RULE_MET : RULE}</span>
        </p>
      )}
    </div>
  );
}
