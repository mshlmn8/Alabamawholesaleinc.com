// Shared error copy (AW-331).
import { describe, expect, it } from 'vitest';
import { COMPANY } from '../data/content.js';
import { describeError, isNetworkError, unavailableMessage } from './errors.js';

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
});
