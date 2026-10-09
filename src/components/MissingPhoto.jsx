// The tile shown where a product has no photo yet (AW-029, Cursor PR #13):
// "Photo coming soon" and the product name, in place of the old grey
// initials. `compact` is for the small cart, checkout and search thumbnails,
// which only fit the picture mark; the product name is printed beside them.
// On a card whose tile is too short for the name (a phone's two columns,
// print's four), index.css leaves the name out (@container on .card-block,
// NEW-083): it would be cut mid-line, and the card's title says it.
// TODO(owner): Packshots for the products that have no photo, starting with Dubai chocolate #342 and the Grocery items. (AW-029)

function PhotoMark() {
  return (
    <svg className="photo-soon-mark" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 17l5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function MissingPhoto({ name, compact = false }) {
  if (compact) {
    return <span className="photo-soon is-compact" aria-hidden="true"><PhotoMark /></span>;
  }
  return (
    <span className="photo-soon">
      <PhotoMark />
      <span className="photo-soon-label">Photo coming soon</span>
      {/* The name is the heading next to the tile; screen readers hear it there. */}
      <span className="photo-soon-name" aria-hidden="true">{name}</span>
    </span>
  );
}
