// US phone numbers typed into the trade application (AW-247). Staff call the
// number on the account, so it has to be ten digits: the area code and the
// number. Spaces, dots, dashes, brackets and a leading +1 or 1 are allowed
// and dropped; letters, too few or too many digits are not.

// The browser's own check for the phone field: 10 to 20 of the characters a
// typed US number uses. HTML compiles a pattern with the v flag, where '(',
// ')' and '-' must be escaped inside a class, or the whole pattern is
// invalid and silently ignored. usPhone() is the real check.
export const PHONE_PATTERN = String.raw`[0-9\(\)+.\-\s]{10,20}`;
export const PHONE_TITLE = 'Enter a 10-digit US phone number';
export const PHONE_EXAMPLE = '(205) 555-0123';
export const PHONE_ERROR = 'Enter a 10-digit phone number, area code first.';

// { digits: '2055550123', formatted: '(205) 555-0123' }, or null when the
// text is not a ten-digit US number.
export function usPhone(text) {
  const raw = String(text ?? '');
  // Anything but digits and the usual separators is a typo, not a number.
  // The u flag here, not v: Safari before 17 has no v flag.
  if (!new RegExp(`^(?:${PHONE_PATTERN})$`, 'u').test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return { digits, formatted: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` };
}
