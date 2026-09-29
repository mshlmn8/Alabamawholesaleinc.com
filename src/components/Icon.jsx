// The site's icon set (AW-293): small inline SVGs drawn with the text colour,
// in place of Unicode glyphs (⊞ ⌄ ↗ → × − + ✓) that each OS drew from a
// different fallback font. An icon is 1em square, so it takes its size from
// the font size of the control it sits in, and it is decorative: the
// control keeps its accessible name as text or an aria-label.
//
// Drawn on a 24-unit grid with a 2-unit round stroke. The 'external' arrow
// marks only links that leave the site in a new tab (AW-218).

const PATHS = {
  external: 'M7 17 17 7M9 7h8v8',
  'chevron-down': 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  search: 'M4 11a7 7 0 1 0 14 0 7 7 0 1 0-14 0M20 20l-4.05-4.05',
  menu: 'M4 7h16M4 12h16M4 17h16',
  filter: 'M4 7h16M7 12h10M10 17h4',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  help: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M9.1 9a3 3 0 0 1 5.8 1c0 2-2.9 2.4-2.9 3.6M12 17h.01',
  alert: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7.5v5M12 16.5h.01',
};

export const ICON_NAMES = Object.keys(PATHS);

export function Icon({ name, className }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" width="1em" height="1em"
         aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
