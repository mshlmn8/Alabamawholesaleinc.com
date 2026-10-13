// What the signed-in admin or staff account may change on an account in
// Admin -> Accounts (AW-030, owner answer 2026-10), as the database's
// profile guard has it (20261014120000_staff_role.sql):
//   - an approved admin changes any account's status, tier and role, except
//     their own status and role (AW-352)
//   - approved staff change a customer's status, details and verification
//     note, but never a role or a pricing tier, and nothing on a staff or
//     admin account (their own included: an admin changes those)
// Pure (accountAccess.test.js).

import { isApprovedAdmin, isStaffRole } from '../../lib/accountStatus.js';

// Why a control is locked, under the controls.
export const ACCOUNT_LOCK_TEXT = Object.freeze({
  own: 'Your own status and role can’t be changed here.',
  staffAccount: 'Only an admin can change a staff or admin account.',
});

// viewer: the signed-in profile; row: the account shown.
//   admin        the viewer is an approved admin
//   status       the status select (and Approve) can be used
//   roleControl  the role is a select (an admin), not plain text
//   role         ... and it can be used (not the admin's own row)
//   tier         the tier is a select (an admin), not plain text
//   details      the contact form and the verification note can be saved
//   lock         'own' | 'staffAccount' | null: what ACCOUNT_LOCK_TEXT says
export function accountAccess(viewer, row) {
  const admin = isApprovedAdmin(viewer);
  const own = !!row && !!viewer && row.id === viewer.id;
  const locked = !admin && isStaffRole(row?.role);
  return {
    admin,
    status: !own && !locked,
    roleControl: admin,
    role: admin && !own,
    tier: admin,
    details: !locked,
    lock: locked ? 'staffAccount' : own ? 'own' : null,
  };
}
