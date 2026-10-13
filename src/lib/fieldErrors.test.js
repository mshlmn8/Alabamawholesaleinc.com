// The messages a refused form shows under its fields (AW-173), from each
// control's constraint validation.
import { describe, expect, it } from 'vitest';
import { asSentence, fieldErrorMessage, formFieldErrors, labelText, lowerLabel } from './fieldErrors.js';

const VALID = { valid: true };
// A control as fieldErrorMessage sees it: its type, validity flags and the
// attributes some messages quote.
const control = (type, flags, attrs = {}) => ({ type, validity: { valid: false, ...flags }, ...attrs });

describe('lowerLabel', () => {
  it('lower-cases words but keeps abbreviations in capitals', () => {
    expect(lowerLabel('Business email')).toBe('business email');
    expect(lowerLabel('ZIP')).toBe('ZIP');
    expect(lowerLabel('Federal EIN')).toBe('federal EIN');
    expect(lowerLabel('State tobacco/retail license #')).toBe('state tobacco/retail license #');
    expect(lowerLabel('  Your name ')).toBe('your name');
    expect(lowerLabel('')).toBe('');
  });
});

describe('fieldErrorMessage', () => {
  it('says nothing about a valid control', () => {
    expect(fieldErrorMessage({ type: 'text', validity: VALID }, 'Business')).toBe('');
    expect(fieldErrorMessage(null, 'Business')).toBe('');
  });

  // Every message is a sentence ending in a period (NEW-069).
  it('asks for a missing answer by its label, and to tick a required box', () => {
    expect(fieldErrorMessage(control('text', { valueMissing: true }), 'Business')).toBe('Enter business.');
    expect(fieldErrorMessage(control('email', { valueMissing: true }), 'Business email')).toBe('Enter business email.');
    expect(fieldErrorMessage(control('text', { valueMissing: true }), 'ZIP')).toBe('Enter ZIP.');
    expect(fieldErrorMessage(control('checkbox', { valueMissing: true }), 'I am 21 or older')).toBe('Check this box to continue.');
    expect(fieldErrorMessage(control('select-one', { valueMissing: true }), 'Store state')).toBe('Choose store state.');
    expect(fieldErrorMessage(control('text', { valueMissing: true }), '')).toBe('Fill in this field.');
  });

  it('uses a control’s own data-required-message for an empty answer, before its label (NEW-069)', () => {
    const resale = control('text', { valueMissing: true }, { dataset: { requiredMessage: 'Enter the resale certificate number.' } });
    expect(fieldErrorMessage(resale, 'Resale certificate #')).toBe('Enter the resale certificate number.');
    // Read as an attribute too, and made a sentence.
    const phone = control('tel', { valueMissing: true }, { getAttribute: (name) => (name === 'data-required-message' ? 'Enter a phone number' : null) });
    expect(fieldErrorMessage(phone, 'Phone')).toBe('Enter a phone number.');
    // Only for an empty answer: a mistyped one still gets its format.
    const typed = control('tel', { patternMismatch: true }, { dataset: { requiredMessage: 'Enter a phone number.' }, title: 'Enter a 10-digit US phone number.' });
    expect(fieldErrorMessage(typed, 'Phone')).toBe('Enter a 10-digit US phone number.');
  });

  it('gives an example email address', () => {
    expect(fieldErrorMessage(control('email', { typeMismatch: true }), 'Email')).toBe('Enter an email address, for example name@yourstore.com.');
  });

  it('reads a format problem from the field’s title, as a sentence', () => {
    const ein = control('text', { patternMismatch: true }, { title: 'Enter the 9-digit EIN, for example 12-3456789.' });
    expect(fieldErrorMessage(ein, 'Federal EIN')).toBe('Enter the 9-digit EIN, for example 12-3456789.');
    const zip = control('text', { patternMismatch: true }, { title: 'Enter a 5-digit ZIP code, or ZIP+4' });
    expect(fieldErrorMessage(zip, 'ZIP')).toBe('Enter a 5-digit ZIP code, or ZIP+4.');
    expect(fieldErrorMessage(control('text', { patternMismatch: true }, { title: '' }), 'State')).toBe('Check the format of state.');
  });

  it('names the length limits', () => {
    expect(fieldErrorMessage(control('password', { tooShort: true }, { minLength: 8 }), 'Password')).toBe('Use at least 8 characters.');
    expect(fieldErrorMessage(control('text', { tooLong: true }, { maxLength: 64 }), 'Notes')).toBe('Use 64 characters or fewer.');
  });

  it('asks for today or later on a date before the minimum, and a whole date for a half-typed one', () => {
    expect(fieldErrorMessage(control('date', { rangeUnderflow: true }, { min: '2026-10-09' }), 'Preferred date')).toBe('Choose today or a later date.');
    expect(fieldErrorMessage(control('date', { badInput: true }), 'Preferred date')).toBe('Enter a whole date, or clear the field.');
    expect(fieldErrorMessage(control('number', { rangeUnderflow: true }, { min: '1' }), 'Quantity')).toBe('Enter 1 or more.');
  });

  it('asSentence ends a text with a period unless it already ends a sentence', () => {
    expect(asSentence('Digits only')).toBe('Digits only.');
    expect(asSentence('Digits only.')).toBe('Digits only.');
    expect(asSentence(' Really? ')).toBe('Really?');
    expect(asSentence('')).toBe('');
    expect(asSentence(null)).toBe('');
  });

  it('works on real fields, reading the label without the optional marker', () => {
    document.body.innerHTML = `
      <label for="a">Business email</label><input id="a" type="email" required>
      <label for="b"><span>Notes</span><span class="field-optional"> (optional)</span></label><input id="b" type="text" pattern="[0-9]+" title="Digits only">`;
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    expect(labelText(a)).toBe('Business email');
    expect(labelText(b)).toBe('Notes');
    expect(fieldErrorMessage(a)).toBe('Enter business email.');
    a.value = 'not-an-email';
    expect(fieldErrorMessage(a)).toBe('Enter an email address, for example name@yourstore.com.');
    b.value = 'abc';
    expect(fieldErrorMessage(b)).toBe('Digits only.');
    b.value = '';
    expect(fieldErrorMessage(b)).toBe('');
  });
});

describe('formFieldErrors', () => {
  it('lists every refused control in page order, with the form’s own checks winning for a control both flag', () => {
    document.body.innerHTML = `
      <form>
        <label for="one">One</label><input id="one" required>
        <label for="two">Two</label><input id="two" value="x">
        <label for="three">Three</label><input id="three" required>
        <input type="hidden" name="h" required>
        <button type="submit">Send</button>
      </form>`;
    const form = document.querySelector('form');
    const found = formFieldErrors(form, () => ({ two: 'Not this one', three: 'Three is wrong', missing: 'Nowhere' }));
    expect(found.map(({ id, message }) => [id, message])).toEqual([
      ['one', 'Enter one.'], ['two', 'Not this one'], ['three', 'Three is wrong'], ['missing', 'Nowhere'],
    ]);
    expect(found[0].el).toBe(document.getElementById('one'));
    expect(found[3].el).toBeNull();
    // Empty messages from validate() don't count; a valid form has none.
    for (const id of ['one', 'three']) document.getElementById(id).value = 'ok';
    expect(formFieldErrors(form, () => ({ one: '', two: null }))).toEqual([]);
    expect(formFieldErrors(form)).toEqual([]);
  });
});
