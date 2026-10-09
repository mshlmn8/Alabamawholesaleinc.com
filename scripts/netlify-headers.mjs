// The response headers in netlify.toml (AW-205, AW-182), read in Node with no
// dependency:
// - readNetlifyHeaders(toml): the [[headers]] rules as [{ for, values }];
// - inlineScriptHashes(html): the CSP hash of each inline script;
// - previewHeaders(root): the "/*" values, which `vite preview` sends so a
//   local production check runs under the same policy as Netlify;
// - cspProblems(csp, hashes): what scripts/check-headers.mjs and the unit
//   tests refuse in the policy.
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
