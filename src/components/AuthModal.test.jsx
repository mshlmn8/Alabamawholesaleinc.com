// The sign-in dialog after a sign-in: status, close, or a clear message when
// the account does not load (AW-089), and a sign-in from another tab (AW-335).
// Resending the confirmation email (AW-016) and the guard on a half-typed
// application (AW-018). The dialog renders in its own ModalLayer (a portal
// on document.body), which screen queries still reach.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { FILE_TOO_LARGE_MESSAGE, uploadSelectedProof } from '../lib/documents.js';
import { AuthModal, CHECKING_TIMEOUT_MS, RESEND_COOLDOWN_MS, RESEND_RATE_LIMITED } from './AuthModal.jsx';

// The application's documents (AW-085): each test says how an upload goes;
// by default every file goes up.
const proofMock = vi.hoisted(() => ({ fail: {} }));
vi.mock('../lib/documents.js', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadSelectedProof: vi.fn(async (session, files) => {
    const results = {};
    for (const [type, file] of Object.entries(files || {})) {
      if (!file) continue;
      results[type] = proofMock.fail[type] ? { ok: false, error: proofMock.fail[type] } : { ok: true, record: { document_type: type } };
    }
    return { attempted: Object.keys(results).length > 0, results };
  }),
}));

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
      <AuthModal open onClose={onClose} onSignOut={onSignOut} {...props} />
    </AuthContext.Provider>
  );
  const view = render(ui());
  const update = (changes) => { value = { ...value, ...changes }; view.rerender(ui()); };
  return { onClose, onSignOut, update, get value() { return value; } };
}

// A phone number the application accepts (AW-247); the form checks it before signUp.
const typePhone = (value = '205-555-0199') => fireEvent.change(screen.getByLabelText('Phone'), { target: { value } });
// The three selects start empty and are required (AW-091).
const chooseSelects = () => {
  fireEvent.change(screen.getByLabelText('Business type'), { target: { value: 'Smoke Shop' } });
  fireEvent.change(screen.getByLabelText('Store state'), { target: { value: 'AL' } });
  fireEvent.change(screen.getByLabelText('Expected monthly volume'), { target: { value: '$15K — $50K' } });
};

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
    expect(screen.getByRole('heading', { name: 'Apply for an account' })).toBeTruthy();
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
    typePhone();
    chooseSelects();
    fireEvent.click(terms);
    fireEvent.click(age);
    await act(async () => { fireEvent.submit(street.closest('form')); });
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      store_street: '1 Test St', store_city: 'Birmingham', store_zip: '35203',
      business_type: 'Smoke Shop', state: 'AL', expected_volume: '$15K — $50K',
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
    fill('Business type', 'Vape Shop');
    fill('Store state', 'GA');
    fill('Expected monthly volume', 'Under $5K');
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the Trade terms/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'I am 21 or older' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Submit application/ })); });
    expect(t.value.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@example.test', name: 'New Buyer', phone: '(205) 555-0199',
      business_type: 'Vape Shop', state: 'GA', expected_volume: 'Under $5K',
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
    fireEvent.click(screen.getByRole('button', { name: 'Already approved? Sign in' }));
    pressEscape();
    expect(discardBar()).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('closes without asking once the application is sent', async () => {
    const signUp = vi.fn(async () => ({ session: null }));
    const t = setup({ signUp }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'New Buyer' } });
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    fireEvent.click(closeButton());
    expect(discardBar()).toBeNull();
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without asking after a sign-in here: that account is the one in use', async () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Typed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Already approved? Sign in' }));
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
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    return t;
  };
  // The resend line, not the documents' upload line (AW-085).
  const status = () => screen.getAllByRole('status').find((el) => el.closest('[role="dialog"]') && !el.classList.contains('proof-status'));

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


