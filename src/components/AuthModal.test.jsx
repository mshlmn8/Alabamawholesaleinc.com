// The sign-in dialog after a sign-in: status, close, or a clear message when
// the account does not load (AW-089), and a sign-in from another tab (AW-335).
// Resending the confirmation email (AW-016) and the guard on a half-typed
// application (AW-018). The dialog renders in its own ModalLayer (a portal
// on document.body), which screen queries still reach.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { AuthModal, CHECKING_TIMEOUT_MS, RESEND_COOLDOWN_MS, RESEND_RATE_LIMITED } from './AuthModal.jsx';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };

function authValue(overrides = {}) {
  return {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false,
    isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(), resetPassword: vi.fn(), resendConfirmation: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => null),
    ...overrides,
  };
}

function setup(initial, props = {}) {
  const onClose = vi.fn();
  const onSignOut = vi.fn();
  let value = authValue(initial);
  const ui = () => (
    <AuthContext.Provider value={value}>
      <AuthModal onClose={onClose} onSignOut={onSignOut} {...props} />
    </AuthContext.Provider>
  );
  const view = render(ui());
  const update = (changes) => { value = { ...value, ...changes }; view.rerender(ui()); };
  return { onClose, onSignOut, update, get value() { return value; } };
}

const signInWith = async () => {
  fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-1' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Sign in/ })); });
};

afterEach(() => vi.useRealTimers());

describe('AuthModal after sign-in', () => {
  it('shows a pending account its status', async () => {
    const t = setup();
    await signInWith();
    expect(screen.getByRole('heading', { name: 'Signing you in…' })).toBeTruthy();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('closes for an approved account', async () => {
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('says so when the account does not load, with Try again and Sign out (AW-089)', async () => {
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: true, profile: null, profileError: 'failed' });
    expect(screen.getByRole('heading', { name: 'We couldn’t load your account' })).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(t.onSignOut).toHaveBeenCalled();
    // The provider marks the profile as refreshing while it loads again.
    t.value.refreshProfile.mockImplementation(() => { t.value.profileRefreshing = true; });
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(t.value.refreshProfile).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Signing you in…' })).toBeTruthy();
    t.update({ profileRefreshing: false, profile: { id: 'u1', status: 'approved' }, profileError: null });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on its own when the account is slow (AW-089)', async () => {
    vi.useFakeTimers();
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: false });
    act(() => { vi.advanceTimersByTime(CHECKING_TIMEOUT_MS + 10); });
    expect(t.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'We couldn’t load your account' })).toBeTruthy();
  });

  it('offers a new confirmation link to an unconfirmed account (AW-015)', async () => {
    const t = setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }); }) });
    await signInWith();
    expect(screen.getByRole('heading', { name: 'Confirm your email first' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a new confirmation link/ })); });
    expect(t.value.resendConfirmation).toHaveBeenCalledWith('buyer@example.test');
    expect(screen.getByText(/We sent a new confirmation link to buyer@example.test/)).toBeTruthy();
  });
});

describe('AuthModal and a sign-in in another tab (AW-335)', () => {
  it('closes the password form when an approved account signs in elsewhere', () => {
    const t = setup();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    t.update({ session: SESSION, profileReady: false });
    expect(t.onClose).not.toHaveBeenCalled();
    t.update({ profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a pending account its status instead', () => {
    const t = setup();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
  });

  it('leaves the application checklist open for a signed-in visitor', () => {
    const t = setup({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } }, { initialMode: 'signup' });
    expect(screen.getByRole('heading', { name: 'Apply for a trade account' })).toBeTruthy();
    t.update({ profile: { id: 'u1', status: 'approved', name: 'x' } });
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('leaves a half-typed application alone when a session appears', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Typed' } });
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your name').value).toBe('Typed');
  });
});

// The application asks for the store address, consent to the Trade terms and
// Privacy policy, and 21+ (AW-092, AW-019; Cursor's PR #12).
describe('AuthModal application form', () => {
  it('asks for the store address, consent and 21+, and sends them with the sign-up', async () => {
    const signUp = vi.fn(async () => ({ session: null }));
    setup({ signUp }, { initialMode: 'application' });
    const street = screen.getByLabelText('Store street address');
    const city = screen.getByLabelText('City');
    const zip = screen.getByLabelText('ZIP');
    const terms = screen.getByRole('checkbox', { name: /I agree to the Trade terms/ });
    const age = screen.getByRole('checkbox', { name: 'I am 21 or older' });
    for (const input of [street, city, zip, terms, age]) expect(input.required).toBe(true);
    expect([street.autocomplete, city.autocomplete, zip.autocomplete]).toEqual(['address-line1', 'address-level2', 'postal-code']);
    expect(zip.getAttribute('pattern')).toBe('[0-9]{5}');
    // Real links to the policies, opening in a new tab so the form stays.
    const termsLink = screen.getByRole('link', { name: /Trade terms/ });
    const privacyLink = screen.getByRole('link', { name: /Privacy policy/ });
    expect([termsLink.getAttribute('href'), privacyLink.getAttribute('href')]).toEqual(['/terms', '/privacy']);
    expect(termsLink.getAttribute('target')).toBe('_blank');

    fireEvent.change(street, { target: { value: '1 Test St' } });
    fireEvent.change(city, { target: { value: 'Birmingham' } });
    fireEvent.change(zip, { target: { value: '35203' } });
    fireEvent.click(terms);
    fireEvent.click(age);
    await act(async () => { fireEvent.submit(street.closest('form')); });
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      store_street: '1 Test St', store_city: 'Birmingham', store_zip: '35203',
      terms_accepted: true, terms_version: '2026-09', age_confirmed: true,
    }));
  });
});

