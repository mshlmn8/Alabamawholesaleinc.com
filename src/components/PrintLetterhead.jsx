// The company's name, phone and email at the top of a printed page (AW-148),
// where the hidden header was. Not shown on screen. The quote receipt and
// the admin's pick list and packing slip print their own company line, so
// the print stylesheet leaves this off them.

import { COMPANY } from '../data/content.js';

export function PrintLetterhead() {
  return (
    <p className="print-letterhead container">
      <strong>{COMPANY.name}</strong>
      <span>{`${COMPANY.phone} · ${COMPANY.email}`}</span>
    </p>
  );
}
