// The icon beside each department in the phone menu and the Categories menu.
// Keyed by the catalog department, so a reordered list keeps the same mark.
// A department the catalog adds later falls back to the grid icon.

export const DEPARTMENT_ICONS = Object.freeze({
  TOBACCO: 'dept-tobacco',
  NOVELTIES: 'dept-vape',
  MERCHANDISE: 'dept-bag',
  CANDIES: 'dept-candy',
  'FOOD STUFF': 'dept-food',
  GROCERY: 'dept-basket',
  'MOTOR OIL': 'dept-oil',
  'DRINKS & BAGS': 'dept-drink',
});

export function departmentIcon(key) {
  return DEPARTMENT_ICONS[key] || 'grid';
}
