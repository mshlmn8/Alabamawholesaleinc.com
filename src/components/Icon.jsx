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
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
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
  // The home carousel's previous/next and pause/play controls (AW-054, AW-168).
  pause: 'M9 6v12M15 6v12',
  play: 'M8 5.5v13l10-6.5z',
  // The home page's services (AW-059): delivery, volume pricing (tag,
  // AW-025), licensed only; calendar is free for other uses.
  tag: 'M3 3h9l9 9-9 9-9-9zM7.5 7.5h.01',
  truck: 'M14 17V6H3v11h2M9 17h6M19 17h2v-5l-3-4h-4M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01',
  shield: 'M12 3l7 3v5c0 4.4-2.9 8.1-7 10-4.1-1.9-7-5.6-7-10V6zM9 12l2 2 4-4',
  // Back to top on long department pages (AW-223).
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  // Department marks in the menus, one per catalog department.
  'dept-tobacco': 'M3 11h12v3H3zM15 11h3v3h-3zM18.5 12.5h2.5',
  'dept-vape': 'M10 3h4v2h-4zM9 5h6v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2zM11 9h2M11 12.5h2',
  'dept-bag': 'M6 8h12l-1.2 12H7.2zM9 8V6a3 3 0 0 1 6 0v2',
  'dept-candy': 'M4 7h16v11H4zM4 11h16M4 14.5h16M9.3 7v11M14.7 7v11',
  'dept-food': 'M8 3v18M5 3v6a3 3 0 0 0 6 0V3',
  'dept-basket': 'M4 9h16l-1.5 11H5.5zM8 9l1.2-4h5.6L16 9M9.5 13v4M14.5 13v4',
  'dept-oil': 'M12 3.2S6.8 9.4 6.8 13.6a5.2 5.2 0 0 0 10.4 0C17.2 9.4 12 3.2 12 3.2z',
  'dept-drink': 'M10 2.5h4V5l2 2.5V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7.5L10 5zM9.5 8.5h5',
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
