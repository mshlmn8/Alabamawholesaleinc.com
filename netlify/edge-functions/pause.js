// Pauses the public site while the owner finishes setting it up.
//
// When the Netlify environment variable SITE_PAUSED is "true":
// - alabama-wholesale.com and www.alabama-wholesale.com answer every page
//   with a short "opening soon" page (HTTP 503, so search engines come back
//   later instead of indexing it), and robots.txt disallows everything;
// - the project's netlify.app address keeps working for the owner and staff
//   (Admin, prices, photos), but tells search engines not to index it.
// With SITE_PAUSED unset or anything else, every request passes straight
// through. Netlify reads environment variables at deploy time: after
// changing SITE_PAUSED, trigger a deploy (SETUP.md, "Pausing the site").
//
// Hashed assets and photos skip the function (config.excludedPath), so a
// paused site costs one invocation per page view, not one per file.

export const PUBLIC_HOSTS = ['alabama-wholesale.com', 'www.alabama-wholesale.com'];

const PHONE = '(205) 458-4788';
const PHONE_LINK = '+12054584788';
const EMAIL = 'Alabamawholesaleinc@gmail.com';

export const PAUSED_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Alabama Wholesale Inc · Opening soon</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: #281459; color: #f6f3ee; font: 400 1.0625rem/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 34rem; text-align: center; }
  .brand { margin: 0; font-weight: 800; font-size: 2.5rem; letter-spacing: -0.01em; color: #ed5a21; }
  .brand span { display: block; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.3em; color: #f6f3ee; }
  h1 { margin: 32px 0 12px; font-size: 1.75rem; line-height: 1.25; }
  p { margin: 0 0 12px; }
  a { color: #f6f3ee; text-underline-offset: 3px; }
  a:focus-visible { outline: 3px solid #f6f3ee; outline-offset: 3px; }
  .fine { margin-top: 28px; font-size: 0.875rem; color: #d9d2e8; }
</style>
</head>
<body>
<main>
  <p class="brand">Alabama<span>WHOLESALE INC.</span></p>
  <h1>Our new wholesale website is opening soon.</h1>
  <p>Licensed retailers can reach the trade desk in the meantime:</p>
  <p>Call <a href="tel:${PHONE_LINK}">${PHONE}</a> or email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
  <p class="fine">613 Graymont Ave N, Birmingham, AL 35203</p>
</main>
</body>
</html>
`;

const PAUSED_ROBOTS = 'User-agent: *\nDisallow: /\n';

// What to do with one request: 'pass', 'noindex' (pass, but add a noindex
// header), 'robots' or 'page'.
export function pauseDecision(url, paused) {
  if (!paused) return 'pass';
  const { hostname, pathname } = new URL(url);
  if (!PUBLIC_HOSTS.includes(hostname)) return 'noindex';
  return pathname === '/robots.txt' ? 'robots' : 'page';
}

export const isPaused = (value) => String(value ?? '').trim().toLowerCase() === 'true';

export default async function pause(request, context) {
  const paused = isPaused(globalThis.Netlify?.env?.get('SITE_PAUSED'));
  const decision = pauseDecision(request.url, paused);
  if (decision === 'pass') return undefined;
  if (decision === 'noindex') {
    const response = await context.next();
    response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  }
  const common = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (decision === 'robots') {
    return new Response(PAUSED_ROBOTS, { status: 200, headers: { ...common, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(PAUSED_PAGE, {
    status: 503,
    headers: { ...common, 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '86400' },
  });
}

export const config = {
  path: '/*',
  excludedPath: ['/assets/*', '/img/*', '/fonts/*'],
};
