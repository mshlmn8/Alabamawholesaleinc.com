// Customer-facing notice for when the account backend is not configured or
// not reachable. Shared by the sign-in dialog and the account pages so the
// wording stays identical everywhere.

import React from 'react';
import { COMPANY } from '../data/content.js';

export function ServiceUnavailable({ what = 'Account sign-in', className = 'form-error', role = 'status' }) {
  return (
    <p className={className} role={role}>
      {what} is unavailable right now. Call <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a> or email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> and a trade rep will help you.
    </p>
  );
}
