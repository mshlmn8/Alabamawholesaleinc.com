// Customer-facing notice for when the account backend is not configured or
// not reachable. Shared by the sign-in dialog and the account pages so the
// wording stays identical everywhere.

import { CallOrEmail } from './ContactLinks.jsx';

export function ServiceUnavailable({ what = 'Account sign-in', className = 'form-error', role = 'status' }) {
  return (
    <p className={className} role={role}>
      <CallOrEmail before={`${what} is unavailable right now. Call`} after=" and a trade rep will help you." />
    </p>
  );
}
