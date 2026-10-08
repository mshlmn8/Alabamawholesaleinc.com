// The FDA nicotine statement, quoted verbatim (AW-026), plus the site's
// under-21 line. Shown on nicotine product cards and pages, the vape hero
// slide and in the footer. Which products get it: src/lib/regulated.js.

import { FDA_NICOTINE_WARNING } from '../lib/regulated.js';

export const NICOTINE_WARNING_TEXT = `${FDA_NICOTINE_WARNING} Not for sale to anyone under 21.`;

export function NicotineWarning({ compact = false }) {
  return (
    <p className={compact ? 'nicotine-warning is-compact' : 'nicotine-warning'} role="note">
      {NICOTINE_WARNING_TEXT}
    </p>
  );
}
