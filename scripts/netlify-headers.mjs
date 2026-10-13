// The response headers in netlify.toml (AW-205, AW-182), read in Node with no
// dependency:
// - readNetlifyHeaders(toml): the [[headers]] rules as [{ for, values }];
// - inlineScriptHashes(html): the CSP hash of each inline script;
// - previewHeaders(root): the "/*" values, which `vite preview` sends so a
//   local production check runs under the same policy as Netlify;
// - pathHeaders(rules, pathname): the values of the other rules that match
//   a path (the year-long Cache-Control on /assets/*), which `vite preview`
//   adds for files that exist, so the browser caches the built files as it
//   does from Netlify (NEW-006);
// - cspProblems(csp, hashes): what scripts/check-headers.mjs and the unit
//   tests refuse in the policy;
// - readNetlifyRedirects(toml): the [[redirects]] rules, in file order;
// - netlifyResponse(pathname, { redirects, hasFile }): what Netlify answers
//   for a path, a file or the first matching rule (NEW-088). `vite preview`
//   uses it to send the same 404s, and scripts/netlify-redirects.test.mjs to
//   check that every page path of the app is answered with index.html.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const unquote = (raw, lineNo) => {
  // A TOML basic string on one line: "…" with \" and \\ escapes.
  const m = /^"((?:[^"\\]|\\["\\])*)"\s*(?:#.*)?$/.exec(raw);
  if (!m) throw new Error(`netlify.toml line ${lineNo}: expected a "double-quoted" value on one line`);
  return m[1].replace(/\\(["\\])/g, '$1');
};

/**
 * The [[headers]] rules of a netlify.toml. A small reader for the shape the
 * file uses (`[[headers]]`, `for = "…"`, `[headers.values]`, `Key = "value"`):
 * anything else inside a headers rule throws, so a rule it can't read is never
 * skipped silently. Lines outside headers rules are ignored.
 * @param {string} tomlText
 * @returns {{ for: string, values: Record<string, string> }[]}
 */
export function readNetlifyHeaders(tomlText) {
  const rules = [];
  let rule = null;
  let inValues = false;
  const close = (lineNo) => {
    if (rule && !rule.for) throw new Error(`netlify.toml line ${lineNo}: a [[headers]] rule has no for = "…" path`);
    rule = null;
    inValues = false;
  };
  String(tomlText).split(/\r?\n/).forEach((text, i) => {
    const lineNo = i + 1;
    const line = text.trim();
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('[')) {
      const table = line.replace(/\s*#.*$/, '');
      if (table === '[[headers]]') {
        close(lineNo);
        rule = { for: null, values: {} };
        rules.push(rule);
      } else if (table === '[headers.values]') {
        if (!rule || inValues) throw new Error(`netlify.toml line ${lineNo}: [headers.values] must follow its own [[headers]]`);
        inValues = true;
      } else if (/^\[\[?headers[.\]]/.test(table)) {
        throw new Error(`netlify.toml line ${lineNo}: unsupported headers table ${table}`);
      } else {
        // Any other table ([build], [[redirects]], …) ends the headers rule.
        close(lineNo);
      }
      return;
    }
    if (!rule) return;
    const m = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (!m) throw new Error(`netlify.toml line ${lineNo}: expected Key = "value" inside a [[headers]] rule`);
    const [, key, raw] = m;
    if (!inValues && key !== 'for') throw new Error(`netlify.toml line ${lineNo}: a [[headers]] rule takes only for = "…" before [headers.values]`);
    const value = unquote(raw, lineNo);
    if (!inValues) {
      if (rule.for) throw new Error(`netlify.toml line ${lineNo}: the [[headers]] rule already has a path`);
      rule.for = value;
      return;
    }
    const taken = Object.keys(rule.values).find((k) => k.toLowerCase() === key.toLowerCase());
    if (taken) throw new Error(`netlify.toml line ${lineNo}: ${key} is set twice for ${rule.for}`);
    rule.values[key] = value;
  });
  close(String(tomlText).split(/\r?\n/).length);
  return rules;
}

// Script types the browser runs, so a CSP must allow them: classic scripts
// (no type, or a JavaScript MIME type), modules, import maps and speculation
// rules. Data blocks such as application/ld+json never run and need no hash.
const JS_MIME = /^(?:(?:text|application)\/(?:x-)?(?:javascript|ecmascript)|text\/(?:javascript1\.[0-5]|jscript|livescript))$/;
const runs = (type) => type == null || type === '' || JS_MIME.test(type) || ['module', 'importmap', 'speculationrules'].includes(type);

const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=\\s|/|$)`, 'i').exec(attrs);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim().toLowerCase();
};

/**
 * The 'sha256-…' source for every inline script the browser would run, in
 * document order. The hash covers the exact text between the tags as UTF-8,
 * with line endings normalised to \n the way the HTML parser does.
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScriptHashes(html) {
  const hashes = [];
  const source = String(html);
  const tag = /<!--[\s\S]*?(?:-->|$)|<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const m of source.matchAll(tag)) {
    if (m[0].startsWith('<!--')) continue;
    const [, attrs, body] = m;
    if (attr(attrs, 'src') !== null) continue;
    if (!runs(attr(attrs, 'type'))) continue;
    const text = body.replace(/\r\n?/g, '\n');
    hashes.push(`sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`);
  }
  return hashes;
}

/**
 * A Content-Security-Policy as a Map of directive → source list (directive
 * names lower-cased, sources as written).
 * @param {string} csp
 * @returns {Map<string, string[]>}
 */
export function parseCsp(csp) {
  const directives = new Map();
  for (const part of String(csp).split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (name && !directives.has(name.toLowerCase())) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

/**
 * What is wrong with a Content-Security-Policy for a page whose inline
 * scripts have `hashes`: an inline script it would block, a hash no script
 * matches any more, script 'unsafe-inline' or 'unsafe-eval', or lost
 * frame-ancestors 'none' / object-src 'none'. Empty when the policy is fine.
 * @param {string | undefined} csp
 * @param {string[]} hashes from inlineScriptHashes()
 * @returns {string[]}
 */
export function cspProblems(csp, hashes) {
  if (!csp) return ['netlify.toml sets no Content-Security-Policy for "/*"'];
  const policy = parseCsp(csp);
  const problems = [];
  const scriptSrc = policy.get('script-src') || policy.get('default-src');
  if (!policy.has('script-src')) problems.push('the CSP has no script-src directive');
  const allowed = new Set((scriptSrc || []).map((s) => s.replace(/^'|'$/g, '')).filter((s) => /^sha(256|384|512)-/.test(s)));
  for (const hash of hashes) {
    if (!allowed.has(hash)) problems.push(`an inline script in index.html is blocked: add '${hash}' to script-src`);
  }
  for (const hash of allowed) {
    if (!hashes.includes(hash)) problems.push(`script-src allows '${hash}', which no inline script in index.html matches any more: remove it`);
  }
  for (const [name, sources] of policy) {
    if (sources.includes("'unsafe-eval'")) problems.push(`${name} allows 'unsafe-eval'`);
  }
  if ((scriptSrc || []).includes("'unsafe-inline'")) problems.push("script-src allows 'unsafe-inline'; hash each inline script instead");
  if ((policy.get('frame-ancestors') || []).join(' ') !== "'none'") problems.push("the CSP must keep frame-ancestors 'none'");
  if ((policy.get('object-src') || []).join(' ') !== "'none'") problems.push("the CSP must keep object-src 'none'");
  return problems;
}

/**
 * The headers netlify.toml sets for every path ("/*"), for `vite preview`.
 * @param {string} root the repository root
 * @returns {Record<string, string>}
 */
export function previewHeaders(root) {
  const rule = readNetlifyHeaders(readFileSync(path.join(root, 'netlify.toml'), 'utf8')).find((r) => r.for === '/*');
  if (!rule) throw new Error('netlify.toml has no [[headers]] rule for "/*"');
  return { ...rule.values };
}

/**
 * The values of every rule other than "/*" whose `for` matches `pathname`:
 * "/assets/*" matches anything under /assets/, "/favicon.ico" only itself.
 * Later rules win, as on Netlify.
 * @param {{ for: string, values: Record<string, string> }[]} rules
 * @param {string} pathname
 * @returns {Record<string, string>}
 */
export function pathHeaders(rules, pathname) {
  const out = {};
  for (const rule of rules) {
    if (rule.for === '/*') continue;
    const matches = rule.for.endsWith('/*') ? pathname.startsWith(rule.for.slice(0, -1)) : pathname === rule.for;
    if (matches) Object.assign(out, rule.values);
  }
  return out;
}

// The value of a [[redirects]] key: a "double-quoted" string, an integer
// status or a true/false force.
const REDIRECT_KEYS = {
  from: (raw, lineNo) => unquote(raw, lineNo),
  to: (raw, lineNo) => unquote(raw, lineNo),
  status: (raw, lineNo) => {
    const m = /^(\d{3})\s*(?:#.*)?$/.exec(raw);
    if (!m) throw new Error(`netlify.toml line ${lineNo}: status must be a number such as 200 or 404`);
    return Number(m[1]);
  },
  force: (raw, lineNo) => {
    const m = /^(true|false)\s*(?:#.*)?$/.exec(raw);
    if (!m) throw new Error(`netlify.toml line ${lineNo}: force must be true or false`);
    return m[1] === 'true';
  },
};

/**
 * The [[redirects]] rules of a netlify.toml, in file order. Only the keys
 * the site uses (from, to, status, force) are read; any other key inside a
 * rule throws, so netlifyResponse() never answers for a rule it half read.
 * @param {string} tomlText
 * @returns {{ from: string, to: string, status: number, force: boolean }[]}
 */
export function readNetlifyRedirects(tomlText) {
  const rules = [];
  let rule = null;
  const close = (lineNo) => {
    if (rule && (!rule.from || !rule.to)) throw new Error(`netlify.toml line ${lineNo}: a [[redirects]] rule needs from = "…" and to = "…"`);
    rule = null;
  };
  const lines = String(tomlText).split(/\r?\n/);
  lines.forEach((text, i) => {
    const lineNo = i + 1;
    const line = text.trim();
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('[')) {
      close(lineNo);
      const table = line.replace(/\s*#.*$/, '');
      if (table === '[[redirects]]') {
        rule = { from: null, to: null, status: 301, force: false };
        rules.push(rule);
      } else if (/^\[\[?redirects[.\]]/.test(table)) {
        throw new Error(`netlify.toml line ${lineNo}: unsupported redirects table ${table}`);
      }
      return;
    }
    if (!rule) return;
    const m = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(line);
    if (!m || !REDIRECT_KEYS[m[1]]) throw new Error(`netlify.toml line ${lineNo}: a [[redirects]] rule takes only from, to, status and force`);
    rule[m[1]] = REDIRECT_KEYS[m[1]](m[2], lineNo);
  });
  close(lines.length);
  return rules;
}

// Whether a rule's `from` matches a path: '/*' matches every path, '/x/*'
// matches /x and anything under it, any other `from` only itself. Netlify
// matches paths with or without a trailing slash alike.
function ruleMatches(from, path) {
  if (from === '/*') return true;
  if (from.endsWith('/*')) {
    const prefix = from.slice(0, -2);
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === (from.length > 1 ? from.replace(/\/+$/, '') : from);
}

/**
 * What Netlify answers for `pathname` (NEW-088): the deploy's own file, or
 * the first [[redirects]] rule that matches. A file at the path, at the path
 * plus .html (/product/61 -> product/61.html) or at its index.html is served
 * before any rule that isn't forced (Netlify's "shadowing"); a path no file
 * or rule answers gets the deploy's 404.html with status 404.
 * Paths are compared as written: Netlify's docs call rule paths
 * case-sensitive.
 * @param {string} pathname a decoded URL path
 * @param {{ redirects: ReturnType<typeof readNetlifyRedirects>, hasFile?: (path: string) => boolean }} options
 * @returns {{ status: number, file?: string, to?: string }}
 */
export function netlifyResponse(pathname, { redirects, hasFile = () => false }) {
  const raw = String(pathname || '/');
  const path = raw.length > 1 ? raw.replace(/\/+$/, '') || '/' : raw;
  const candidates = path === '/' ? ['/index.html'] : [path, `${path}.html`, `${path}/index.html`];
  const file = candidates.find((p) => hasFile(p)) || null;
  for (const rule of redirects) {
    if (!ruleMatches(rule.from, path)) continue;
    if (file && !rule.force) break;
    return { status: rule.status, to: rule.to };
  }
  if (file) return { status: 200, file };
  return { status: 404, to: '/404.html' };
}
