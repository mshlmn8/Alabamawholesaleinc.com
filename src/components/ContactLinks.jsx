// The trade desk's phone and email as links, the one "Call … or email …"
// sentence every page uses to point buyers at the trade desk (AW-331), and
// the volume-pricing sentence (AW-025). The phone and email are the ones
// staff set in Admin -> Site settings (AW-030, useSite), or content.js's.

import { useSite } from '../lib/siteSettings.js';

export function PhoneLink({ className }) {
  const site = useSite();
  return <a className={className} href={`tel:${site.phoneRaw}`}>{site.phone}</a>;
}

export function EmailLink({ className }) {
  const site = useSite();
  return <a className={className} href={`mailto:${site.email}`}>{site.email}</a>;
}

// An email address that wraps after the '@' rather than mid-word (AW-120).
// One root span, so a flex parent sees a single item and the line break
// still happens inside it; each part in its own span (AW-039). Without an
// address, the site's.
export function EmailText({ address }) {
  const site = useSite();
  const text = address ?? site.email;
  const at = text.indexOf('@');
  if (at < 0) return <span>{text}</span>;
  return <span><span>{text.slice(0, at + 1)}</span><wbr /><span>{text.slice(at + 1)}</span></span>;
}

// One root element, and before/after in their own spans, because callers
// swap this sentence in and out and pass text that changes (AW-039).
export function CallOrEmail({ before = 'Call', after = '.' }) {
  return <span><span>{before}</span> <PhoneLink /> or email <EmailLink /><span>{after}</span></span>;
}

// VOLUME_PRICING (content.js) with its email and phone as links: "For volume
// pricing, email us or call (205) 458-4788." (AW-025, owner answer 2026-10).
// One root element; the link text never changes, so no part needs a span.
export function VolumePricing() {
  const site = useSite();
  return <span>For volume pricing, <a href={`mailto:${site.email}`}>email us</a> or call <PhoneLink />.</span>;
}
