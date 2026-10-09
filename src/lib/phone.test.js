// Ten-digit US phone numbers for the trade application (AW-247).
import { describe, expect, it } from 'vitest';
import { PHONE_PATTERN, usPhone } from './phone.js';

describe('usPhone (AW-247)', () => {
  it('formats ten digits, whatever separators were typed', () => {
    for (const typed of ['2055550123', '205-555-0123', '205.555.0123', '(205) 555-0123', '(205)555-0123', ' 205 555 0123 ']) {
      expect(usPhone(typed), typed).toEqual({ digits: '2055550123', formatted: '(205) 555-0123' });
    }
  });

  it('drops the country code 1 in front of ten digits', () => {
    for (const typed of ['12055550123', '1-205-555-0123', '+1 (205) 555-0123', '+1 205.555.0123']) {
      expect(usPhone(typed)?.formatted, typed).toBe('(205) 555-0123');
    }
  });

  it('refuses letters, too few or too many digits, and an 11-digit number not starting with 1', () => {
    for (const typed of ['', 'abc', '555-0123', '205-555-012', '205-555-01234', '22055550123', '205-555-0123 ext 4', 'call 2055550123', null, undefined]) {
      expect(usPhone(typed), String(typed)).toBeNull();
    }
  });

  it('gives the browser a pattern that compiles under the v flag HTML uses', () => {
    // An invalid pattern is ignored by the browser without a word.
    const html = new RegExp(`^(?:${PHONE_PATTERN})$`, 'v');
    expect(html.test('(205) 555-0123')).toBe(true);
    expect(html.test('+1 205.555.0123')).toBe(true);
    expect(html.test('abc')).toBe(false);
    expect(html.test('555-0123')).toBe(false);
  });
});
