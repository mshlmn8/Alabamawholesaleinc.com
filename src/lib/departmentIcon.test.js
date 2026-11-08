import { describe, expect, it } from 'vitest';
import { NAV_ORDER } from '../data/products.js';
import { ICON_NAMES } from '../components/Icon.jsx';
import { DEPARTMENT_ICONS, departmentIcon } from './departmentIcon.js';

describe('departmentIcon', () => {
  it('gives every catalog department its own icon', () => {
    expect(Object.keys(DEPARTMENT_ICONS)).toEqual([...NAV_ORDER]);
    for (const key of NAV_ORDER) expect(ICON_NAMES).toContain(departmentIcon(key));
    expect(new Set(Object.values(DEPARTMENT_ICONS)).size).toBe(NAV_ORDER.length);
  });

  it('uses the grid icon for a department the list does not name', () => {
    expect(departmentIcon('SEASONAL')).toBe('grid');
  });
});
