// The password box with Show/Hide and the live length rule (AW-248).
import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, PasswordField } from './PasswordField.jsx';

function Form({ initial = '', ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <PasswordField id="pw" label="Password" value={value} onChange={(e) => setValue(e.target.value)} {...props} />
    </form>
  );
}

describe('PasswordField (AW-248)', () => {
  it('starts hidden; the button shows and hides the password, named for what it will do', () => {
    render(<Form autoComplete="current-password" required name="password" />);
    const input = screen.getByLabelText('Password');
    expect([input.type, input.id, input.name, input.required, input.getAttribute('autocomplete')]).toEqual(['password', 'pw', 'password', true, 'current-password']);
    const button = screen.getByRole('button', { name: 'Show password' });
    expect([button.type, button.getAttribute('aria-controls'), button.hasAttribute('aria-pressed')]).toEqual(['button', 'pw', false]);
    expect(button.className).toBe('button ghost sm pw-toggle');
    fireEvent.click(button);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBe(button);
    fireEvent.click(button);
    expect(input.type).toBe('password');
    expect(button.textContent).toBe('Show password');
  });

  it('sits the button beside the box, in one row', () => {
    render(<Form />);
    const row = screen.getByLabelText('Password').parentElement;
    expect(row.className).toBe('pw-wrap');
    expect([...row.children].map((el) => el.tagName)).toEqual(['INPUT', 'BUTTON']);
  });

  it('hides the password again when its form is submitted', () => {
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').type).toBe('text');
    fireEvent.submit(screen.getByLabelText('Password').closest('form'));
    expect(screen.getByLabelText('Password').type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
  });

  it('says when the length rule is met, in words, with a drawn check', () => {
    render(<Form showRule minLength={PASSWORD_MIN_LENGTH} />);
    const input = screen.getByLabelText('Password');
    const rule = document.getElementById('pw-rule');
    expect(input.getAttribute('aria-describedby')).toBe('pw-rule');
    expect(input.minLength).toBe(8);
    expect(rule.className).toBe('field-hint pw-rule');
    expect(rule.getAttribute('aria-live')).toBe('polite');
    expect(rule.textContent).toBe('At least 8 characters');
    expect(rule.querySelector('svg')).toBeNull();
    fireEvent.change(input, { target: { value: 'seven77' } });
    expect(rule.textContent).toBe('At least 8 characters');
    fireEvent.change(input, { target: { value: 'eight888' } });
    expect(rule.textContent).toBe('At least 8 characters: done');
    expect(rule.querySelector('svg.icon').getAttribute('aria-hidden')).toBe('true');
    // The rule stays in the page; only its text changes.
    fireEvent.change(input, { target: { value: 'short' } });
    expect(document.getElementById('pw-rule').textContent).toBe('At least 8 characters');
  });

  it('describes the box by its hint and its rule, and leaves both out when there are none', () => {
    const { unmount } = render(<Form hint="Use your work email’s password." showRule />);
    expect(screen.getByLabelText('Password').getAttribute('aria-describedby')).toBe('pw-hint pw-rule');
    expect(document.getElementById('pw-hint').textContent).toBe('Use your work email’s password.');
    unmount();
    render(<Form />);
    expect(screen.getByLabelText('Password').hasAttribute('aria-describedby')).toBe(false);
    expect(document.getElementById('pw-rule')).toBeNull();
  });

  it('passes the ref and extra attributes to the input, and the class to its wrapper', () => {
    const ref = createRef();
    render(<Form inputRef={ref} className="full" data-autofocus="" />);
    const input = screen.getByLabelText('Password');
    expect(ref.current).toBe(input);
    expect(input.hasAttribute('data-autofocus')).toBe(true);
    expect(input.closest('.full')).toBeTruthy();
    // No autocorrect or spellcheck on a shown password.
    expect([input.getAttribute('autocapitalize'), input.getAttribute('spellcheck')]).toEqual(['none', 'false']);
  });

  it('shows a refusal the page sets as its own message, under the box (NEW-026)', () => {
    const { rerender } = render(<Form error="That isn’t the current password for this account." showRule />);
    const input = screen.getByLabelText('Password');
    const message = document.getElementById('pw-error');
    expect(message.textContent).toBe('That isn’t the current password for this account.');
    expect(message.className).toBe('form-error field-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('pw-rule pw-error');
    // Under the box, inside the field's own wrapper.
    expect(input.closest('.pw-wrap').parentElement.contains(message)).toBe(true);
    rerender(<Form error="" showRule />);
    expect(message.textContent).toBe('');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe('pw-rule');
  });
});
