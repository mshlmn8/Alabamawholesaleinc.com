// Auth failures in the customer's words (AW-084): each supabase-js error code
// maps to a sentence that says what to do, network and server failures to
// the unavailable copy, anything else to the caller's fallback. Supabase's own
// message never reaches the screen or the console.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unavailableMessage } from './errors.js';
import { AUTH_ERROR_TEXT, friendlyAuthError, weakPasswordText } from './authErrors.js';

// An error shaped like supabase-js's AuthApiError and friends.
const SECRET = 'buyer@example.test said: Invalid login credentials (raw)';
const authError = (fields) => Object.assign(new Error(SECRET), { name: 'AuthApiError', ...fields });
const OPTIONS = { what: 'Account sign-in', fallback: 'We couldn’t sign you in. Try again in a moment.' };

let warn;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('friendlyAuthError', () => {
  it.each([
    ['invalid_credentials', 400, AUTH_ERROR_TEXT.invalidCredentials],
    ['email_not_confirmed', 400, AUTH_ERROR_TEXT.emailNotConfirmed],
    ['user_already_exists', 422, AUTH_ERROR_TEXT.alreadyRegistered],
    ['email_exists', 422, AUTH_ERROR_TEXT.alreadyRegistered],
    ['over_email_send_rate_limit', 429, AUTH_ERROR_TEXT.rateLimited],
    ['over_request_rate_limit', 429, AUTH_ERROR_TEXT.rateLimited],
    ['same_password', 422, AUTH_ERROR_TEXT.samePassword],
    ['email_address_invalid', 400, AUTH_ERROR_TEXT.badEmail],
    ['validation_failed', 400, AUTH_ERROR_TEXT.badEmail],
    ['reauthentication_needed', 400, AUTH_ERROR_TEXT.reauthenticate],
    ['session_not_found', 403, AUTH_ERROR_TEXT.sessionEnded],
    ['email_address_not_authorized', 400, unavailableMessage('Account sign-in')],
    ['signup_disabled', 422, unavailableMessage('Account sign-in')],
  ])('maps %s to its own sentence', (code, status, text) => {
    expect(friendlyAuthError(authError({ code, status }), OPTIONS)).toBe(text);
  });

  it('says what a weak password needs, from the reasons Supabase gives', () => {
    const weak = (reasons) => Object.assign(new Error(SECRET), { name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, reasons });
    expect(friendlyAuthError(weak(['length']), OPTIONS)).toBe('Choose a stronger password: at least 8 characters.');
    expect(friendlyAuthError(weak(['characters']), OPTIONS)).toBe('Choose a stronger password: a mix of letters, numbers and symbols.');
    expect(friendlyAuthError(weak(['pwned']), OPTIONS)).toBe('Choose a stronger password: one that hasn’t appeared in a data breach.');
    expect(friendlyAuthError(weak(['length', 'characters', 'pwned', 'length']), OPTIONS))
      .toBe('Choose a stronger password: at least 8 characters; a mix of letters, numbers and symbols; one that hasn’t appeared in a data breach.');
    expect(friendlyAuthError(weak([]), OPTIONS)).toBe('Choose a stronger password.');
    expect(friendlyAuthError(weak(['something_new']), OPTIONS)).toBe('Choose a stronger password.');
    // An older Auth server: the error class without a code.
    expect(friendlyAuthError({ name: 'AuthWeakPasswordError', message: SECRET, reasons: ['length'] }, OPTIONS)).toBe('Choose a stronger password: at least 8 characters.');
    expect(weakPasswordText(undefined)).toBe('Choose a stronger password.');
  });

  it('treats any 429 as a rate limit, with or without a code', () => {
    expect(friendlyAuthError({ status: 429, message: SECRET }, OPTIONS)).toBe(AUTH_ERROR_TEXT.rateLimited);
  });

  it('says the service is unavailable for network and server failures', () => {
    const unavailable = unavailableMessage('Account sign-in');
    expect(friendlyAuthError(new TypeError('Failed to fetch'), OPTIONS)).toBe(unavailable);
    expect(friendlyAuthError(Object.assign(new Error('Load failed'), { name: 'AuthRetryableFetchError', status: 0 }), OPTIONS)).toBe(unavailable);
    // A 5xx carries the gateway's own text, not a network word.
    expect(friendlyAuthError(Object.assign(new Error('Service Unavailable'), { name: 'AuthRetryableFetchError', status: 503 }), OPTIONS)).toBe(unavailable);
    expect(friendlyAuthError(authError({ code: 'unexpected_failure', status: 500 }), OPTIONS)).toBe(unavailable);
    expect(friendlyAuthError(new TypeError('Failed to fetch'), { what: 'Password reset' })).toBe(unavailableMessage('Password reset'));
  });

  it('knows the session-missing error supabase-js throws for session_not_found', () => {
    const missing = Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError', status: 400 });
    expect(friendlyAuthError(missing, OPTIONS)).toBe(AUTH_ERROR_TEXT.sessionEnded);
  });

  it('falls back to the caller’s sentence for anything else', () => {
    expect(friendlyAuthError(authError({ code: 'bad_jwt', status: 401 }), OPTIONS)).toBe(OPTIONS.fallback);
    expect(friendlyAuthError(new Error(SECRET), OPTIONS)).toBe(OPTIONS.fallback);
    expect(friendlyAuthError({}, OPTIONS)).toBe(OPTIONS.fallback);
    expect(friendlyAuthError(null, OPTIONS)).toBe(OPTIONS.fallback);
    expect(friendlyAuthError('a string', OPTIONS)).toBe(OPTIONS.fallback);
    expect(friendlyAuthError(new Error(SECRET))).toBe('Something went wrong. Try again in a moment.');
  });

  it('never returns the error’s own message', () => {
    const shapes = [
      authError({}), authError({ code: 'invalid_credentials', status: 400 }), authError({ code: 'weak_password', status: 422, reasons: ['length'] }),
      authError({ code: 'whatever', status: 418 }), { message: SECRET }, { message: SECRET, status: 429 }, { code: 'x', message: SECRET },
    ];
    for (const err of shapes) {
      const text = friendlyAuthError(err, OPTIONS);
      expect(text).not.toContain('Invalid login credentials');
      expect(text).not.toContain('buyer@example.test');
      expect(text).not.toContain('(raw)');
    }
  });

  it('logs the code, status or error name once, never the message or an email', () => {
    friendlyAuthError(authError({ code: 'invalid_credentials', status: 400 }), OPTIONS);
    friendlyAuthError({ status: 429, message: SECRET }, OPTIONS);
    friendlyAuthError(Object.assign(new Error(SECRET), { name: 'AuthRetryableFetchError' }), OPTIONS);
    friendlyAuthError({ code: 'buyer@example.test', message: SECRET }, OPTIONS);
    friendlyAuthError(null, OPTIONS);
    expect(warn.mock.calls).toEqual([
      ['[auth]', 'invalid_credentials'],
      ['[auth]', 429],
      ['[auth]', 'AuthRetryableFetchError'],
      ['[auth]', 'unknown'],
      ['[auth]', 'unknown'],
    ]);
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toMatch(/example\.test|Invalid login|raw/);
  });
});
