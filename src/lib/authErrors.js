// What a customer reads when a Supabase Auth call fails (AW-084): sign-in,
// the application, the confirmation and reset emails, and a new password.
// Supabase's own text ('Invalid login credentials', 'For security purposes,
// you can only request this after 49 seconds', 'User already registered') is
// never shown. A browser that is offline gets the offline copy and a call
// that gave up (src/lib/network.js) the "taking too long" copy (AW-344,
// AW-194), worded in errors.js. A known error code gets a sentence that says
// what to do; a network or server failure gets the "unavailable, call or
// email the trade desk" copy; anything else gets the caller's fallback.
//
// One line goes to the console with the code (or status, or error name) so a
// failure can still be told apart. Never the message, which can echo back an
// email address, and never anything the customer typed.

import { OFFLINE_MESSAGE, isNetworkError, isRateLimitError, slowMessage, unavailableMessage } from './errors.js';
import { isOffline, isTimeoutError } from './network.js';

export const AUTH_ERROR_TEXT = {
  invalidCredentials: 'That email and password don’t match. Try again or reset your password.',
  emailNotConfirmed: 'Confirm your email first — check your inbox or resend the link.',
  alreadyRegistered: 'An account already uses this email. Sign in or reset your password.',
  weakPassword: 'Choose a stronger password',
  rateLimited: 'Please wait a minute before trying again.',
  samePassword: 'Choose a password you haven’t used on this account.',
  badEmail: 'Check the email address and try again.',
  reauthenticate: 'Sign in again, then change your password.',
  sessionEnded: 'Your session ended. Sign in again.',
};

// Supabase's weak_password reasons, as what the password needs. 8 is the
// minimum the application and reset forms ask for (minLength); keep it in
// step with the project's password policy (AW-248).
const WEAK_PASSWORD_REASONS = {
  length: 'at least 8 characters',
  characters: 'a mix of letters, numbers and symbols',
  pwned: 'one that hasn’t appeared in a data breach',
};

const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit', 'over_sms_send_rate_limit']);
const UNAVAILABLE_CODES = new Set(['email_address_not_authorized', 'signup_disabled', 'email_provider_disabled']);
const ALREADY_REGISTERED_CODES = new Set(['user_already_exists', 'email_exists']);
const BAD_EMAIL_CODES = new Set(['email_address_invalid', 'validation_failed']);
const SESSION_ENDED_CODES = new Set(['session_not_found', 'session_expired']);

export function weakPasswordText(reasons) {
  const needs = [...new Set((Array.isArray(reasons) ? reasons : [])
    .map((reason) => WEAK_PASSWORD_REASONS[reason])
    .filter(Boolean))];
  return needs.length ? `${AUTH_ERROR_TEXT.weakPassword}: ${needs.join('; ')}.` : `${AUTH_ERROR_TEXT.weakPassword}.`;
}

// Only short identifiers are logged ('invalid_credentials', 400,
// 'AuthRetryableFetchError'); anything else is 'unknown'.
const LOGGABLE = /^[A-Za-z0-9_]{1,64}$/;
function logAuthError(err) {
  const tag = [err?.code, err?.status, err?.name].find((v) => v != null && v !== '' && LOGGABLE.test(String(v)));
  console.warn('[auth]', tag ?? 'unknown');
}

// The sentence for a failed auth call. `what` names the service for the
// unavailable copy ('Account sign-in', 'Password reset'); `fallback` is shown
// for an error with no better sentence. Never err.message.
export function friendlyAuthError(err, { what = 'The account service', fallback = 'Something went wrong. Try again in a moment.' } = {}) {
  logAuthError(err);
  const code = typeof err?.code === 'string' ? err.code : '';
  const status = Number(err?.status) || 0;

  if (isOffline()) return OFFLINE_MESSAGE;
  if (isTimeoutError(err)) return slowMessage(what);
  if (isNetworkError(err) || err?.name === 'AuthRetryableFetchError' || status >= 500) return unavailableMessage(what);
  if (isRateLimitError(err) || RATE_LIMIT_CODES.has(code)) return AUTH_ERROR_TEXT.rateLimited;
  if (code === 'weak_password' || err?.name === 'AuthWeakPasswordError') return weakPasswordText(err?.reasons);
  if (code === 'invalid_credentials') return AUTH_ERROR_TEXT.invalidCredentials;
  if (code === 'email_not_confirmed') return AUTH_ERROR_TEXT.emailNotConfirmed;
  if (ALREADY_REGISTERED_CODES.has(code)) return AUTH_ERROR_TEXT.alreadyRegistered;
  if (code === 'same_password') return AUTH_ERROR_TEXT.samePassword;
  if (BAD_EMAIL_CODES.has(code)) return AUTH_ERROR_TEXT.badEmail;
  if (UNAVAILABLE_CODES.has(code)) return unavailableMessage(what);
  if (code === 'reauthentication_needed') return AUTH_ERROR_TEXT.reauthenticate;
  // supabase-js turns session_not_found into an AuthSessionMissingError.
  if (SESSION_ENDED_CODES.has(code) || err?.name === 'AuthSessionMissingError') return AUTH_ERROR_TEXT.sessionEnded;
  return fallback;
}
