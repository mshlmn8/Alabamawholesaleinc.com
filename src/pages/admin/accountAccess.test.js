// What an admin and a staff account may change in Admin -> Accounts (AW-030),
// as the database's profile guard has it (20261014120000_staff_role.sql,
// supabase/tests/28_staff_role.sql).
import { describe, expect, it } from 'vitest';
import { ACCOUNT_LOCK_TEXT, accountAccess } from './accountAccess.js';

const ADMIN = { id: 'admin-1', role: 'admin', status: 'approved' };
const STAFF = { id: 'staff-1', role: 'staff', status: 'approved' };
const BUYER = { id: 'buyer-1', role: 'customer', status: 'pending' };
const OTHER_STAFF = { id: 'staff-2', role: 'staff', status: 'approved' };

describe('accountAccess (AW-030)', () => {
  it('lets an admin change any account’s status, tier and role but their own status and role', () => {
    expect(accountAccess(ADMIN, BUYER)).toEqual({ admin: true, status: true, roleControl: true, role: true, tier: true, details: true, lock: null });
    expect(accountAccess(ADMIN, OTHER_STAFF)).toMatchObject({ status: true, role: true, tier: true, details: true, lock: null });
    expect(accountAccess(ADMIN, ADMIN)).toEqual({ admin: true, status: false, roleControl: true, role: false, tier: true, details: true, lock: 'own' });
  });

  it('lets staff change a customer’s status and details, never a role or a tier', () => {
    expect(accountAccess(STAFF, BUYER)).toEqual({ admin: false, status: true, roleControl: false, role: false, tier: false, details: true, lock: null });
  });

  it('locks a staff or admin account for staff, their own included', () => {
    for (const row of [ADMIN, OTHER_STAFF, STAFF]) {
      expect(accountAccess(STAFF, row)).toEqual({ admin: false, status: false, roleControl: false, role: false, tier: false, details: false, lock: 'staffAccount' });
    }
    expect(ACCOUNT_LOCK_TEXT.staffAccount).toBe('Only an admin can change a staff or admin account.');
    expect(ACCOUNT_LOCK_TEXT.own).toBe('Your own status and role can’t be changed here.');
  });

  it('treats a pending or suspended admin as no admin', () => {
    expect(accountAccess({ ...ADMIN, status: 'suspended' }, BUYER).admin).toBe(false);
    expect(accountAccess(null, BUYER)).toMatchObject({ admin: false, tier: false, roleControl: false });
  });
});
