// A text-level contract for the design system in src/index.css, the fonts in
// src/fonts and the static head in index.html (Phase 3). Later clusters extend
// it: the type scale, field, link, callout, danger and focus tokens.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root.
const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const css = stripComments(read('src/index.css'));
const fontsCss = stripComments(read('src/fonts/fonts.css'));
const html = read('index.html');
const pkg = JSON.parse(read('package.json'));

// Splits a selector list on the commas that are not inside :where() / :not().
const splitList = (text) => {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  return [...parts, text.slice(start)].map((s) => s.trim().replace(/\s+/g, ' '));
};
// Every `selector { declarations }` pair, including the ones inside @media.
// Nested braces only occur in at-rules, and the pattern skips their headers.
const rules = (source) => [...source.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: splitList(m[1]),
  body: m[2],
}));
const declarations = (body) => Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
const lastCompound = (selector) => selector.split(/\s*[\s>+~]\s*/).pop();

const rootBlocks = rules(css).filter((r) => r.selectors.length === 1 && r.selectors[0] === ':root');
const root = declarations(rootBlocks[0].body);
const outsideRoot = css.replace(/:root\s*\{[^{}]*\}/g, '');

// Field borders stay hex until C4 (AW-146, AW-172) replaces them with --field-border.
const FIELD_BORDER_HEXES = ['#dcd5cc', '#d8d1c9', '#b9aed0'];

describe('no Tailwind (AW-125)', () => {
  it('has no Tailwind directives, config or dependency', () => {
    expect(css).not.toMatch(/@tailwind|@apply/);
    expect(existsSync(resolve(process.cwd(), 'tailwind.config.js'))).toBe(false);
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('tailwindcss');
    expect(read('postcss.config.js')).not.toMatch(/tailwind/);
  });

  it('keeps the explicit reset the layout relies on', () => {
    const rule = (selector) => declarations(rules(css).find((r) => r.selectors.join(', ') === selector)?.body ?? '');
    expect(rule('*, ::before, ::after')).toMatchObject({ 'box-sizing': 'border-box', 'border-width': '0', 'border-style': 'solid' });
    expect(rule(':where(h1, h2, h3, h4, h5, h6)')).toMatchObject({ 'font-size': 'inherit', 'font-weight': 'inherit' });
    expect(rule(':where(ul[class], ol[class], menu[class])')).toMatchObject({ 'list-style': 'none', margin: '0', padding: '0' });
    expect(rule(':where(img, video)')).toMatchObject({ 'max-width': '100%', height: 'auto' });
    expect(rule(':where(button, input, optgroup, select, textarea)')).toMatchObject({ font: 'inherit', color: 'inherit', margin: '0' });
  });

  it('shows bullets in the policy lists', () => {
    const policyList = rules(css).find((r) => r.selectors.includes('.policy-body ul'));
    expect(declarations(policyList.body)['list-style']).toBe('disc');
  });

  it('keeps support-page paragraph rules off classed paragraphs (eyebrows, notes)', () => {
    const containers = ['.page-head', '.info-card', '.support-block', '.contact-strip', '.support-cta', '.eligibility', '.status-panel', '.policy-body'];
    for (const { selectors } of rules(css)) {
      for (const selector of selectors) {
        if (!containers.some((c) => selector.startsWith(c) || selector.includes(` ${c}`))) continue;
        if (!/^p(?![\w-])/.test(lastCompound(selector))) continue;
        expect(selector, `${selector} also matches p.eyebrow and p.support-note`).toMatch(/p:not\(\[class\]\)/);
      }
    }
  });

  it('gives every empty state the same vertical padding', () => {
    expect(root['--empty-pad']).toBeTruthy();
    for (const cls of ['.empty-results', '.empty-note']) {
      const rule = rules(css).find((r) => r.selectors.includes(cls));
      expect(declarations(rule.body).padding, cls).toMatch(/^var\(--empty-pad\)/);
    }
  });
});

