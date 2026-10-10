// The Netlify Forms index.html declares (AW-024: 'order-notification', the
// order email; src/lib/orderNotification.js posts to it), and a local
// stand-in for Netlify's form endpoint.
//
// Netlify registers a form when it deploys from a <form data-netlify="true"
// name="…"> in the published HTML, and from then on accepts a POST to any
// page path whose x-www-form-urlencoded body names that form in
// 'form-name'. Fields the markup doesn't list are dropped from the
// submission, so the markup must list every one the app sends
// (src/lib/orderNotification.test.js checks).
//
// `vite` and `vite preview` have no such endpoint, so a post from a local
// run would fail with a 404 (and a console error). formsStandIn() answers a
// post for a declared form with 200, as Netlify does, and anything else
// with 404. It keeps nothing and sends nothing: locally, no email goes out.

const FORM_TAG = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
const NAME_ATTR = /\bname\s*=\s*"([^"]*)"/i;
const FIELD_TAG = /<(?:input|textarea|select)\b([^>]*)>/gi;

// { formName: [field names, in order] } for every Netlify form in `html`.
export function netlifyForms(html) {
  const forms = {};
  for (const [, attrs, body] of String(html).matchAll(FORM_TAG)) {
    if (!/\bdata-netlify\s*=\s*"true"|\snetlify(?:\s|>|=|$)/i.test(attrs)) continue;
    const name = NAME_ATTR.exec(attrs)?.[1];
    if (!name) continue;
    forms[name] = [...body.matchAll(FIELD_TAG)].map(([, fieldAttrs]) => NAME_ATTR.exec(fieldAttrs)?.[1]).filter(Boolean);
  }
  return forms;
}

// The form's honeypot field (netlify-honeypot="…"), or null.
export function netlifyHoneypot(html, formName) {
  for (const [, attrs] of String(html).matchAll(FORM_TAG)) {
    if (NAME_ATTR.exec(attrs)?.[1] !== formName) continue;
    return /\bnetlify-honeypot\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] || null;
  }
  return null;
}

const MAX_BODY_BYTES = 1024 * 1024;

// Connect middleware: answers POSTs that name one of `formNames()` in
// form-name. Anything else goes on to the next handler.
export function formsStandIn(formNames) {
  return (req, res, next) => {
    if (req.method !== 'POST' || !/application\/x-www-form-urlencoded/i.test(req.headers['content-type'] || '')) return next();
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      const name = new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('form-name');
      const known = size <= MAX_BODY_BYTES && name && formNames().includes(name);
      res.statusCode = known ? 200 : 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(known ? 'Form received (local stand-in for Netlify Forms: nothing is kept or emailed).' : 'No such form.');
    });
  };
}
