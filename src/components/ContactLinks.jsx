// The trade desk's phone and email as links, and the one "Call … or email …"
// sentence every page uses to point buyers at the trade desk (AW-331).

import { COMPANY } from '../data/content.js';

export function PhoneLink({ className }) {
  return <a className={className} href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a>;
}

export function EmailLink({ className }) {
  return <a className={className} href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
}

// One root element, and before/after in their own spans, because callers
// swap this sentence in and out and pass text that changes (AW-039).
export function CallOrEmail({ before = 'Call', after = '.' }) {
  return <span><span>{before}</span> <PhoneLink /> or email <EmailLink /><span>{after}</span></span>;
}
