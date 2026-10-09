// The words a field shows under itself when the form it is in refuses to send
// (AW-173): what to do, in sentence case, read from the control's own
// constraint validation (el.validity) and its label. ValidatedForm in
// src/components/Field.jsx shows them instead of the browser's bubbles.
//
// Pure: it reads only the control it is given, so it works on a real
// element or a plain { type, validity, … } object in a test.

// 'Business email' → 'business email', 'ZIP' → 'ZIP', 'Federal EIN' →
// 'federal EIN': each word lower-cased unless it is an abbreviation in
// capitals.
export function lowerLabel(label) {
  return String(label || '').trim().split(/(\s+)/)
    .map((word) => (/[a-z]/.test(word) || word.replace(/[^A-Z]/g, '').length < 2 ? word.toLowerCase() : word))
    .join('');
}

// A control's label text, without the '(optional)' marker Field adds.
export function labelText(el) {
  const label = el?.labels?.[0];
  if (label) {
    return Array.from(label.childNodes)
      .filter((node) => !node.classList?.contains('field-optional'))
      .map((node) => node.textContent)
      .join('').replace(/\s+/g, ' ').trim();
  }
  return el?.getAttribute?.('aria-label') || '';
}

// What to tell the visitor about `el`, or '' when it is valid.
export function fieldErrorMessage(el, label = labelText(el)) {
  const v = el?.validity;
  if (!v || v.valid) return '';
  const type = el.type || '';
  const what = lowerLabel(label);
  if (v.valueMissing) {
    if (type === 'checkbox') return 'Check this box to continue';
    if (type === 'radio') return 'Choose an option';
    if (type === 'file') return 'Choose a file';
    if (/^select/.test(type)) return what ? `Choose ${what}` : 'Choose an option';
    return what ? `Enter ${what}` : 'Fill in this field';
  }
  if (v.badInput) return type === 'date' ? 'Enter a whole date, or clear the field' : 'Check this entry';
  if (v.typeMismatch) {
    if (type === 'email') return 'Enter an email address, for example name@yourstore.com';
    if (type === 'url') return 'Enter a web address, for example https://yourstore.com';
    return 'Check this entry';
  }
  if (v.patternMismatch) return el.title || (what ? `Check the format of ${what}` : 'Check the format of this entry');
  if (v.tooShort) return `Use at least ${el.minLength} characters`;
  if (v.tooLong) return `Use ${el.maxLength} characters or fewer`;
  // The one date field with a minimum, the quote's preferred date, starts at
  // today (todayInBirmingham in src/lib/orders.js).
  if (v.rangeUnderflow) return type === 'date' ? 'Choose today or a later date' : `Enter ${el.min} or more`;
  if (v.rangeOverflow) return type === 'date' ? 'Choose an earlier date' : `Enter ${el.max} or less`;
  if (v.stepMismatch) return 'Enter a whole number';
  return 'Check this entry';
}

// Every control in `form` that would stop it from sending, in page order, as
// [{ id, el, message }]: the browser's constraint checks (required, type,
// pattern, min…) through fieldErrorMessage, then the form's own checks,
// validate(form) → { id: message } (for example two passwords that differ),
// whose message wins for a control both flag.
export function formFieldErrors(form, validate) {
  const controls = Array.from(form?.elements || []);
  const found = new Map();
  for (const el of controls) {
    if (!el.willValidate || !el.validity || el.validity.valid) continue;
    const id = el.id || el.name;
    if (id && !found.has(id)) found.set(id, { id, el, message: fieldErrorMessage(el) });
  }
  for (const [id, message] of Object.entries(validate?.(form) || {})) {
    if (!message) continue;
    const el = controls.find((c) => c.id === id) || form.ownerDocument?.getElementById(id) || null;
    found.set(id, { id, el, message });
  }
  const position = ({ el }) => {
    const i = controls.indexOf(el);
    return i < 0 ? controls.length : i;
  };
  return [...found.values()].sort((a, b) => position(a) - position(b));
}