describe('colour tokens (AW-292)', () => {
  it('uses no hex colour outside :root except white and the field borders C4 replaces', () => {
    const hexes = [...outsideRoot.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
    const allowed = new Set(['#fff', '#ffffff', ...FIELD_BORDER_HEXES]);
    expect(hexes.filter((h) => !allowed.has(h))).toEqual([]);
  });

  it('defines the shared colours once in :root', () => {
    for (const token of ['--purple-hover', '--surface-soft', '--line-soft', '--on-dark', '--on-dark-muted', '--on-dark-subtle', '--success', '--focus-on-dark']) {
      expect(root[token], token).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(Object.keys(root)).not.toContain('--field-border');
  });
});

describe('one heading colour (AW-294)', () => {
  it('sets h1 and h2 purple in one rule, and only white on purple surfaces elsewhere', () => {
    const shared = rules(css).find((r) => r.selectors.join(',') === 'h1,h2');
    expect(declarations(shared.body).color).toBe('var(--purple)');
    for (const { selectors, body } of rules(css)) {
      const color = declarations(body).color;
      if (!color || selectors.join(',') === 'h1,h2') continue;
      for (const selector of selectors) {
        if (/^h[12]\b/.test(lastCompound(selector))) expect(`${selector} { color: ${color} }`).toMatch(/color: #fff \}$/);
      }
    }
  });
});

describe('light only (AW-038)', () => {
  it('declares color-scheme first in :root and in the static head', () => {
    expect(rootBlocks[0].body.trim()).toMatch(/^color-scheme:\s*only light;/);
    const head = html.slice(0, html.indexOf('</head>'));
    // Directly after theme-color, ahead of any stylesheet, so it applies from first paint.
    expect(head).toMatch(/<meta name="theme-color"[^>]*\/>\s*(<!--[\s\S]*?-->\s*)?<meta name="color-scheme" content="only light" \/>/);
  });
});

describe('fonts (AW-178)', () => {
  const preloads = [...html.matchAll(/<link rel="preload" href="\/src\/fonts\/([^"]+\.woff2)" as="font" type="font\/woff2" crossorigin \/>/g)].map((m) => m[1]);

  it('preloads the body font and the heading weight from the bundled files', () => {
    expect(preloads).toEqual(['dm-sans-latin-variable.woff2', 'barlow-condensed-latin-700.woff2']);
    for (const file of preloads) {
      expect(existsSync(resolve(process.cwd(), 'src/fonts', file)), file).toBe(true);
      expect(fontsCss).toContain(`url('./${file}')`);
    }
  });

  it('stacks each web font on its metric-matched fallback, with no Impact or Verdana', () => {
    expect(root['--display']).toBe("'Barlow Condensed', 'Barlow Condensed Fallback', sans-serif");
    expect(root['--body']).toBe("'DM Sans', 'DM Sans Fallback', sans-serif");
    expect(`${css}\n${fontsCss}`).not.toMatch(/Impact|Verdana/);
  });

  it('defines measured fallback faces, with a real bold so nothing is synthesised', () => {
    const faces = rules(fontsCss).filter((r) => r.selectors[0] === '@font-face').map((r) => declarations(r.body));
    const fallback = (family) => faces.filter((f) => f['font-family'] === `'${family}'`);
    expect(fallback('DM Sans Fallback').map((f) => f['font-weight'])).toEqual(expect.arrayContaining(['400', '700']));
    expect(fallback('Barlow Condensed Fallback').map((f) => f['font-weight'])).toEqual(['500', '600', '700']);
    for (const face of [...fallback('DM Sans Fallback'), ...fallback('Barlow Condensed Fallback')]) {
      expect(face.src).toMatch(/^local\(/);
      for (const d of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) expect(face[d], d).toMatch(/^\d+(\.\d+)?%$/);
    }
    expect(fallback('DM Sans Fallback').find((f) => f['font-weight'] === '700').src).toContain("local('Arial Bold')");
  });
});