describe('AuthModal application form, more cases (AW-092, AW-019)', () => {
  const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('asks for the store address and two required boxes, with the policies in a new tab', () => {
    setup({}, { initialMode: 'application' });
    for (const label of ['Store street address', 'City', 'ZIP']) expect(screen.getByLabelText(label).required).toBe(true);
    expect(screen.getByLabelText('Store street address').getAttribute('autocomplete')).toBe('address-line1');
    expect(screen.getByLabelText('City').getAttribute('autocomplete')).toBe('address-level2');
    const zip = screen.getByLabelText('ZIP');
    expect(zip.getAttribute('autocomplete')).toBe('postal-code');
    expect(zip.getAttribute('inputmode')).toBe('numeric');
    expect(new RegExp(`^(?:${zip.getAttribute('pattern')})$`).test('35203')).toBe(true);
    expect(new RegExp(`^(?:${zip.getAttribute('pattern')})$`).test('3520')).toBe(false);
    const terms = screen.getByRole('checkbox', { name: /^I agree to the Trade terms.* and Privacy policy/ });
    const age = screen.getByRole('checkbox', { name: 'I am 21 or older' });
    expect(terms.required && age.required).toBe(true);
    expect(terms.checked || age.checked).toBe(false);
    for (const [name, href] of [[/^Trade terms/, '/terms'], [/^Privacy policy/, '/privacy']]) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
    }
    expect(screen.getByText(/21\+ licensed businesses only/)).toBeTruthy();
  });

  it('sends the store address and the ticked boxes to signUp', async () => {
    const t = setup({ signUp: vi.fn(async () => ({ session: null })) }, { initialMode: 'application' });
    fill('Your name', 'New Buyer');
    fill('Business name', 'New Store');
    fill('Business email', 'new@example.test');
    fill('Phone', '205-555-0199');
    fill('Password', 'test-password-1');
    fill('Federal EIN', '12-3456789');
    fill('State retail tobacco license #', 'TL-TEST');
    fill('Resale certificate #', 'RS-TEST');
    fill('Store street address', '1 Test Way');
    fill('City', 'Testville');
    fill('ZIP', '35203');
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Trade terms/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 21 or older' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Submit application/ })); });
    expect(t.value.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.test', name: 'New Buyer', state: 'AL',
      store_street: '1 Test Way', store_city: 'Testville', store_zip: '35203',
      terms_accepted: true, age_confirmed: true,
    }));
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
  });

  it('shows the 21+ fine print only on the application form', () => {
    setup();
    expect(screen.queryByText(/21\+ licensed businesses only/)).toBeNull();
  });
});

