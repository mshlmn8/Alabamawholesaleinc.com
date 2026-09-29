// A text-level contract for the design system in src/index.css, the fonts in
// src/fonts and the static head in index.html (Phase 3). Later clusters extend
// it: the type scale, field, link, callout, danger and focus tokens.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOBILE_QUERY } from './lib/useMediaQuery.js';

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

// Every `@media` prelude, e.g. '(max-width: 37.5em)'.
const mediaPreludes = [...css.matchAll(/@media\s*([^{]+?)\s*\{/g)].map((m) => m[1]);
// Every declaration of `property`, with the selectors it belongs to.
const declared = (property) => rules(css).flatMap(({ selectors, body }) => {
  const value = declarations(body)[property];
  return value === undefined ? [] : [{ selector: selectors.join(', '), value }];
});
// Replaces var(--token) with the token's :root value.
const resolveVars = (value) => value.replace(/var\((--[\w-]+)\)/g, (m, token) => root[token] ?? m);

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

describe('type scale in rem with a 12px floor (AW-162, AW-174, AW-291)', () => {
  const sizes = [...declared('font-size'), ...declared('font')];

  it('defines the text, heading, tracking and tap tokens in rem, and no --text-md', () => {
    expect(root).toMatchObject({
      '--text-xs': '.75rem', '--text-sm': '.8125rem', '--text-base': '.875rem', '--text-lg': '1rem',
      '--h3': '1.625rem', '--h2-sm': '1.875rem', '--h2': '2.25rem', '--h2-lg': '2.625rem',
      '--track-label': '.075rem', '--track-eyebrow': '.125rem',
      '--tap': '2.75rem', '--tap-sm': '2.5rem',
    });
    expect(Object.keys(root)).not.toContain('--text-md');
    expect(css).not.toContain('--text-md');
    // No two type tokens share a size.
    const scale = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--h3', '--h2-sm', '--h2', '--h2-lg'].map((t) => parseFloat(root[t]));
    expect(new Set(scale).size).toBe(scale.length);
  });

  it('leaves the root font size to the browser', () => {
    for (const { selector, value } of declared('font-size')) expect(selector, value).not.toMatch(/^(html|:root)$/);
  });

  it('sets no font size in px, in font-size or in a font shorthand', () => {
    const px = sizes.filter(({ value }) => /\d(\.\d+)?px\b/.test(value));
    expect(px.map(({ selector, value }) => `${selector} { ${value} }`)).toEqual([]);
  });

  it('never goes below .75rem (12px), tokens included', () => {
    for (const { selector, value } of sizes) {
      const resolved = resolveVars(value);
      if (/^(inherit|\d+%)$/.test(resolved)) continue;
      const rems = [...resolved.matchAll(/(\d*\.?\d+)rem\b/g)].map((m) => parseFloat(m[1]));
      expect(rems.length, `${selector} { ${value} } has a rem size`).toBeGreaterThan(0);
      for (const rem of rems) expect(rem, `${selector} { ${value} }`).toBeGreaterThanOrEqual(0.75);
    }
    // The phone :root block may only redefine tokens, still in rem.
    for (const block of rootBlocks.slice(1)) {
      for (const [token, value] of Object.entries(declarations(block.body))) {
        if (/^--(text|h\d)/.test(token)) expect(value, token).toMatch(/^\d*\.?\d+rem$/);
      }
    }
  });

  it('spaces uppercase labels with the two tracking tokens', () => {
    for (const { selector, value } of declared('letter-spacing')) {
      if (/^(0|inherit|-\d*\.?\d+rem)$/.test(value)) continue;
      expect(value, selector).toMatch(/^var\(--track-(label|eyebrow)\)$/);
    }
  });

  it('lets text-holding controls grow with the text (min-height, not height)', () => {
    const controls = ['.aw-search', '.category-sort select', '.filter-search input', '.filter-drawer-body .category-sort select',
      '.order-head select', '.qr-field input', '.aw-table input', '.form-grid input', '.eligibility-form select'];
    for (const control of controls) {
      const matching = rules(css).filter((r) => r.selectors.includes(control));
      expect(matching.length, control).toBeGreaterThan(0);
      for (const { body } of matching) expect(declarations(body), control).not.toHaveProperty('height');
    }
  });

  it('gives the footer policy links full-size text and 44px targets', () => {
    const link = declarations(rules(css).find((r) => r.selectors.includes('.footer-policies a')).body);
    expect(link).toMatchObject({ 'font-size': 'var(--text-xs)', 'min-height': 'var(--tap)', 'min-width': 'var(--tap)' });
  });
});

describe('breakpoints in em, one compact-layout condition (AW-162, AW-151)', () => {
  it('writes every width and height breakpoint in em', () => {
    expect(mediaPreludes.filter((p) => /\d(px|rem)\b/.test(p))).toEqual([]);
  });

  it('switches to the compact layout with exactly the MOBILE_QUERY that Header and CategoryPage use', () => {
    const compact = mediaPreludes.filter((p) => p.includes('53.125em'));
    // The main responsive block, the support pages and the not-found page.
    expect(compact).toHaveLength(3);
    for (const prelude of compact) expect(prelude).toBe(MOBILE_QUERY);
  });
});

// Every `@media` block's prelude and the text between its braces (nested
// rules included), with the offsets of that text in the source.
const mediaBlocks = (source) => {
  const out = [];
  const re = /@media\s*([^{]+?)\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1, i = re.lastIndex;
    for (; i < source.length && depth; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    out.push({ prelude: m[1], start: re.lastIndex, end: i - 1, body: source.slice(re.lastIndex, i - 1) });
  }
  return out;
};

describe('one button system and drawn icons (AW-143, AW-298, AW-293, AW-218)', () => {
  const hoverBlocks = mediaBlocks(css).filter((b) => b.prelude === '(hover: hover)');
  const insideHover = hoverBlocks.map((b) => b.body).join('\n');
  const outsideHover = hoverBlocks.reduceRight((text, b) => text.slice(0, b.start) + text.slice(b.end), css);
  const rule = (selector) => declarations(rules(css).find((r) => r.selectors.join(', ') === selector)?.body ?? '');

  it('has one .button: label centred with no arrow slot, 2px corners, sentence case', () => {
    expect(rule('.button')).toMatchObject({ 'justify-content': 'center', gap: '.5rem', 'border-radius': '2px', 'min-height': 'var(--tap)', 'font-size': 'var(--text-sm)', 'font-weight': '700' });
    expect(rule('.button.sm')).toMatchObject({ 'min-height': 'var(--tap-sm)' });
    expect(rule('.button.xs')).toMatchObject({ 'min-height': '2rem', 'font-size': 'var(--text-xs)' });
    for (const variant of ['.button.ghost', '.button.on-dark', '.button.xs.text']) expect(Object.keys(rule(variant)).length, variant).toBeGreaterThan(0);
    for (const { selectors, body } of rules(css)) {
      if (!selectors.some((s) => /\.button\b/.test(s))) continue;
      expect(declarations(body)['text-transform'], selectors.join(', ')).toBeUndefined();
      expect(declarations(body)['justify-content'] ?? 'center', selectors.join(', ')).toBe('center');
    }
  });

  it('has no retired button, close, stepper or glyph-icon classes', () => {
    for (const cls of ['mini-btn', 'aw-signup', 'dialog-close', 'aw-menu-close', 'qty-stepper', 'grid-symbol', 'filter-icon', 'search-icon', 'aw-help-icon', 'aw-menu-bars', 'arrow']) {
      expect(css, cls).not.toMatch(new RegExp(`\\.${cls}(?![\\w-])`));
    }
    expect(Object.keys(root)).not.toContain('--icon-ring');
  });

  it('lets no header container rule out-rank the button sizes', () => {
    for (const { selectors, body } of rules(css)) {
      if (!selectors.some((s) => /^\.aw-account-actions (button|a)$/.test(s))) continue;
      for (const d of ['border-radius', 'min-height', 'padding', 'font-size']) expect(declarations(body), `${selectors.join(', ')} ${d}`).not.toHaveProperty(d);
    }
  });

  it('draws icons as SVG, not text: the breadcrumb slash is the only generated text', () => {
    const glyphs = declared('content').filter(({ value }) => !/^(''|counter\([\w-]+\))$/.test(value));
    expect(glyphs.map(({ selector }) => selector)).toEqual(['.crumbs li + li::before']);
    expect(css).not.toMatch(/[↗→⊞⌄×✓−]/);
    expect(rule('.icon')).toMatchObject({ width: '1em', height: '1em', flex: 'none', 'vertical-align': '-.125em' });
  });

  it('keeps button, icon-button and stepper hovers inside @media (hover: hover), and never on a disabled one', () => {
    const controls = /\.button|\.icon-btn|\.stepper/;
    for (const { selectors } of rules(outsideHover)) {
      for (const s of selectors) if (/:hover/.test(s)) expect(s).not.toMatch(controls);
    }
    const hovers = rules(insideHover).flatMap((r) => r.selectors).filter((s) => controls.test(s) && /:hover/.test(s));
    expect(hovers.length).toBeGreaterThanOrEqual(5);
    for (const s of hovers) expect(s).toMatch(/:not\(:disabled\):hover$/);
    // Focus rings are not hover states: they stay outside the hover blocks.
    expect(insideHover).not.toMatch(/:focus/);
  });

  it('fades every disabled control by the same amount, and gives buttons a pressed state', () => {
    expect(root['--disabled-opacity']).toBe('.5');
    for (const selector of ['.button:disabled', '.icon-btn:disabled, .stepper button:disabled', '.doc-file:disabled, fieldset:disabled .doc-file']) {
      expect(rule(selector), selector).toMatchObject({ opacity: 'var(--disabled-opacity)', cursor: 'not-allowed' });
    }
    const pressed = rules(outsideHover).find((r) => r.selectors.includes('.button:not(:disabled):active'));
    expect(pressed.selectors).toEqual(['.button:not(:disabled):active', '.icon-btn:not(:disabled):active', '.stepper button:not(:disabled):active']);
    expect(declarations(pressed.body)).toMatchObject({ transform: 'translateY(1px)', filter: 'brightness(.95)' });
  });
});
