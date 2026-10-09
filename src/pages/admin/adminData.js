// Every admin read and write checks its result (AW-202): a refused or failed
// call says so in staff wording, instead of a list that looks empty or a
// select that snaps back without a word.
//
//   adminErrorMessage(error, action)  the sentence to show for an error
//   checkedWrite(builder)             an update/delete that must reach a row
//   withStatus(result)                a result's error with its HTTP status

import { isNetworkError } from '../../lib/errors.js';

export const NEEDS_UPDATE = 'This needs the October 2026 database update (see BACKEND.md).';
export const SESSION_ENDED = 'Your session ended. Sign in again.';
// A missing function, column or table: the live database before the
// October 2026 migrations.
export const MISSING_SCHEMA_CODES = ['PGRST202', '42883', 'PGRST204', '42703', 'PGRST205', '42P01'];
// checkedWrite's error when the database changed no row. Row-level security
// turns a refused update into "0 rows" with no error.
export const NO_ROWS = 'AW_NO_ROWS';

// The hints the database's admin guards raise with 42501 (20261009140000,
// 20261009150000).
const REFUSALS = {
  admin_only: 'Only an approved admin can change this.',
  own_role_status: 'You can’t change your own status or role.',
  profile_record: 'Consent and approval records can’t be edited.',
  profile_email: 'A profile’s email follows its sign-in email.',
};

const codeOf = (error) => String(error?.code ?? '');
export const isMissingSchema = (error) => MISSING_SCHEMA_CODES.includes(codeOf(error));
export const isSessionEnded = (error) => Number(error?.status) === 401
  || ['PGRST301', 'PGRST303'].includes(codeOf(error))
  || /JWT expired/i.test(String(error?.message || ''));
export const isRefused = (error) => codeOf(error) === '42501' || Number(error?.status) === 403;
export const refusalFor = (error) => REFUSALS[error?.hint] || null;

// The message for a failed admin call. `action` starts the sentence when
// there is nothing more specific to say, e.g. 'The orders didn’t load' or
// 'The change to Test Market wasn’t saved'.
export function adminErrorMessage(error, action = 'That didn’t work') {
  if (!error) return null;
  if (isNetworkError(error)) return `${action}: the database couldn’t be reached. Check the connection and try again.`;
  if (isSessionEnded(error)) return SESSION_ENDED;
  if (isRefused(error)) return refusalFor(error) || `${action}: your account isn’t allowed to do that.`;
  if (isMissingSchema(error)) return NEEDS_UPDATE;
  switch (codeOf(error)) {
    case '23505': return `${action}: another record already uses that value.`;
    case '23514': return `${action}: a value is outside what the database accepts.`;
    case '23503': return `${action}: it refers to something that no longer exists.`;
    case '23502': return `${action}: a required value is missing.`;
    default: return `${action}${error.message ? ` (${error.message})` : ''}. Try again.`;
  }
}

// A Supabase result's error, carrying the HTTP status (401 is a session that
// ended); null when there is none.
export function withStatus({ error, status } = {}) {
  if (!error) return null;
  if (!status || error.status != null) return error;
  // PostgrestError's message is not enumerable: copy the fields by name.
  return { ...error, message: error.message, code: error.code, details: error.details, hint: error.hint, status };
}

// Runs an update or delete and reads the changed rows back (.select('id')).
// No error and no row is a refusal too. Returns { data, error }.
export async function checkedWrite(builder, columns = 'id') {
  let result;
  try {
    result = await builder.select(columns);
  } catch (error) {
    return { data: null, error };
  }
  const error = withStatus(result || {});
  if (error) return { data: null, error };
  const rows = result?.data;
  if (rows == null || (Array.isArray(rows) && rows.length === 0)) return { data: null, error: { code: NO_ROWS, message: '' } };
  return { data: rows, error: null };
}
