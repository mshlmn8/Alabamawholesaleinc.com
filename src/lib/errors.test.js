// Shared error copy (AW-331).
import { describe, expect, it, vi } from 'vitest';
import { COMPANY } from '../data/content.js';
import {
  APPLICATION_TIMEOUT_MESSAGE, OFFLINE_MESSAGE, describeError, isNetworkError, isRateLimitError, slowMessage, unavailableMessage,
} from './errors.js';
import { timeoutError } from './network.js';

describe('errors', () => {
  it('recognises browser network failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
    expect(isNetworkError(new Error('Invalid login credentials'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it('points the buyer at the trade desk', () => {
    expect(unavailableMessage('Password reset')).toBe(`Password reset is unavailable right now. Call ${COMPANY.phone} or email ${COMPANY.email} and a trade rep will help you.`);
  });

  it('describes network errors, other errors and missing messages', () => {
    expect(describeError(new TypeError('Failed to fetch'), 'Account sign-in', 'Sign-in failed')).toBe(unavailableMessage('Account sign-in'));
    expect(describeError(new Error('Invalid login credentials'), 'Account sign-in', 'Sign-in failed')).toBe('Invalid login credentials');
    expect(describeError({}, 'Account sign-in', 'Sign-in failed')).toBe('Sign-in failed');
  });

  it('says the buyer is offline, before anything else (AW-344)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(OFFLINE_MESSAGE).toBe('You appear to be offline. Check your connection and try again.');
    for (const err of [new TypeError('Failed to fetch'), timeoutError(), new Error('Invalid login credentials'), null]) {
      expect(describeError(err, 'Account sign-in', 'Sign-in failed')).toBe(OFFLINE_MESSAGE);
    }
  });

  it('says a request is taking too long, with the phone number (AW-194)', () => {
    expect(slowMessage('Account sign-in')).toBe(`Account sign-in is taking too long to answer. Check your connection and try again, or call ${COMPANY.phone}.`);
    expect(describeError(timeoutError(), 'Account sign-in', 'Sign-in failed')).toBe(slowMessage('Account sign-in'));
    expect(describeError({ message: 'TimeoutError: The request took too long.', code: '' }, 'Document upload', 'x')).toBe(slowMessage('Document upload'));
  });

  it('says a timed-out application may have gone through (AW-194)', () => {
    expect(APPLICATION_TIMEOUT_MESSAGE).toBe(`The application is taking too long to send. Check your inbox: if a confirmation email arrives, it went through. Otherwise try again, or call ${COMPANY.phone}.`);
  });

  it('recognises Supabase’s email rate limit (AW-016)', () => {
    expect(isRateLimitError({ code: 'over_email_send_rate_limit', status: 429, message: 'For security purposes, you can only request this after 52 seconds.' })).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ code: 'email_not_confirmed', status: 400 })).toBe(false);
    expect(isRateLimitError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
