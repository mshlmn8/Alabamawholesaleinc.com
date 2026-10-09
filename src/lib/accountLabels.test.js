// The account status, role and tier labels (AW-149).
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_STATUS_LABELS, ADMIN_STATUS_LABELS, ROLE_LABELS, accountStatusLabel, adminStatusLabel, roleLabel, tierLabel,
} from './accountLabels.js';

describe('account labels', () => {
  it('words each status for the buyer as /apply always has', () => {
    expect(ACCOUNT_STATUS_LABELS).toEqual({ pending: 'Pending approval', approved: 'Approved', suspended: 'On hold' });
    expect(['pending', 'approved', 'suspended'].map(accountStatusLabel)).toEqual(['Pending approval', 'Approved', 'On hold']);
  });

  it('words each status, and each role, for staff', () => {
    expect(['pending', 'approved', 'suspended'].map(adminStatusLabel)).toEqual(['Pending', 'Approved', 'Suspended']);
    expect(Object.keys(ADMIN_STATUS_LABELS)).toEqual(Object.keys(ACCOUNT_STATUS_LABELS));
    expect(['customer', 'admin'].map(roleLabel)).toEqual(['Customer', 'Admin']);
    expect(ROLE_LABELS.admin).toBe('Admin');
  });

  it('capitalises the tier key and adds nothing to it', () => {
    expect(['standard', 'silver', 'gold'].map(tierLabel)).toEqual(['Standard', 'Silver', 'Gold']);
    expect(tierLabel('key_account')).toBe('Key account');
    expect(tierLabel(null)).toBe('');
    expect(tierLabel('gold')).not.toMatch(/%|discount|off/i);
  });

  it('shows a value without a label capitalised, and never an inherited property', () => {
    expect(accountStatusLabel('on_review')).toBe('On review');
    expect(adminStatusLabel('constructor')).toBe('Constructor');
    expect(roleLabel('toString')).toBe('ToString');
    expect(accountStatusLabel(undefined)).toBe('');
    expect(Object.isFrozen(ACCOUNT_STATUS_LABELS)).toBe(true);
  });
});
