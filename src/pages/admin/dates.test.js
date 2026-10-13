// The admin screens' one date format (NEW-038).
import { describe, expect, it } from 'vitest';
import { adminDate, adminDateTime } from './dates.js';

describe('admin dates (NEW-038)', () => {
  it('writes a day as Oct 1, 2026', () => {
    expect(adminDate(new Date(2026, 9, 1, 10, 0))).toBe('Oct 1, 2026');
    expect(adminDate(new Date(2026, 9, 1).getTime())).toBe('Oct 1, 2026');
    expect(adminDate('2026-10-01T00:00')).toBe('Oct 1, 2026');
  });

  it('writes a time as Oct 1, 2026, 10:00 AM, without seconds', () => {
    expect(adminDateTime(new Date(2026, 8, 30, 10, 0, 0))).toBe('Sep 30, 2026, 10:00 AM');
    expect(adminDateTime(new Date(2026, 9, 2, 21, 5, 59))).toBe('Oct 2, 2026, 9:05 PM');
    expect(adminDateTime('2026-09-30T15:00:00Z')).toMatch(/^Sep 30, 2026, \d{1,2}:\d{2} [AP]M$/);
  });

  it('says none for a missing or invalid date', () => {
    for (const value of [null, undefined, '', 'soon', NaN]) {
      expect(adminDate(value)).toBe('—');
      expect(adminDateTime(value)).toBe('—');
      expect(adminDateTime(value, '')).toBe('');
    }
  });
});
