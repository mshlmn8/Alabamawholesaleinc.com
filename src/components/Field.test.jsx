// The shared field layer (AW-173): a refused submit shows each problem under
// its field, marks the field invalid, focuses the first, and sends nothing.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field, ValidatedForm } from './Field.jsx';

function Form({ onSubmit, validate, serverError = null }) {
  const [values, setValues] = useState({ name: '', email: '', zip: '', notes: '', agree: false });
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <ValidatedForm onSubmit={onSubmit} validate={validate} aria-label="Test form">
      <p className="form-note">All fields are required unless marked optional.</p>
      <div className="form-grid">
        <Field id="t-name" label="Business name">
          <input id="t-name" value={values.name} onChange={set('name')} required />
        </Field>
        <Field id="t-email" label="Email" hint="We reply here.">
          <input id="t-email" type="email" value={values.email} onChange={set('email')} required aria-describedby="t-email-hint" />
        </Field>
        <Field id="t-zip" label="ZIP">
          <input id="t-zip" value={values.zip} onChange={set('zip')} required pattern="[0-9]{5}" title="A 5-digit ZIP code"
                 aria-invalid={serverError ? true : undefined} aria-describedby={serverError ? 't-server' : undefined} />
        </Field>
        <Field id="t-notes" label="Notes" optional full>
          <input id="t-notes" value={values.notes} onChange={set('notes')} />
        </Field>
        <Field id="t-agree" label="I agree" inline full>
          <input id="t-agree" type="checkbox" checked={values.agree} onChange={set('agree')} required />
        </Field>
      </div>
      <p id="t-server">{serverError}</p>
      <button type="submit">Send</button>
    </ValidatedForm>
  );
}

const byId = (id) => document.getElementById(id);
const submit = () => act(() => { fireEvent.submit(screen.getByRole('form', { name: 'Test form' })); });
const type = (id, value) => fireEvent.change(byId(id), { target: { value } });

describe('Field', () => {
  it('labels the control, marks optional ones, and links the hint', () => {
    render(<Form onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Business name').id).toBe('t-name');
    expect(screen.getByLabelText('Notes (optional)').id).toBe('t-notes');
    expect(document.querySelector('label[for="t-notes"] .field-optional').textContent).toBe(' (optional)');
    expect(byId('t-email').getAttribute('aria-describedby')).toBe('t-email-hint');
    expect(byId('t-email-hint').textContent).toBe('We reply here.');
    // No message, no aria-invalid; the empty error paragraphs are always there.
    for (const id of ['t-name', 't-email', 't-zip', 't-notes', 't-agree']) {
      expect(byId(id).hasAttribute('aria-invalid')).toBe(false);
      expect(byId(`${id}-error`).textContent).toBe('');
      expect(byId(`${id}-error`).className).toBe('form-error field-error');
    }
    expect(byId('t-name').hasAttribute('aria-describedby')).toBe(false);
  });

  it('puts a checkbox before its label, in the consent row', () => {
    render(<Form onSubmit={vi.fn()} />);
    const row = byId('t-agree').parentElement;
    expect(row.className).toBe('consent');
    expect([...row.children].map((el) => el.tagName)).toEqual(['INPUT', 'LABEL']);
    expect(row.nextElementSibling.id).toBe('t-agree-error');
    expect(row.parentElement.className).toBe('full');
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toBe(byId('t-agree'));
  });
});

describe('ValidatedForm', () => {
  it('turns the browser’s checks off and names every problem under its field instead, focusing the first and sending nothing', () => {
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    const form = screen.getByRole('form', { name: 'Test form' });
    expect(form.noValidate).toBe(true);
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    const expected = {
      't-name': 'Enter business name',
      't-email': 'Enter email',
      't-zip': 'Enter ZIP',
      't-agree': 'Check this box to continue',
    };
    for (const [id, message] of Object.entries(expected)) {
      expect(byId(id).getAttribute('aria-invalid'), id).toBe('true');
      expect(byId(`${id}-error`).textContent, id).toBe(message);
      expect(byId(id).getAttribute('aria-describedby').split(' '), id).toContain(`${id}-error`);
    }
    // The hint stays first; nothing is listed twice.
    expect(byId('t-email').getAttribute('aria-describedby')).toBe('t-email-hint t-email-error');
    // The optional field is fine empty.
    expect(byId('t-notes').hasAttribute('aria-invalid')).toBe(false);
    expect(document.activeElement).toBe(byId('t-name'));
  });

  it('says what is wrong with a mistyped answer, and clears a field’s message when it changes', () => {
    render(<Form onSubmit={vi.fn()} />);
    type('t-name', 'Test Market');
    type('t-email', 'not-an-email');
    type('t-zip', '3520');
    submit();
    expect(byId('t-name').hasAttribute('aria-invalid')).toBe(false);
    expect(byId('t-email-error').textContent).toBe('Enter an email address, for example name@yourstore.com');
    expect(byId('t-zip-error').textContent).toBe('A 5-digit ZIP code');
    expect(document.activeElement).toBe(byId('t-email'));
    type('t-email', 'buyer@example.test');
    expect(byId('t-email-error').textContent).toBe('');
    expect(byId('t-email').hasAttribute('aria-invalid')).toBe(false);
    expect(byId('t-email').getAttribute('aria-describedby')).toBe('t-email-hint');
    // The others keep theirs until they change.
    expect(byId('t-zip-error').textContent).toBe('A 5-digit ZIP code');
    fireEvent.click(byId('t-agree'));
    expect(byId('t-agree-error').textContent).toBe('');
  });

  it('sends once everything passes, and clears the messages', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(<Form onSubmit={onSubmit} />);
    type('t-name', 'Test Market');
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    type('t-email', 'buyer@example.test');
    type('t-zip', '35203');
    fireEvent.click(byId('t-agree'));
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect([...document.querySelectorAll('.field-error')].map((p) => p.textContent).join('')).toBe('');
  });

  it('adds the form’s own checks from validate(), which win for a field both flag', () => {
    const onSubmit = vi.fn();
    const validate = vi.fn(() => ({ 't-zip': 'We deliver to Alabama ZIP codes only in this test', 't-notes': '' }));
    render(<Form onSubmit={onSubmit} validate={validate} />);
    type('t-name', 'Test Market');
    type('t-email', 'buyer@example.test');
    fireEvent.click(byId('t-agree'));
    submit();
    expect(validate).toHaveBeenCalledWith(screen.getByRole('form', { name: 'Test form' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(byId('t-zip-error').textContent).toBe('We deliver to Alabama ZIP codes only in this test');
    expect(byId('t-zip').getAttribute('aria-invalid')).toBe('true');
    expect(byId('t-notes').hasAttribute('aria-invalid')).toBe(false);
    expect(document.activeElement).toBe(byId('t-zip'));
  });

  it('keeps an aria-invalid and description the page set for a server refusal', () => {
    render(<Form onSubmit={vi.fn()} serverError="Enter a 5-digit ZIP code (or ZIP+4)." />);
    expect(byId('t-zip').getAttribute('aria-invalid')).toBe('true');
    expect(byId('t-zip').getAttribute('aria-describedby')).toBe('t-server');
    submit();
    expect(byId('t-zip').getAttribute('aria-describedby')).toBe('t-server t-zip-error');
  });
});
