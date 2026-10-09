// The account-status model (AW-101, AW-097, AW-098): one status per visitor,
// one label per status, and pricing-lock copy that never tells a suspended
// account to wait for approval.
import { describe, expect, it } from 'vitest';
import { ACCOUNT_STATUSES, PRICE_LOCK, STATUS_LABEL, accountStatus } from './accountStatus.js';

describe('accountStatus', () => {
  it('is guest without a profile', () => {
    expect(accountStatus(null)).toBe('guest');
    expect(accountStatus(undefined)).toBe('guest');
  });

  it('is the profile’s status when the site knows it', () => {
    expect(accountStatus({ status: 'pending' })).toBe('pending');
    expect(accountStatus({ status: 'approved' })).toBe('approved');
    expect(accountStatus({ status: 'suspended' })).toBe('suspended');
  });

  it('treats a missing or unknown status as pending, so it never unlocks prices', () => {
    expect(accountStatus({})).toBe('pending');
    expect(accountStatus({ status: null })).toBe('pending');
    expect(accountStatus({ status: 'archived' })).toBe('pending');
    expect(accountStatus({ status: 'APPROVED' })).toBe('pending');
  });

  it('only ever returns one of the four statuses', () => {
    for (const profile of [null, {}, { status: 'pending' }, { status: 'approved' }, { status: 'suspended' }, { status: 'x' }]) {
      expect(ACCOUNT_STATUSES).toContain(accountStatus(profile));
    }
  });
});

describe('STATUS_LABEL', () => {
  it('names each signed-in status', () => {
    expect(STATUS_LABEL).toEqual({ pending: 'Pending approval', approved: 'Approved', suspended: 'On hold' });
  });
});

describe('PRICE_LOCK', () => {
  it('keeps the guest and pending wording the storefront already uses', () => {
    expect(PRICE_LOCK.guest).toMatchObject({ short: 'Sign in for pricing', line: 'Sign in to see your wholesale pricing.' });
    expect(PRICE_LOCK.pending).toMatchObject({ short: 'Pricing after approval', line: 'Pricing unlocks after your account is approved.' });
  });

  it('tells a suspended account ordering is paused, not that pricing waits for approval (AW-101)', () => {
    expect(PRICE_LOCK.suspended).toEqual({
      short: 'Account on hold',
      line: 'Ordering is paused on this account.',
      detail: 'Ordering is paused on this account — call the trade desk.',
    });
    expect(Object.values(PRICE_LOCK.suspended).join(' ')).not.toMatch(/approv/i);
  });

  it('has no lock for an approved account', () => {
    expect(PRICE_LOCK.approved).toBeUndefined();
    for (const status of ['guest', 'pending', 'suspended']) {
      expect(Object.keys(PRICE_LOCK[status])).toEqual(['short', 'line', 'detail']);
    }
  });
});
