// The company's name, phone and email at the top of a printed page (AW-148),
// where the hidden header was. Not shown on screen. The quote receipt and
// the admin's pick list and packing slip print their own company line, so
// the print stylesheet leaves this off them.

import { useSite } from '../lib/siteSettings.js';

// The phone and email are the ones staff set in Admin -> Site settings (AW-030).
export function PrintLetterhead() {
  const site = useSite();
  return (
    <p className="print-letterhead container">
      <strong>{site.name}</strong>
      <span>{`${site.phone} · ${site.email}`}</span>
    </p>
  );
}