// Supabase's own text never reaches the dialog (AW-084): each failure says
// what to do in the site's words.
describe('AuthModal error messages (AW-084)', () => {
  const apiError = (message, code, status, extra = {}) => Object.assign(new Error(message), { name: 'AuthApiError', code, status, ...extra });
  const alert = () => screen.getAllByRole('alert').find((el) => el.textContent);
  let warn;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  it('says the email and password don’t match, never “Invalid login credentials”', async () => {
    setup({ signIn: vi.fn(async () => { throw apiError('Invalid login credentials', 'invalid_credentials', 400); }) });
    await signInWith();
    expect(alert().textContent).toBe('That email and password don’t match. Try again or reset your password.');
    expect(screen.queryByText(/Invalid login credentials/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(warn).toHaveBeenCalledWith('[auth]', 'invalid_credentials');
  });

  it('falls back to its own sentence for an error it doesn’t know', async () => {
    setup({ signIn: vi.fn(async () => { throw apiError('Database error querying schema', 'unexpected_failure', 400); }) });
    await signInWith();
    expect(alert().textContent).toBe('We couldn’t sign you in. Try again in a moment.');
    expect(screen.queryByText(/Database error/)).toBeNull();
  });

  it('says sign-in is unavailable, with the trade desk, when the network fails', async () => {
    setup({ signIn: vi.fn(async () => { throw Object.assign(new TypeError('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }); }) });
    await signInWith();
    expect(alert().textContent).toMatch(/^Account sign-in is unavailable right now\. Call .+ or email .+ and a trade rep will help you\.$/);
  });

  it('tells an applicant whose email is taken to sign in or reset, never “User already registered”', async () => {
    setup({ signUp: vi.fn(async () => { throw apiError('User already registered', 'user_already_exists', 422); }) }, { initialMode: 'application' });
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(alert().textContent).toBe('An account already uses this email. Sign in or reset your password.');
    expect(screen.queryByText(/User already registered/)).toBeNull();
  });

  it('says what a weak password needs', async () => {
    const weak = Object.assign(new Error('Password should be at least 8 characters.'), { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, reasons: ['length'] });
    setup({ signUp: vi.fn(async () => { throw weak; }) }, { initialMode: 'application' });
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(alert().textContent).toBe('Choose a stronger password: at least 8 characters.');
  });

  it('asks for a minute’s wait when the reset email is refused, never Supabase’s seconds count', async () => {
    setup({ resetPassword: vi.fn(async () => { throw apiError('For security purposes, you can only request this after 49 seconds.', 'over_email_send_rate_limit', 429); }) }, { initialMode: 'reset' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(alert().textContent).toBe('Please wait a minute before trying again.');
    expect(screen.queryByText(/49 seconds/)).toBeNull();
  });

  it('keeps the unconfirmed-email step and the resend wording', async () => {
    setup({ signIn: vi.fn(async () => { throw apiError('Email not confirmed', 'email_not_confirmed', 400); }) });
    await signInWith();
    expect(screen.getByRole('heading', { name: 'Confirm your email first' })).toBeTruthy();
  });
});

// An account on hold can only call or email the trade desk, so those are its
// actions; 'View account status' is for an applicant under review (AW-097).
describe('AuthModal status step actions (AW-097)', () => {
  const showStatus = (status) => {
    const t = setup();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status, email: 'buyer@example.test' } });
    return t;
  };
  const actions = () => [...document.querySelector('[role="dialog"] .dialog-actions').children]
    .map((el) => [el.tagName.toLowerCase(), el.className, el.textContent, el.getAttribute('href')]);

  it('offers Call and Email the trade desk, then Close, to an account on hold', () => {
    const t = showStatus('suspended');
    expect(screen.getByRole('heading', { name: 'Your account needs attention' })).toBeTruthy();
    const [call, email, close] = actions();
    expect(call).toEqual(['a', 'button', expect.stringMatching(/^Call /), expect.stringMatching(/^tel:/)]);
    expect(email).toEqual(['a', 'button ghost', 'Email the trade desk', expect.stringMatching(/^mailto:/)]);
    expect(close).toEqual(['button', 'text-link', 'Close', null]);
    expect(actions()).toHaveLength(3);
    expect(screen.getByRole('link', { name: /^Call / }).hasAttribute('data-autofocus')).toBe(true);
    expect(screen.queryByRole('link', { name: 'View account status' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Browse the catalog' })).toBeNull();
    // The links in the description are the trade desk's phone and email.
    const desc = document.querySelector('[role="dialog"] > .desc');
    expect([...desc.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([expect.stringMatching(/^tel:/), expect.stringMatching(/^mailto:/)]);
    fireEvent.click(screen.getByText('Close', { selector: '.dialog-actions > button.text-link' }));
    expect(t.onClose).toHaveBeenCalled();
  });

  it('keeps View account status and Browse the catalog for an applicant under review', () => {
    showStatus('pending');
    expect(actions().map(([, , text]) => text)).toEqual(['View account status', 'Browse the catalog', 'Close']);
    expect(screen.queryByRole('link', { name: 'Email the trade desk' })).toBeNull();
  });
});

// Each step starts at the top with focus on its heading, also on a return to
// the step the dialog opened on (AW-090, AW-096). The step's kicker shares
// the top row with the × (AW-245).
describe('AuthModal step changes (AW-090, AW-096, AW-245)', () => {
  const title = () => document.getElementById('auth-title');
  const press = (name) => {
    const button = screen.getByRole('button', { name });
    button.focus(); // a click focuses the button in the browser, not in jsdom
    fireEvent.click(button);
  };

  it('keeps the opening step’s first field focused, under StrictMode too', () => {
    render(
      <StrictMode>
        <AuthContext.Provider value={authValue()}>
          <AuthModal open onClose={() => {}} />
        </AuthContext.Provider>
      </StrictMode>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Business email'));
  });

  it('focuses the heading on Back to the checklist, the step it opened on', () => {
    setup({}, { initialMode: 'signup' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continue to the application' }));
    press('Continue to the application');
    expect(document.activeElement).toBe(title());
    press('Back to the checklist');
    expect(title().textContent).toBe('Apply for an account');
    expect(screen.getByRole('heading', { name: 'What you’ll need' })).toBeTruthy();
    expect(document.activeElement).toBe(title());
  });

  it('focuses the heading on a return to Sign in', () => {
    setup();
    press('No account? Apply instead');
    expect(document.activeElement).toBe(title());
    press('Already approved? Sign in');
    expect(title().textContent).toBe('Sign in');
    expect(document.activeElement).toBe(title());
  });

  it('starts each step at the top of the dialog', () => {
    setup({}, { initialMode: 'application' });
    const dialog = screen.getByRole('dialog');
    dialog.scrollTop = 500;
    press('Back to the checklist');
    expect(dialog.scrollTop).toBe(0);
    dialog.scrollTop = 500;
    press('Already approved? Sign in');
    expect(dialog.scrollTop).toBe(0);
  });

  it('starts the confirmation step at the top after the long form was scrolled to Submit', async () => {
    setup({ signUp: vi.fn(async () => ({ session: null })) }, { initialMode: 'application' });
    const dialog = screen.getByRole('dialog');
    dialog.scrollTop = 905;
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    expect(dialog.scrollTop).toBe(0);
    expect(document.activeElement).toBe(title());
  });

  it('shows the step’s kicker in the top row beside the ×, with no second eyebrow', () => {
    setup();
    const top = document.querySelector('[role="dialog"] .dialog-top');
    expect([...top.children].map((el) => el.className)).toEqual(['kicker', 'icon-btn']);
    expect(top.querySelector('.kicker').textContent).toBe('EXISTING ACCOUNTS');
    expect(screen.queryByText('TRADE ACCOUNT')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"] .kicker')).toHaveLength(1);
    press('No account? Apply instead');
    expect(top.querySelector('.kicker').textContent).toBe('NEW ACCOUNTS · LICENSED RETAILERS ONLY');
  });
});

// AW-259: 'Check your inbox' after a reset request names the trade desk, can
// send the link again on its own minute, and the email typed on either form
// carries over to the other.
describe('AuthModal password reset (AW-259)', () => {
  const dialogStatus = () => screen.getAllByRole('status').find((el) => el.closest('[role="dialog"]'));
  const requestReset = async (resetPassword = vi.fn(async () => {})) => {
    const t = setup({ resetPassword }, { initialMode: 'reset' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    return t;
  };

  it('names the email alone in its element and points to the trade desk', async () => {
    await requestReset();
    const desc = document.querySelector('[role="dialog"] > .desc');
    expect(desc.querySelector('strong').textContent).toBe('buyer@example.test');
    expect(desc.textContent).toMatch(/^If an account exists for buyer@example\.test, a password reset link is on its way\. The link works once\. If it doesn’t arrive within a few minutes, check your spam folder\. Still nothing\? Call .+ or email .+\.$/);
    expect([...desc.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([expect.stringMatching(/^tel:/), expect.stringMatching(/^mailto:/)]);
  });

  it('sends the link again once its minute is over, then waits another minute', async () => {
    vi.useFakeTimers();
    const t = await requestReset();
    const again = screen.getByRole('button', { name: 'Send again' });
    // The first link just went: Send again waits out its minute, and the
    // line under it says why it can't be used yet.
    expect(again.disabled).toBe(true);
    expect(dialogStatus().textContent).toBe('You can ask for another link in a minute.');
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS); });
    expect(again.disabled).toBe(false);
    expect(dialogStatus().textContent).toBe('');
    again.focus(); // a click focuses the button in the browser, not in jsdom
    await act(async () => { fireEvent.click(again); });
    expect(t.value.resetPassword).toHaveBeenCalledTimes(2);
    expect(t.value.resetPassword).toHaveBeenLastCalledWith('buyer@example.test');
    expect(again.disabled).toBe(true);
    expect(dialogStatus().textContent).toBe('Sent again to buyer@example.test. You can ask for another in a minute.');
    // Focus left the disabled button for the heading, not <body>.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Check your inbox' }));
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS - 1); });
    expect(again.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(again.disabled).toBe(false);
    expect(dialogStatus().textContent).toBe('');
  });

  it('says to wait a minute when Supabase refuses another link so soon', async () => {
    vi.useFakeTimers();
    const limited = Object.assign(new Error('For security purposes, you can only request this after 12 seconds.'), { code: 'over_email_send_rate_limit', status: 429 });
    const resetPassword = vi.fn(async () => {});
    await requestReset(resetPassword);
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS); });
    resetPassword.mockImplementation(async () => { throw limited; });
    const again = screen.getByRole('button', { name: 'Send again' });
    again.focus();
    await act(async () => { fireEvent.click(again); });
    expect(screen.getByRole('alert').textContent).toBe(RESEND_RATE_LIMITED);
    expect(screen.queryByText(/For security purposes/)).toBeNull();
    // Nothing went: the button can be used again at once, and keeps focus.
    expect(again.disabled).toBe(false);
    expect(document.activeElement).toBe(again);
    expect(dialogStatus().textContent).toBe('');
  });

  it('keeps the confirmation email’s minute separate from the reset link’s', async () => {
    vi.useFakeTimers();
    const t = setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }); }), resetPassword: vi.fn(async () => {}) });
    await signInWith();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a new confirmation link/ })); });
    expect(t.value.resendConfirmation).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(40000); });
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(t.value.resetPassword).toHaveBeenCalledWith('buyer@example.test');
    const again = screen.getByRole('button', { name: 'Send again' });
    // The confirmation email's minute ends; the reset link's runs on.
    act(() => { vi.advanceTimersByTime(RESEND_COOLDOWN_MS - 40000); });
    expect(again.disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(40000); });
    expect(again.disabled).toBe(false);
  });

  it('carries the email between Sign in and the reset form, both ways', async () => {
    setup({ resetPassword: vi.fn(async () => {}) });
    const email = () => document.getElementById('aw-email');
    const resetField = () => document.getElementById('aw-reset-email');
    fireEvent.change(email(), { target: { value: 'buyer@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(resetField().value).toBe('buyer@example.test');
    fireEvent.change(resetField(), { target: { value: 'owner@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(email().value).toBe('owner@example.test');
    // An empty sign-in field still opens the reset form with the email typed there.
    fireEvent.change(email(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(resetField().value).toBe('owner@example.test');
    await act(async () => { fireEvent.submit(resetField().closest('form')); });
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(email().value).toBe('owner@example.test');
  });
});

// AW-260: 'Check your inbox' after an application names the address once,
// offers Sign in as a real control, and the status step lists only real
// tasks.
describe('AuthModal after the application is sent (AW-260)', () => {
  const sendApplication = async ({ phone = '205-555-0199' } = {}) => {
    const t = setup({ signUp: vi.fn(async () => ({ session: null })) }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: phone } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    return t;
  };
  const steps = () => [...document.querySelectorAll('[role="dialog"] .next-steps li')].map((li) => li.textContent);

  it('names the email once, in the description, alone in its element', async () => {
    await sendApplication();
    const desc = document.querySelector('[role="dialog"] > .desc');
    expect(desc.querySelector('strong').textContent).toBe('new@example.test');
    expect(desc.textContent).toBe('We sent a confirmation link to new@example.test. Click it to activate your account — a trade rep will verify your license within one business day.');
    expect(steps().join(' ')).not.toContain('new@example.test');
    expect(steps()).toEqual([
      'Confirm your email.Open the link in that email. Not there after a few minutes? Check your spam folder. Already have an account with this email? Sign in instead.',
      'We review your application.A trade rep checks your EIN, state retail tobacco license and resale certificate.',
      'You hear from us.We’ll email you or call (205) 555-0199 when your account is approved. Wholesale pricing and ordering unlock then.',
    ]);
  });

  it('names the phone number as it was sent (AW-247)', async () => {
    await sendApplication({ phone: '+1 205.555.0199' });
    expect(steps()[2]).toBe('You hear from us.We’ll email you or call (205) 555-0199 when your account is approved. Wholesale pricing and ordering unlock then.');
  });

  for (const [label, find] of [
    ['Sign in instead, in step 1', () => screen.getByRole('button', { name: 'Sign in instead' })],
    ['the Sign in link under the steps', () => screen.getByRole('button', { name: 'Sign in' })],
  ]) {
    it(`opens Sign in with the application’s email from ${label}`, async () => {
      await sendApplication();
      fireEvent.click(find());
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
      expect(document.getElementById('aw-email').value).toBe('new@example.test');
    });
  }

  it('lists only real tasks while an application is under review', () => {
    const t = setup();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    const items = [...document.querySelectorAll('[role="dialog"] .checklist li b')].map((b) => b.textContent);
    expect(items).toEqual(['Pricing unlocks on approval.', 'Questions?']);
    expect(screen.queryByText('Browse the catalog.')).toBeNull();
    // The action still offers the catalog.
    expect(screen.getByRole('link', { name: 'Browse the catalog' })).toBeTruthy();
  });
});

// AW-091: the three selects start empty and must be chosen. AW-243: the form
// is grouped under three legends, then the optional documents.
describe('AuthModal application choices and groups (AW-091, AW-243)', () => {
  it('starts business type, store state and monthly volume empty, with a Select… option nobody can pick back', () => {
    setup({}, { initialMode: 'application' });
    for (const label of ['Business type', 'Store state', 'Expected monthly volume']) {
      const select = screen.getByLabelText(label);
      expect(select.value, label).toBe('');
      expect(select.required, label).toBe(true);
      const first = select.options[0];
      expect([first.value, first.textContent, first.disabled], label).toEqual(['', 'Select…', true]);
      // The real choices keep their values.
      expect(select.options.length, label).toBeGreaterThan(2);
      expect(select.validity.valueMissing, label).toBe(true);
    }
    expect([...screen.getByLabelText('Store state').options].slice(1, 3).map((o) => o.value)).toEqual(['AL', 'GA']);
  });

  it('counts a chosen select as a typed answer, and an untouched form as none', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Store state'), { target: { value: 'MS' } });
    fireEvent.click(closeButton());
    expect(discardBar()).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('groups the fields under Your login, Your store and Licensing, then the optional documents', () => {
    setup({}, { initialMode: 'application' });
    const form = screen.getByLabelText('Your name').closest('form');
    expect([...form.querySelectorAll('fieldset > legend')].map((l) => l.textContent)).toEqual(['Your login', 'Your store', 'Licensing', 'Optional documents']);
    const fields = (name) => [...screen.getByRole('group', { name }).querySelectorAll('input, select')].map((el) => el.id);
    expect(fields('Your login')).toEqual(['aw-su-name', 'aw-su-email', 'aw-su-phone', 'aw-su-pass']);
    expect(fields('Your store')).toEqual(['aw-su-business', 'aw-su-type', 'aw-su-state', 'aw-su-street', 'aw-su-city', 'aw-su-zip', 'aw-su-volume']);
    expect(fields('Licensing')).toEqual(['aw-su-ein', 'aw-su-license', 'aw-su-resale']);
    // The password and the EIN each take a row of their own.
    for (const id of ['aw-su-pass', 'aw-su-ein', 'aw-su-volume', 'aw-su-street']) {
      expect(document.getElementById(id).closest('.form-section > div').className, id).toBe('full');
    }
    expect(document.getElementById('aw-su-name').hasAttribute('data-autofocus')).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('Your name'));
  });
});

// AW-247: the phone number is ten digits, checked before anything is sent,
// with its own error under the field.
describe('AuthModal application phone number (AW-247)', () => {
  const phone = () => screen.getByLabelText('Phone');
  const submit = () => act(async () => { fireEvent.submit(phone().closest('form')); });

  it('says what it wants: an example, a hint, a phone keypad and a pattern the browser can use', () => {
    setup({}, { initialMode: 'application' });
    expect(phone().getAttribute('placeholder')).toBe('(205) 555-0123');
    expect(phone().getAttribute('inputmode')).toBe('tel');
    expect(phone().getAttribute('title')).toBe('Enter a 10-digit US phone number');
    expect(phone().getAttribute('aria-describedby')).toBe('aw-su-phone-hint');
    expect(document.getElementById('aw-su-phone-hint').textContent).toBe('Ten digits, the number we should call about this account.');
    // The browser compiles the pattern with the v flag; an invalid one is ignored.
    const html = new RegExp(`^(?:${phone().getAttribute('pattern')})$`, 'v');
    expect([html.test('(205) 555-0123'), html.test('abc')]).toEqual([true, false]);
  });

  it('refuses a number that is not ten digits: no signUp, the field marked, described and focused', async () => {
    const t = setup({ signUp: vi.fn(async () => ({ session: null })) }, { initialMode: 'application' });
    typePhone('205-555-012');
    screen.getByLabelText('Your name').focus();
    await submit();
    expect(t.value.signUp).not.toHaveBeenCalled();
    expect(phone().getAttribute('aria-invalid')).toBe('true');
    expect(phone().getAttribute('aria-describedby')).toBe('aw-su-phone-hint aw-su-phone-error');
    expect(document.getElementById('aw-su-phone-error').textContent).toBe('Enter a 10-digit phone number, area code first.');
    expect(document.activeElement).toBe(phone());
    // Nothing in the form's own error line: the field says it.
    expect(screen.getAllByRole('alert').map((el) => el.textContent).join('')).toBe('');
    // Editing the number clears the error.
    typePhone('205-555-0123');
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    expect(phone().getAttribute('aria-describedby')).toBe('aw-su-phone-hint');
    expect(document.getElementById('aw-su-phone-error').textContent).toBe('');
  });

  it('reads the error out when the phone field already had focus', async () => {
    vi.useFakeTimers();
    setup({}, { initialMode: 'application' });
    typePhone('abc');
    phone().focus();
    await submit();
    act(() => { vi.advanceTimersByTime(200); });
    expect(document.getElementById('aw-announcer').textContent).toBe('Enter a 10-digit phone number, area code first.');
  });

  it('sends the number formatted', async () => {
    const t = setup({ signUp: vi.fn(async () => ({ session: null })) }, { initialMode: 'application' });
    typePhone('1 205 555 0123');
    await submit();
    expect(t.value.signUp).toHaveBeenCalledWith(expect.objectContaining({ phone: '(205) 555-0123' }));
  });
});

// AW-248: every password box can be shown, and the new ones say when the
// length rule is met.
describe('AuthModal password fields (AW-248)', () => {
  it('shows and hides the sign-in password, and hides it again on submit', async () => {
    setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials', status: 400 }); }) });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pass = screen.getByLabelText('Password');
    expect([pass.id, pass.type, pass.getAttribute('autocomplete')]).toEqual(['aw-pass', 'password', 'current-password']);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pass.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' }).getAttribute('aria-controls')).toBe('aw-pass');
    await signInWith();
    expect(screen.getByLabelText('Password').type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
    warn.mockRestore();
  });

  it('gives the application password the live length rule, in place of the hint', () => {
    setup({}, { initialMode: 'application' });
    const pass = screen.getByLabelText('Password');
    expect([pass.id, pass.minLength, pass.getAttribute('autocomplete'), pass.getAttribute('aria-describedby')]).toEqual(['aw-su-pass', 8, 'new-password', 'aw-su-pass-rule']);
    const rule = document.getElementById('aw-su-pass-rule');
    expect(rule.textContent).toBe('At least 8 characters');
    fireEvent.change(pass, { target: { value: 'eight888' } });
    expect(rule.textContent).toBe('At least 8 characters: done');
    expect(rule.querySelector('svg.icon')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show password' }).getAttribute('aria-controls')).toBe('aw-su-pass');
  });
});

// AW-085: the application's documents upload after a sign-up with a session,
// with Try again for one that failed; without a session they are held in the
// dialog and upload when the applicant's own session reaches this tab.
describe('AuthModal application documents (AW-085)', () => {
  const NEW = { access_token: 'n', user: { id: 'u-new', email: 'new@example.test' } };
  const TOO_LARGE = { statusCode: '413', status: 400, message: 'The object exceeded the maximum allowed size' };
  const license = new File(['l'], 'license.pdf', { type: 'application/pdf' });
  const resale = new File(['r'], 'resale.pdf', { type: 'application/pdf' });
  const choose = async (id, file) => {
    await act(async () => { fireEvent.change(document.getElementById(id), { target: { files: [file] } }); });
  };
  const apply = async (signUp) => {
    const t = setup({ signUp }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'New@Example.test' } });
    typePhone();
    await choose('aw-doc-tobacco_license', license);
    await choose('aw-doc-resale_certificate', resale);
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    return t;
  };
  const proofLine = () => document.querySelector('[role="dialog"] .proof-status');

  beforeEach(() => {
    proofMock.fail = {};
    uploadSelectedProof.mockClear();
  });

  it('uploads both files after a sign-up with a session, and lists one that failed with Try again', async () => {
    proofMock.fail = { tobacco_license: TOO_LARGE };
    const t = await apply(vi.fn(async () => ({ session: NEW })));
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
    expect(uploadSelectedProof).toHaveBeenCalledWith(NEW, { tobacco_license: license, resale_certificate: resale });
    expect(proofLine().textContent).toBe('Your resale certificate is uploaded. Your state retail tobacco license didn’t upload.');
    const items = [...document.querySelectorAll('.proof-failed-list li')].map((li) => [...li.children].map((el) => el.textContent));
    expect(items).toEqual([['State retail tobacco license: license.pdf', FILE_TOO_LARGE_MESSAGE]]);
    expect(screen.getByRole('link', { name: 'My account' }).getAttribute('href')).toBe('/account#documents');
    expect(document.querySelector('.proof-failed .checklist-note').textContent).toBe('Try again or add it from My account.');
    // Try again sends only the one that failed, with the sign-up's session.
    proofMock.fail = {};
    t.update({ session: NEW });
    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.focus();
    await act(async () => { fireEvent.click(retry); });
    expect(uploadSelectedProof).toHaveBeenLastCalledWith(NEW, { tobacco_license: license });
    expect(proofLine().textContent).toBe('Your state retail tobacco license is uploaded.');
    expect(document.querySelector('.proof-failed')).toBeNull();
    // The button is gone; focus is on the heading, not <body>.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your account is pending approval' }));
  });

  it('holds the files without a session, and never uploads them for another account', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const t = await apply(vi.fn(async () => ({ session: null })));
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    expect(uploadSelectedProof).not.toHaveBeenCalled();
    const note = screen.getByText(/^Your documents aren’t sent yet\./);
    expect(note.textContent).toMatch(/Keep this page open: once you confirm your email in this browser, they upload here\. Otherwise, add them later from My account, under License documents, or email them to .+\.$/);
    expect(note.querySelector('a').getAttribute('href')).toMatch(/^mailto:/);
    // Another account signs in (in another tab): nothing goes up.
    t.update({ session: { access_token: 'o', user: { id: 'u-other', email: 'other@example.test' } } });
    await act(async () => {});
    expect(uploadSelectedProof).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    // The files were never written to browser storage.
    for (const [, value] of setItem.mock.calls) expect(String(value)).not.toMatch(/license\.pdf|resale\.pdf/);
    setItem.mockRestore();
  });

  it('uploads the held files once when the applicant’s own session appears, whatever the email’s case', async () => {
    const t = await apply(vi.fn(async () => ({ session: null })));
    t.update({ session: NEW });
    await act(async () => {});
    expect(uploadSelectedProof).toHaveBeenCalledTimes(1);
    expect(uploadSelectedProof).toHaveBeenCalledWith(NEW, { tobacco_license: license, resale_certificate: resale });
    expect(proofLine().textContent).toBe('Your documents are uploaded.');
    expect(screen.queryByText(/^Your documents aren’t sent yet\./)).toBeNull();
    // A refreshed session is not a second upload.
    t.update({ session: { ...NEW, access_token: 'n2' } });
    await act(async () => {});
    expect(uploadSelectedProof).toHaveBeenCalledTimes(1);
  });

  it('lists a held file that failed, with Try again', async () => {
    proofMock.fail = { resale_certificate: { status: 500, message: 'Internal Server Error' } };
    const t = await apply(vi.fn(async () => ({ session: null })));
    t.update({ session: NEW });
    await act(async () => {});
    expect(proofLine().textContent).toBe('Your state retail tobacco license is uploaded. Your resale certificate didn’t upload.');
    expect(screen.getByText('Resale certificate: resale.pdf')).toBeTruthy();
    proofMock.fail = {};
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); });
    expect(uploadSelectedProof).toHaveBeenLastCalledWith(NEW, { resale_certificate: resale });
    expect(proofLine().textContent).toBe('Your resale certificate is uploaded.');
  });

  it('points View account status at the documents on My account', () => {
    const t = setup();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('link', { name: 'View account status' }).getAttribute('href')).toBe('/account#documents');
    // Signed in without an application here: no upload line to read.
    expect(proofLine().textContent).toBe('');
    expect(document.querySelector('.proof-failed')).toBeNull();
  });
});
