// The account-status model (AW-101, AW-097, AW-098): one status per visitor,
// one label per status, and pricing-lock copy that never tells a suspended
// account to wait for approval.
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_EYEBROWS, ACCOUNT_STATUSES, PRICE_LOCK, STATUS_LABEL, TRADE_ACCOUNT_PANELS, accountStatus, accountView, tradeAccountPanel,
} from './accountStatus.js';

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
    // The one guest prompt above a grid and in the product page's price slot (NEW-050).
    expect(PRICE_LOCK.guest.notice).toBe('Trade prices are shown to approved accounts.');
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
    expect(Object.keys(PRICE_LOCK.guest)).toEqual(['short', 'line', 'detail', 'notice']);
    for (const status of ['pending', 'suspended']) {
      expect(Object.keys(PRICE_LOCK[status])).toEqual(['short', 'line', 'detail']);
    }
  });
});

describe('accountView', () => {
  it('waits for the account, says when its profile didn’t load, then follows the status', () => {
    expect(accountView({ status: 'approved' }, 'loading')).toBe('loading');
    expect(accountView(null, 'no-profile')).toBe('no-profile');
    expect(accountView(null, 'signed-out')).toBe('guest');
    expect(accountView({ status: 'approved' }, 'ready')).toBe('approved');
    expect(accountView({ status: 'x' }, 'ready')).toBe('pending');
  });
});

// The signed-in account's panel where a guest is asked to apply (AW-066,
// NEW-014): /apply's eyebrows, My account once approved, the application
// status while it waits or is on hold.
describe('tradeAccountPanel', () => {
  it('has a panel for every signed-in view and none for a guest', () => {
    expect(tradeAccountPanel('guest')).toBeNull();
    expect(Object.keys(TRADE_ACCOUNT_PANELS)).toEqual(Object.keys(ACCOUNT_EYEBROWS));
    expect(ACCOUNT_EYEBROWS).toEqual({
      loading: 'TRADE ACCOUNT', 'no-profile': 'TRADE ACCOUNT', pending: 'APPLICATION UNDER REVIEW', approved: 'ACCOUNT ACTIVE', suspended: 'ACCOUNT ON HOLD',
    });
  });

  it('links an approved account to My account, and one under review or on hold to its application status', () => {
    const links = Object.fromEntries(Object.keys(TRADE_ACCOUNT_PANELS).map((view) => [view, tradeAccountPanel(view).link]));
    expect(links).toEqual({
      loading: { to: '/account', label: 'My account' },
      'no-profile': { to: '/account', label: 'My account' },
      pending: { to: '/apply', label: 'Application status' },
      approved: { to: '/account', label: 'My account' },
      suspended: { to: '/apply', label: 'Application status' },
    });
    expect(tradeAccountPanel('approved')).toMatchObject({ eyebrow: 'ACCOUNT ACTIVE', title: 'Your trade account' });
    // An account on hold is never told to wait for approval (AW-101), and no panel asks anyone to apply.
    expect(tradeAccountPanel('suspended').text).not.toMatch(/approv/i);
    for (const view of Object.keys(TRADE_ACCOUNT_PANELS)) expect(tradeAccountPanel(view).text).not.toMatch(/apply for/i);
  });
});
