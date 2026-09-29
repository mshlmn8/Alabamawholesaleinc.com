// The terms version an application records (AW-019) follows the date the
// policy pages print.
import { describe, expect, it } from 'vitest';
import { POLICIES_UPDATED, TERMS_VERSION } from './content.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

describe('TERMS_VERSION', () => {
  it('is the month the policies were last updated, as YYYY-MM', () => {
    const [month, year] = POLICIES_UPDATED.split(' ');
    expect(MONTHS).toContain(month);
    expect(TERMS_VERSION).toBe(`${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}`);
  });
});
