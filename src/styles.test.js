// A text-level contract for the design system in src/index.css, the fonts in
// src/fonts and the static head in index.html (Phase 3). Later clusters extend
// it: the type scale, field, link, callout, danger and focus tokens.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
// A selector aimed at a form control: its last part is an input, select or
// textarea, a :where()/:is() list of them, or the file input's class.
const isField = (selector) => /^(input|select|textarea)\b|^\.doc-file(?![\w-])/.test(lastCompound(selector)) || /^:where\(.*\b(input|select)\b/.test(selector);

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
// Replaces var(--token) with the token's :root value, following tokens that
// point at other tokens (--field-font is var(--text-base)).
const resolveVars = (value) => {
  let out = value;
  for (let i = 0; i < 5 && /var\(--/.test(out); i++) out = out.replace(/var\((--[\w-]+)\)/g, (m, token) => root[token] ?? m);
  return out;
};

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
  it('uses no hex colour outside :root except white', () => {
    const hexes = [...outsideRoot.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
    const allowed = new Set(['#fff', '#ffffff']);
    expect(hexes.filter((h) => !allowed.has(h))).toEqual([]);
  });

  it('defines the shared colours once in :root', () => {
    for (const token of ['--purple-hover', '--surface-soft', '--line-soft', '--on-dark', '--on-dark-muted', '--on-dark-subtle', '--success', '--focus-on-dark']) {
      expect(root[token], token).toMatch(/^#[0-9a-f]{6}$/);
    }
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
    const fields = rules(css).filter(({ selectors }) => selectors.some((s) => s === '.aw-search' || (isField(s) && !/checkbox|radio/.test(s))));
    expect(fields.length).toBeGreaterThan(10);
    for (const { selectors, body } of fields) expect(declarations(body), selectors.join(', ')).not.toHaveProperty('height');
    expect(declarations(rules(css).find((r) => r.selectors.includes('.aw-search')).body)['min-height']).toBe('48px');
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

// WCAG relative luminance and contrast ratio of two #rgb/#rrggbb colours.
const luminance = (hex) => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = full.slice(1).match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('one field system (AW-146, AW-172, AW-147, AW-309)', () => {
  // With the fields PR #12, PR #13 and lane p2 added: the delivery ZIP check
  // (.eligibility-form input) and the admin quote editor (.order-edit-line).
  // The admin verification note is an .aw-table input.
  // The commerce lane added the stepper's quantity box (AW-013) and a cart
  // line's variant select (AW-011).
  const FIELD_CONTROLS = ['.form-grid :is(input, select, textarea)', '.filter-search input', '.category-sort select', '.eligibility-form :is(input, select)',
    '.qr-field input', '.qr-choice select', '.order-head select', '.order-edit-line input', '.aw-table :is(input, select)', '.doc-file',
    '.stepper input', '.drawer-line select'];
  const EXCLUDE = ':not([type=checkbox]):not([type=radio])';
  // The selector list inside `:where(:is(<list>)<suffix>)`, or null.
  const innerList = (selector, suffix) => {
    const prefix = ':where(:is(';
    const end = `)${suffix})`;
    if (!selector.startsWith(prefix) || !selector.endsWith(end)) return null;
    return splitList(selector.slice(prefix.length, -end.length));
  };
  const all = rules(css);
  const base = all.find(({ selectors }) => selectors.length === 1 && innerList(selectors[0], EXCLUDE)?.includes('.form-grid :is(input, select, textarea)'));
  const selectRule = all.find(({ body }) => declarations(body).appearance === 'none');
  const selectList = selectRule ? splitList(selectRule.selectors[0].replace(/^:where\((.*)\)$/, '$1')) : [];

  it('defines the field tokens once, with a border of at least 3:1 on every surface a field sits on', () => {
    expect(root).toMatchObject({
      '--field-h': '2.75rem', '--field-h-compact': '2.125rem', '--field-bg': '#fff',
      '--field-border': '#857d8a', '--field-radius': '2px', '--field-font': 'var(--text-base)',
    });
    for (const surface of ['--field-bg', '--surface-soft', '--paper', '--cream']) {
      expect(contrast(root['--field-border'], root[surface]), surface).toBeGreaterThanOrEqual(3);
    }
    // The old low-contrast borders are gone.
    for (const hex of ['#dcd5cc', '#d8d1c9', '#b9aed0']) expect(css.toLowerCase()).not.toContain(hex);
  });

  it('raises field text to 16px on touch screens and in the compact layout, so iOS does not zoom on focus', () => {
    const blocks = mediaBlocks(css);
    for (const prelude of ['(pointer: coarse)', MOBILE_QUERY]) {
      const rootRule = blocks.filter((b) => b.prelude === prelude).flatMap((b) => rules(b.body)).find((r) => r.selectors.join() === ':root');
      expect(rootRule, prelude).toBeTruthy();
      expect(declarations(rootRule.body), prelude).toMatchObject({ '--field-font': '1rem', '--field-h-compact': 'var(--field-h)' });
    }
    // The header search box follows the token instead of its own phone size.
    expect(declarations(all.find((r) => r.selectors.join() === '.aw-search input').body)['font-size']).toBe('var(--field-font)');
  });

  it('styles every text box, select and file input with one zero-specificity rule, checkboxes and radios excepted', () => {
    expect(base, 'shared field rule').toBeTruthy();
    expect(innerList(base.selectors[0], EXCLUDE)).toEqual(FIELD_CONTROLS);
    expect(declarations(base.body)).toMatchObject({
      'min-height': 'var(--field-h)', padding: '0 .75rem', border: '1px solid var(--field-border)', 'border-radius': 'var(--field-radius)',
      'background-color': 'var(--field-bg)', color: 'var(--ink)', 'font-size': 'var(--field-font)',
    });
    // background-color, not the shorthand, so the select chevron survives.
    expect(declarations(base.body)).not.toHaveProperty('background');
    const compact = all.find(({ selectors }) => innerList(selectors[0], EXCLUDE)?.join() === '.aw-table :is(input, select),.order-head select,.stepper input');
    expect(declarations(compact.body)).toEqual({ 'min-height': 'var(--field-h-compact)' });
    const focus = all.find(({ selectors }) => innerList(selectors[0], ':focus'));
    expect(innerList(focus.selectors[0], ':focus')).toEqual(FIELD_CONTROLS);
    expect(declarations(focus.body)).toEqual({ 'border-color': 'var(--purple)' });
  });

  it('leaves no field with its own border, fill, corner, height or text size', () => {
    const visual = ['border', 'border-color', 'border-radius', 'background', 'background-color', 'font-size', 'min-height', 'height', 'color', 'padding'];
    for (const { selectors, body } of all) {
      if (selectors.some((s) => s.startsWith(':where('))) continue;
      for (const selector of selectors) {
        if (!isField(selector) || /checkbox|radio|::/.test(selector) || selector.startsWith('.aw-search ')) continue;
        for (const property of visual) expect(declarations(body), `${selector} ${property}`).not.toHaveProperty(property);
      }
    }
  });

  it('draws every select without the native menulist, with the chevron file and the native arrow in forced colours', () => {
    expect(declarations(selectRule.body)).toMatchObject({
      '-webkit-appearance': 'none', appearance: 'none', 'padding-right': '2.25rem',
      'background-image': "url('./assets/icons/chevron-down.svg')", 'background-repeat': 'no-repeat',
      'background-position': 'right .75rem center', 'background-size': '.75rem .5rem',
    });
    expect(declarations(selectRule.body)).not.toHaveProperty('background');
    expect(existsSync(resolve(process.cwd(), 'src/assets/icons/chevron-down.svg'))).toBe(true);
    // Every rule that styles a select is for a select the appearance rule covers.
    const styled = all.flatMap((r) => r.selectors).filter((s) => /^select\b/.test(lastCompound(s)) && s !== 'select' && !s.startsWith(':where('));
    expect(styled.length).toBeGreaterThan(5);
    for (const s of styled) expect(selectList.some((covered) => s === covered || s.endsWith(` ${covered}`)), s).toBe(true);
    for (const control of FIELD_CONTROLS.filter((c) => /select/.test(c))) {
      const container = control.split(' ')[0];
      expect(selectList, control).toContain(`${container} select`);
    }
    const forced = mediaBlocks(css).find((b) => b.prelude === '(forced-colors: active)');
    expect(declarations(rules(forced.body).find((r) => r.selectors.join() === 'select').body)).toMatchObject({ appearance: 'auto', 'background-image': 'none', 'padding-right': '.75rem' });
  });

  it('keeps assets out of data: URIs, so the CSP needs no data: images or fonts', () => {
    expect(css).not.toMatch(/url\(\s*['"]?data:/);
    expect(read('vite.config.js')).toMatch(/assetsInlineLimit:\s*0,/);
  });

  it('gives every field label one style', () => {
    const labels = ['.form-grid label', '.contact-grid dt', '.eligibility-form label', '.qr-field span', '.qr-choice span',
      '.category-sort', '.filter-search', '.doc-upload label', '.filter-panel legend', '.doc-uploads legend', '.order-edit-line label', '.account-note'];
    const typography = { 'font-size': 'var(--text-xs)', 'font-weight': '700', 'letter-spacing': 'var(--track-label)', color: 'var(--purple)', 'text-transform': 'uppercase' };
    const shared = all.find((r) => r.selectors.includes('.doc-uploads legend') && declarations(r.body)['text-transform']);
    expect(shared.selectors).toEqual(labels);
    expect(declarations(shared.body)).toEqual(typography);
    for (const { selectors, body } of all) {
      if (body === shared.body) continue;
      for (const s of selectors.filter((x) => labels.includes(x))) {
        for (const property of Object.keys(typography)) expect(declarations(body), `${s} ${property}`).not.toHaveProperty(property);
      }
    }
  });

  it('styles the file button in two rules (Safari 14 knows only the -webkit- name) and hides the native search clear', () => {
    const standard = all.find((r) => r.selectors.join() === '.doc-file::file-selector-button');
    const webkit = all.find((r) => r.selectors.join() === '.doc-file::-webkit-file-upload-button');
    expect(declarations(standard.body)).toMatchObject({ border: '1px solid var(--purple)', color: 'var(--purple)', font: '700 var(--text-sm) var(--body)', 'border-radius': '2px' });
    expect(declarations(webkit.body)).toEqual(declarations(standard.body));
    expect(declarations(all.find((r) => r.selectors.join() === 'input[type=search]::-webkit-search-cancel-button').body)).toEqual({ '-webkit-appearance': 'none' });
  });
});

// The components' markup uses the design system: the pieces PR #12, PR #13 and
// lane p2 added (warning band, licence and consent fields, admin details row
// and quote editor, "Photo coming soon", the card buttons and "Added", variant
// chips, the delivery ZIP check) take the button, field and icon rules rather
// than classes of their own.
const sourceFiles = (dir) => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
  const path = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return sourceFiles(path);
  return /\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
});
// Code without its comments ({/* … */}, /* … */ and // … to the end of a line).
const code = (text) => text.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const jsx = sourceFiles('src').filter((f) => f.endsWith('.jsx')).map((file) => ({ file, text: code(read(file)) }));

describe('the markup uses the design system (merged PR #12, PR #13 and lane p2 pieces)', () => {
  it('has no retired button or stepper classes in any component', () => {
    for (const { file, text } of jsx) {
      expect(text, file).not.toMatch(/className=\{?["'`][^"'`]*\b(mini-btn|aw-signup|dialog-close|aw-menu-close|qty-stepper|card-stepper-btn)\b/);
    }
  });

  it('draws icons as SVG: no arrow, tick, cross or chevron glyphs in any component', () => {
    // A multiplication sign between a quantity and a name ("2 × Kite") is text, not an icon.
    for (const { file, text } of jsx) expect(text, file).not.toMatch(/[↗→⊞⌄✓]/);
  });

  it('marks only new-tab links that leave the site with the external icon', () => {
    let seen = 0;
    for (const { file, text } of jsx) {
      for (const [link] of text.matchAll(/<(a|Link)\b[^>]*target="_blank"[^>]*>[\s\S]*?<\/\1>/g)) {
        const leaves = /href=\{(creditSource|DIRECTIONS_URL|signedUrls)/.test(link);
        expect(/<Icon name="external"/.test(link), `${file}: ${link.slice(0, 80)}`).toBe(leaves);
        expect(link, file).toMatch(/opens in a new tab/);
        seen += 1;
      }
    }
    // Directions, the photo credit, an admin's document, and the two policies
    // beside the application's consent box (these stay on the site).
    expect(seen).toBe(5);
  });

  it('sets no inline px font size in any component (AW-162)', () => {
    for (const { file, text } of jsx) expect(text, file).not.toMatch(/fontSize:\s*\d/);
  });

  it('gives the compact admin buttons and the stepper full-size targets on touch screens', () => {
    const coarse = mediaBlocks(css).filter((b) => b.prelude === '(pointer: coarse)').flatMap((b) => rules(b.body));
    expect(declarations(coarse.find((r) => r.selectors.join() === '.button.xs').body)).toEqual({ 'min-height': 'var(--tap)' });
    expect(declarations(coarse.find((r) => r.selectors.join() === '.stepper button').body)).toEqual({ width: 'var(--tap)', height: 'var(--tap)' });
  });

  it('keeps a wide admin table from widening the page: its .sr-only labels stay inside the scroller', () => {
    const scroller = declarations(rules(css).find((r) => r.selectors.join() === '.table-scroll').body);
    expect(scroller).toMatchObject({ position: 'relative', 'overflow-x': 'auto' });
  });

  it('styles the card buttons, the sold-out state and the order actions with .button', () => {
    const card = code(read('src/components/ProductCard.jsx'));
    expect(card.match(/className="button ghost sm card-add"/g)).toHaveLength(3);
    // "Not available" uses the button's own disabled state.
    expect(card).toMatch(/className="button ghost sm card-add" type="button" disabled/);
    expect(css).not.toMatch(/\.card-add:disabled/);
    const admin = code(read('src/pages/admin/AdminPage.jsx'));
    expect(admin).toMatch(/className="button" type="button" disabled=\{busy \|\| !workflow\} onClick=\{save\}>Save prices/);
  });
});