const pressEscape = () => act(() => { fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' }); });
// The × in the dialog's top row (the status screen also has a 'Close' link).
const closeButton = () => document.querySelector('.dialog-top .icon-btn');
const discardBar = () => screen.queryByRole('group', { name: /Discard your application\?/ });

// AW-018: a stray click, Escape, × or Back never throws away a half-typed
// application without asking.
describe('AuthModal guards a half-typed application (AW-018)', () => {
  it('closes at once while nothing is typed: ×, Escape and the backdrop', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.click(closeButton());
    expect(t.onClose).toHaveBeenCalledTimes(1);
    pressEscape();
    expect(t.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(document.querySelector('.overlay'));
    expect(t.onClose).toHaveBeenCalledTimes(3);
    expect(discardBar()).toBeNull();
  });

  it('asks on × and Escape once a name is typed; Keep editing keeps the answers and the focus', () => {
    const t = setup({}, { initialMode: 'application' });
    const name = screen.getByLabelText('Your name');
    name.focus();
    fireEvent.change(name, { target: { value: 'Typed Name' } });

    fireEvent.click(closeButton());
    expect(t.onClose).not.toHaveBeenCalled();
    const bar = discardBar();
    expect(bar).toBeTruthy();
    expect(bar.textContent).toContain('What you’ve typed will be lost.');
    // The bar sits under the dialog's top row, where the × is.
    expect(bar.previousElementSibling.className).toBe('dialog-top');
    const keep = screen.getByRole('button', { name: 'Keep editing' });
    expect(document.activeElement).toBe(keep);
    expect(keep.getAttribute('aria-describedby')).toBe('aw-discard-title');

    fireEvent.click(keep);
    expect(discardBar()).toBeNull();
    expect(screen.getByLabelText('Your name').value).toBe('Typed Name');
    expect(document.activeElement).toBe(screen.getByLabelText('Your name'));

    pressEscape();
    expect(t.onClose).not.toHaveBeenCalled();
    expect(discardBar()).toBeTruthy();
    // A second Escape answers Keep editing, like the browser's Back would.
    pressEscape();
    expect(discardBar()).toBeNull();
    expect(t.onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Your name'));

    pressEscape();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a backdrop click while there are typed answers', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Federal EIN'), { target: { value: '12-3456789' } });
    fireEvent.click(document.querySelector('.overlay'));
    expect(t.onClose).not.toHaveBeenCalled();
    expect(discardBar()).toBeNull();
    expect(screen.getByLabelText('Federal EIN').value).toBe('12-3456789');
  });

  it('keeps guarding the answers on the checklist and the sign-in screen', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Typed Store' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to the checklist' }));
    fireEvent.click(closeButton());
    expect(discardBar()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    pressEscape();
    expect(discardBar()).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('closes without asking once the application is sent', async () => {
    const signUp = vi.fn(async () => ({ session: null }));
    const t = setup({ signUp }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'New Buyer' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    fireEvent.click(closeButton());
    expect(discardBar()).toBeNull();
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without asking after a sign-in here: that account is the one in use', async () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Typed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    await signInWith();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
    fireEvent.click(closeButton());
    expect(discardBar()).toBeNull();
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });
});

// AW-016: the confirmation email can be sent again from 'Check your inbox'
// and from 'Confirm your email first', once a minute.
describe('AuthModal resends the confirmation email (AW-016)', () => {
  const sendApplication = async (overrides = {}) => {
    const t = setup({ signUp: vi.fn(async () => ({ session: null })), ...overrides }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'new@example.test' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    return t;
  };
  const status = () => screen.getAllByRole('status').find((el) => el.closest('[role="dialog"]'));

  it('sends again from the inbox step, then waits a minute', async () => {
    vi.useFakeTimers();
    const t = await sendApplication();
    const resend = screen.getByRole('button', { name: 'Resend confirmation email' });
    expect(status().textContent).toBe('');
    resend.focus(); // a click focuses the button in the browser, not in jsdom
    await act(async () => { fireEvent.click(resend); });
    expect(t.value.resendConfirmation).toHaveBeenCalledWith('new@example.test');
    expect(resend.disabled).toBe(true);
    expect(status().textContent).toBe('Sent again to new@example.test. It can take a few minutes; check your spam folder too. You can ask for another in a minute.');
    // Focus left the disabled button for the dialog's heading, not <body>.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Check your inbox' }));
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS - 1); });
    expect(resend.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(resend.disabled).toBe(false);
    expect(status().textContent).toBe('');
  });

  it('says to wait a minute when Supabase refuses another email so soon', async () => {
    const limited = Object.assign(new Error('For security purposes, you can only request this after 41 seconds.'), { code: 'over_email_send_rate_limit', status: 429 });
    await sendApplication({ resendConfirmation: vi.fn(async () => { throw limited; }) });
    const resend = screen.getByRole('button', { name: 'Resend confirmation email' });
    resend.focus();
    await act(async () => { fireEvent.click(resend); });
    expect(screen.getByRole('alert').textContent).toBe(RESEND_RATE_LIMITED);
    expect(screen.queryByText(/For security purposes/)).toBeNull();
    // Nothing went, so the button can be used again at once, and has focus.
    expect(resend.disabled).toBe(false);
    expect(document.activeElement).toBe(resend);
  });

  it('brings back “Send a new confirmation link” after the minute, for an unconfirmed sign-in', async () => {
    vi.useFakeTimers();
    const t = setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }); }) });
    await signInWith();
    screen.getByRole('button', { name: /Send a new confirmation link/ }).focus();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a new confirmation link/ })); });
    expect(t.value.resendConfirmation).toHaveBeenCalledWith('buyer@example.test');
    expect(screen.queryByRole('button', { name: /Send a new confirmation link/ })).toBeNull();
    expect(status().textContent).toMatch(/^Sent again to buyer@example.test\./);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Confirm your email first' }));
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS); });
    expect(screen.getByRole('button', { name: /Send a new confirmation link/ })).toBeTruthy();
    expect(status().textContent).toBe('');
  });

  it('cannot send while the account service is not set up', async () => {
    const t = await sendApplication();
    expect(screen.getByRole('button', { name: 'Resend confirmation email' }).disabled).toBe(false);
    t.update({ isBackendConfigured: false });
    expect(screen.getByRole('button', { name: 'Resend confirmation email' }).disabled).toBe(true);
  });
});

