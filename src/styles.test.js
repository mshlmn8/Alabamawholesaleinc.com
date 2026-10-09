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
// The stylesheet with every @media block taken out, with its nested rules and
// nested @media blocks (a hover block inside the compact block, AW-160).
const withoutMedia = (source) => {
  const re = /@media[^{]*\{/g;
  let out = '', from = 0, m;
  while ((m = re.exec(source))) {
    let depth = 1, i = re.lastIndex;
    for (; i < source.length && depth; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    out += source.slice(from, m.index);
    from = re.lastIndex = i;
  }
  return out + source.slice(from);
};
const outsideMedia = withoutMedia(css);

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
    for (const token of ['--purple-hover', '--surface-soft', '--line-soft', '--on-dark', '--on-dark-muted', '--on-dark-subtle', '--success', '--success-bg', '--danger', '--danger-bg', '--focus-on-dark']) {
      expect(root[token], token).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('defines each token once, in the main :root block; media blocks only redefine existing ones', () => {
    const names = rootBlocks[0].body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => d.slice(0, d.indexOf(':')).trim());
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    for (const block of rootBlocks.slice(1)) {
      for (const token of Object.keys(declarations(block.body))) expect(names, token).toContain(token);
    }
    // One plain :root rule outside @media.
    expect([...outsideMedia.matchAll(/(^|[};])\s*:root\s*\{/g)]).toHaveLength(1);
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

  it('draws icons as SVG, not text: the breadcrumb slash and the error mark are the only generated text', () => {
    // Step counters are zero-padded (AW-296); the error mark is the ringed '!' (AW-295).
    const glyphs = declared('content').filter(({ value }) => !/^(''|counter\([\w-]+, decimal-leading-zero\))$/.test(value));
    expect(glyphs.map(({ selector }) => selector)).toEqual(['.crumbs li + li::before', '.form-error:not(:empty)::before']);
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

// Interaction states (AW-145, AW-160, AW-175, AW-302): hover only where there
// is a mouse, a pressed state for touch, the selected state in forced colours,
// and 44px targets on touch screens.
describe('interaction states (AW-145, AW-160, AW-175, AW-302)', () => {
  const RULE = /([^{};]+)\{([^{}]*)\}/g;
  const blocks = mediaBlocks(css);
  const hoverBlocks = blocks.filter((b) => b.prelude === '(hover: hover)');
  // The stylesheet without what the hover blocks hold, nested blocks included.
  const outsideHover = hoverBlocks.reduceRight((text, b) => text.slice(0, b.start) + text.slice(b.end), css);
  const hoverRules = hoverBlocks.flatMap((b) => rules(b.body));
  const coarseBlocks = blocks.filter((b) => b.prelude === '(pointer: coarse)');
  const coarseRules = coarseBlocks.flatMap((b) => rules(b.body));
  const compact = blocks.find((b) => b.prelude === MOBILE_QUERY && b.body.includes('.aw-search > button {'));
  const inHover = (selector) => declarations(hoverRules.find((r) => r.selectors.includes(selector))?.body ?? '');
  const outside = (selector) => declarations(rules(outsideHover).find((r) => r.selectors.includes(selector))?.body ?? '');
  const own = (selector) => declarations(rules(css).find((r) => r.selectors.join(', ') === selector)?.body ?? '');

  it('keeps every :hover inside @media (hover: hover), so a tap leaves no hover colour behind', () => {
    expect(hoverBlocks.length).toBeGreaterThan(15);
    expect(rules(outsideHover).flatMap((r) => r.selectors).filter((s) => s.includes(':hover'))).toEqual([]);
    expect(outsideHover).not.toMatch(/:hover/);
    // The compact search button's hover is nested in the compact block, whose
    // prelude stays MOBILE_QUERY.
    expect(compact.body).toMatch(/@media \(hover: hover\) \{\s*\.aw-search > button:hover \{/);
  });

  it('keeps the open categories toggle the lighter purple without hover', () => {
    expect(outside('.aw-category-toggle[aria-expanded="true"]')).toEqual({ background: 'var(--purple-hover)' });
    expect(rules(outsideHover).find((r) => r.selectors.includes('.aw-category-toggle[aria-expanded="true"]')).selectors).toHaveLength(1);
    expect(inHover('.aw-category-toggle:hover')).toEqual({ background: 'var(--purple-hover)' });
  });

  it('shows a mouse that cards, tiles, collection cards, nav links, chips and the pricing prompt are clickable', () => {
    for (const s of ['.card-link:hover .card-block', 'a.content-card:hover .card-block']) expect(inHover(s), s).toEqual({ 'border-color': 'var(--purple)' });
    for (const s of ['.card-link:hover h3', 'a.content-card:hover h3']) expect(inHover(s), s).toEqual({ 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    for (const s of ['.card-link:hover .card-block img', 'a.content-card:hover .card-block img']) expect(inHover(s), s).toEqual({ transform: 'scale(1.03)' });
    // One transition list on the card photo (a later fade adds to it); the
    // reduced-motion rule removes it.
    expect(own('.card-block img').transition).toMatch(/(^|, )transform \.2s ease(,|$)/);
    expect(inHover('.editorial-card:hover .text-link')).toEqual({ 'text-decoration-thickness': '2px' });
    expect(inHover('.editorial-card:hover img.bg')).toEqual({ opacity: '.36' });
    for (const s of ['.section-head > a:hover', '.aw-utility a:hover', '.sku-details summary:hover']) expect(inHover(s), s).toEqual({ color: 'var(--orange-dark)' });
    expect(inHover('.variant-chips button:not(:disabled):not([aria-checked="true"]):hover')).toEqual({ 'border-color': 'var(--purple)' });
    expect(inHover('button.filter-signin:hover')).toEqual({ 'border-left-color': 'var(--purple)' });
    expect(inHover('button.filter-signin:hover span')).toEqual({ 'text-decoration-thickness': '2px' });
    // Keyboard focus underlines the card title too, outside the hover blocks.
    for (const s of ['.card-link:focus-visible h3', 'a.content-card:focus-visible h3']) expect(outside(s), s).toMatchObject({ 'text-decoration': 'underline' });
  });

  it('never turns a link orange on a purple surface', () => {
    const purple = /^(\.trade-bar|\.footer|\.contact-strip|\.editorial-card|\.age-gate|\.fda-note)/;
    const onPurple = hoverRules.filter((r) => r.selectors.some((s) => purple.test(s)));
    expect(onPurple.length).toBeGreaterThan(3);
    for (const { selectors, body } of onPurple) expect(body, selectors.join(', ')).not.toMatch(/--orange/);
  });

  it('gives tappable controls a pressed state outside the hover blocks that never hides the selected one', () => {
    const pressed = {
      '.sub-pill:not(.active):active': 'var(--paper)',
      '.variant-chips button:not(:disabled):not([aria-checked="true"]):active': 'var(--line)',
      '.dept-jump a:active': 'var(--paper)',
      '.policy-nav a:active': 'var(--line)',
      '.menu-group a:active': 'var(--paper)',
      '.menu-group button:not(:disabled):active': 'var(--paper)',
      '.filter-toggle:active': 'var(--purple-hover)',
      '.active-filters > li > button:not(.text-link):active': 'var(--purple-hover)',
      '.aw-category-toggle:active': 'var(--purple-hover)',
      '.aw-search > button:active': 'var(--line)',
    };
    for (const [selector, background] of Object.entries(pressed)) expect(outside(selector), selector).toEqual({ background });
    // The compact layout's purple search button presses to the lighter purple.
    expect(declarations(rules(compact.body).find((r) => r.selectors.join() === '.aw-search > button:active').body)).toEqual({ background: 'var(--purple-hover)' });
  });

  it('shows the chosen variant, line, admin tab, policy page and hero slide dot in the system highlight in forced colours', () => {
    const forced = blocks.find((b) => b.prelude === '(forced-colors: active)');
    const selected = rules(forced.body).find((r) => r.selectors.includes('.sub-pill.active'));
    expect(selected.selectors).toEqual(['.variant-chips button[aria-checked="true"]', '.sub-pill.active', '.sub-pill[aria-current="page"]', 'nav.policy-nav a[aria-current="page"]',
      '.home-carousel-dots [aria-current="true"] span']);
    expect(declarations(selected.body)).toEqual({ 'forced-color-adjust': 'none', background: 'Highlight', color: 'HighlightText', 'border-color': 'Highlight' });
    const ring = rules(forced.body).find((r) => r.selectors.includes('.sub-pill.active:focus-visible'));
    expect(declarations(ring.body)).toEqual({ 'outline-color': 'CanvasText' });
    // The menu and filter icons are SVG strokes in currentColor, so they take the forced text colour.
    expect(read('src/components/Icon.jsx')).toMatch(/stroke="currentColor"/);
  });

  it('makes the small controls 44px targets on touch screens, after their own rules, links in a sentence excepted', () => {
    expect(declarations(coarseRules.find((r) => r.selectors.join() === ':root').body)).toMatchObject({ '--tap-sm': 'var(--tap)' });
    // Everything sized with --tap-sm follows it.
    for (const s of ['.button.sm', '.icon-btn', '.sub-pill', '.variant-chips button', '.filter-panel fieldset label', '.card-meta']) {
      expect(Object.values(own(s)).join(' '), s).toMatch(/var\(--tap-sm\)/);
    }
    const TOUCH = ['.trade-bar a', '.trade-bar button', '.aw-menu-footer a', '.aw-logo', '.aw-department a', '.text-link', '.crumbs li', '.crumbs a',
      '.active-filters > li > button', '.filter-heading .text-link', '.footer-grid button', '.footer-grid .footer-link', '.footer-grid p > a', 'a.info-lead',
      '.policy-nav a', '.dept-jump a', '.sku-details summary'];
    const at = (source, offset = 0) => [...source.matchAll(RULE)].map((m) => ({ selectors: splitList(m[1]), body: m[2], index: offset + m.index }));
    const touchRules = coarseBlocks.flatMap((b) => at(b.body, b.start));
    const inAnyBlock = (index) => blocks.some((b) => index >= b.start && index < b.end);
    const baseRules = at(css).filter((r) => !inAnyBlock(r.index));
    for (const selector of TOUCH) {
      const touch = touchRules.find((r) => r.selectors.includes(selector));
      expect(declarations(touch?.body ?? ''), selector).toMatchObject({ 'min-height': 'var(--tap)' });
      // Later than the control's own min-height, so it wins at the same specificity.
      for (const base of baseRules.filter((r) => r.selectors.includes(selector) && 'min-height' in declarations(r.body))) {
        expect(touch.index, selector).toBeGreaterThan(base.index);
      }
    }
    // A link inside a sentence and the collection cards' link stay inline.
    expect(own('p > .text-link')).toEqual({ 'min-height': '0', 'min-width': '0' });
    expect(own('.editorial-card .text-link')).toMatchObject({ 'min-height': '0' });
    // The stepper's quantity box (AW-013) has a capped width, so the stepper
    // is as wide as its buttons need and they keep their size wherever there
    // is room; the percentage lets it give way first in a narrow line.
    expect(own('.stepper input')).toMatchObject({ width: '100%', 'max-width': 'calc(6ch + 1.5rem + 2px)', 'min-width': '0' });
  });
});

// Photos while they load and when they fail (AW-192, AW-341, AW-345). Picture
// and Thumb add .is-loaded once a photo is in, and swap a failed photo for its
// placeholder in the markup; these rules cover the moments in between.
describe('photo loading states (AW-192, AW-341, AW-345)', () => {
  const all = rules(css);
  const own = (selector) => declarations(all.find((r) => r.selectors.join(', ') === selector)?.body ?? '');
  const ruleWith = (selector) => all.find((r) => r.selectors.includes(selector));

  it('never paints alt text over a tile, a thumbnail, the hero or a collection card', () => {
    for (const s of ['.card-block img', '.pd-media img', '.sr-thumb img', '.drawer-line .thumb img', '.home-carousel-slide img', '.editorial-card img.bg']) {
      expect(all.some((r) => r.selectors.includes(s) && declarations(r.body).color === 'transparent'), s).toBe(true);
    }
  });

  it('fades in lazy photos only, so the product page photo and the first hero slide are never hidden', () => {
    const fade = ruleWith('.card-block img[loading="lazy"]:not(.is-loaded)');
    expect(fade.selectors).toEqual(['.card-block img[loading="lazy"]:not(.is-loaded)', '.pd-media img[loading="lazy"]:not(.is-loaded)']);
    expect(declarations(fade.body)).toEqual({ opacity: '0' });
    // No other rule hides a photo.
    for (const r of all.filter((x) => declarations(x.body).opacity === '0')) {
      for (const s of r.selectors.filter((x) => /^img\b|\simg\b/.test(x))) expect(s).toMatch(/img\[loading="lazy"\]:not\(\.is-loaded\)$/);
    }
    // One transition list on the card photo, with the hover zoom.
    expect(own('.card-block img').transition).toBe('opacity .2s ease, transform .2s ease');
    expect(own('.pd-media img').transition).toBe('opacity .2s ease');
  });

  it('shows a sheen, in tokens, only on a tile whose photo is still on its way', () => {
    const sheen = ruleWith('.card-block:has(img:not(.is-loaded))');
    expect(sheen.selectors).toEqual(['.card-block:has(img:not(.is-loaded))', '.pd-media:has(img:not(.is-loaded))']);
    const d = declarations(sheen.body);
    expect(d.background).toBe('linear-gradient(100deg, var(--tile) 40%, var(--paper) 50%, var(--tile) 60%) var(--tile)');
    expect(d).toMatchObject({ 'background-size': '200% 100%', animation: 'aw-sheen 1.2s linear infinite' });
    expect(css).toMatch(/@keyframes aw-sheen \{ to \{ background-position: -200% 0; \} \}/);
    // ":not(:has(img.is-loaded))" would also match the placeholder tiles, which have no img.
    expect(css).not.toMatch(/:not\(:has\(/);
    // The reduced-motion rule stops it.
    const reduced = mediaBlocks(css).find((b) => b.prelude === '(prefers-reduced-motion:reduce)');
    expect(rules(reduced.body).find((r) => r.selectors.includes('*'))?.body).toMatch(/animation: none !important/);
  });

  it('hides the sell-unit badge on the placeholder of a photo that failed', () => {
    expect(own('.photo-soon ~ .pack-badge')).toEqual({ display: 'none' });
  });

  it('hides the product page photo credit while the placeholder stands in for the photo', () => {
    // ProductPage renders figure.pd-figure > .pd-media + figcaption.photo-credit.
    expect(own('.pd-media:has(.photo-soon) + .photo-credit')).toEqual({ display: 'none' });
  });

  it('prints no label or tag over a photo: the tag is a chip in the text, the department label is gone (AW-055)', () => {
    const selectors = all.flatMap((r) => r.selectors);
    expect(selectors.filter((s) => /\.block-(label|foot)\b/.test(s))).toEqual([]);
    // Every .card-tag rule, at every width, leaves it in the flow.
    for (const r of all.filter((x) => x.selectors.some((s) => /\.card-tag\b/.test(s)))) {
      for (const property of ['position', 'top', 'right', 'bottom', 'left', 'z-index']) expect(declarations(r.body), `${r.selectors} ${property}`).not.toHaveProperty(property);
    }
    expect(own('.card-tag')).toMatchObject({ display: 'inline-block', background: 'var(--button-orange)', color: '#fff', 'font-size': 'var(--text-xs)' });
    expect(own('.card-tag.new')).toEqual({ background: 'var(--purple)' });
    expect(own('.card-kicker')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center' });
    expect(own('.pd-info .pd-brand')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center' });
    expect(read('src/pages/ProductPage.jsx')).not.toMatch(/<div className="pd-media">\s*\{p\.tag/);
  });

  it('lines up the card action rows across a grid row (AW-215)', () => {
    expect(own('.content-card')).toMatchObject({ display: 'flex', 'flex-direction': 'column' });
    expect(own('.content-card > .card-actions')).toEqual({ 'margin-top': 'auto' });
    // The pricing lock always takes its own line, so every lock card's row has the same height.
    expect(own('.card-meta .lock')).toMatchObject({ 'flex-basis': '100%' });
    // The SKU stays whole on the detail line: it is not cut off with an ellipsis.
    expect(own('.card-detail')).not.toHaveProperty('text-overflow');
  });

  it('keeps the logo slot when the logo fails: the brand in text, as tall as the logo at every header size', () => {
    expect(own('.aw-logo-text > span').color).toBe('var(--orange-dark)');
    expect(own('.aw-logo-text > span').font).toMatch(/^700 [\d.]+rem\/1 var\(--body\)$/);
    expect(own('.aw-logo-text > small').color).toBe('var(--purple)');
    const heights = (selector, property) => all.filter((r) => r.selectors.join(', ') === selector).map((r) => declarations(r.body)[property]);
    expect(heights('.aw-logo img', 'height')).toEqual(['72px', '64px', '48px', '42px']);
    expect(heights('.aw-logo-text', 'min-height')).toEqual(heights('.aw-logo img', 'height'));
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
    '.stepper input', '.drawer-line select',
    // The admin lists' filter rows (AW-115).
    '.admin-toolbar :is(input, select)'];
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
      '.category-sort', '.filter-search', '.doc-upload label', '.filter-panel legend', '.doc-uploads legend', '.order-edit-line label', '.account-note',
      '.admin-toolbar label', '.pd-variant-label'];
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
        const leaves = /href=\{(creditSource|DIRECTIONS_URL|blockedLink)/.test(link);
        expect(/<Icon name="external"/.test(link), `${file}: ${link.slice(0, 80)}`).toBe(leaves);
        expect(link, file).toMatch(/opens in a new tab/);
        seen += 1;
      }
    }
    // Directions, the photo credit, an admin's document when the browser
    // blocked its tab (AW-208: View itself is a button that signs on click),
    // and the two policies beside the application's consent box (these stay
    // on the site).
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

  it('sizes the stepper’s quantity box as a capped percentage, so it never widens the page at a large text size (AW-162, AW-013)', () => {
    // A fixed width counts towards the page's narrowest layout; a percentage
    // width on a form control does not.
    const box = declarations(rules(css).find((r) => r.selectors.join() === '.stepper input').body);
    expect(box).toMatchObject({ width: '100%', 'max-width': 'calc(6ch + 1.5rem + 2px)', 'min-width': '0' });
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
    const admin = code(read('src/pages/admin/OrdersSection.jsx'));
    expect(admin).toMatch(/className="button" type="button" disabled=\{busy \|\| !workflow\} onClick=\{save\}>Save prices/);
  });
});

// The declarations of the rule whose selector list is exactly `selector`.
const ruleFor = (selector) => declarations(rules(css).find((r) => r.selectors.join(', ') === selector)?.body ?? '');

describe('one link style (AW-297)', () => {
  const all = rules(css);
  // Every running-text link context. A new one goes into the CSS list and here.
  const LINKS = ['.text-link', '.support-note a', '.checklist a', '.checklist-note a', '.next-steps a', '.policy-body a', '.contact-grid a',
    '.doc-uploads-note a', '.doc-panel a', '.doc-admin a', '.status-panel p a', '.eligibility-result a', '.error-fallback > p a', '.dialog > .desc a',
    '.form-error a', '.dialog .form-grid a', '.consent-block .consent a', '.photo-credit a', '.order-contact a',
    '.account-link', '.order-account-link', '.account-contact a', '.account-detail-contact a'];
  const LOOK = { color: 'var(--link-color)', 'font-weight': '600', 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' };

  it('defines the link colour and underline offset once', () => {
    expect(root).toMatchObject({ '--link-color': 'var(--purple)', '--link-offset': '3px' });
  });

  it('gives every text link one rule, and no other rule restyles them', () => {
    const shared = all.find((r) => r.selectors.includes('.form-error a'));
    expect(shared.selectors).toEqual(LINKS);
    expect(declarations(shared.body)).toEqual(LOOK);
    for (const { selectors, body } of all) {
      if (body === shared.body) continue;
      for (const s of selectors.filter((x) => LINKS.includes(x))) {
        for (const property of Object.keys(LOOK)) expect(declarations(body), `${s} ${property}`).not.toHaveProperty(property);
      }
    }
    // The text-link keeps its own layout rule.
    expect(ruleFor('.text-link')).toEqual({ display: 'inline-flex', 'align-items': 'center', 'min-height': '36px', 'font-size': 'var(--text-sm)', background: 'none', border: '0', padding: '0' });
    // No sign-in prompt on each card any more: the page's PricingNotice has
    // Sign in and Apply, and the card's lock is plain text (AW-224).
    expect(all.flatMap((r) => r.selectors).filter((s) => s.includes('.price-login'))).toEqual([]);
    expect(code(read('src/components/ProductCard.jsx'))).not.toMatch(/price-login|onLoginClick|Sign in for pricing/);
    expect(code(read('src/components/PricingNotice.jsx'))).toMatch(/<button className="text-link" type="button" onClick=\{onApplyClick\}>Apply for a trade account<\/button>/);
  });

  it('leaves the buttons in a status panel alone: only links in its text are text links', () => {
    expect(all.flatMap((r) => r.selectors)).not.toContain('.status-panel a');
  });

  it('keeps the light links on purple surfaces, at a higher specificity than .text-link', () => {
    expect(ruleFor('.contact-strip .text-link')).toEqual({ color: '#fff' });
    expect(ruleFor('.editorial-card .text-link')).toMatchObject({ color: 'inherit' });
  });

  it('underlines every link at the same offset, on light and purple surfaces', () => {
    const offsets = declared('text-underline-offset');
    expect(offsets.length).toBeGreaterThan(10);
    for (const { selector, value } of offsets) expect(value, selector).toBe('var(--link-offset)');
    for (const selector of ['.trade-bar a, .trade-bar button', '.footer-grid a', '.footer-policies a', '.aw-utility a', '.sku-details summary']) {
      expect(ruleFor(selector), selector).toMatchObject({ 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    }
  });

  it('thickens the underline of every text link with a mouse only, on light and purple surfaces alike', () => {
    const hover = mediaBlocks(css).filter((b) => b.prelude === '(hover: hover)').flatMap((b) => rules(b.body)).find((r) => r.selectors.includes('.form-error a:hover'));
    expect(hover.selectors).toEqual(LINKS.map((s) => (s === '.text-link' ? '.text-link:not(:disabled):hover' : `${s}:hover`)));
    expect(declarations(hover.body)).toEqual({ 'text-decoration-thickness': '2px' });
  });

  it('colours the section links and underlines the footer navigation like the footer phone and email', () => {
    expect(ruleFor('.section-head > a')).toMatchObject({ color: 'var(--link-color)', 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    expect(ruleFor('.footer-grid button, .footer-grid .footer-link')).toMatchObject({ 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    const hover = mediaBlocks(css).filter((b) => b.prelude === '(hover: hover)').flatMap((b) => rules(b.body))
      .find((r) => r.selectors.join(', ') === '.footer-grid button:hover, .footer-grid .footer-link:hover');
    expect(declarations(hover.body)).toEqual({ color: '#fff' });
  });
});

describe('one callout, and status colours for errors and success (AW-295)', () => {
  const all = rules(css);
  const MAPPED = ['.callout', '.notice', '.support-alert', '.qr-summary', '.order-foot', '.site-notice', '.cart-notice', '.pd-unit', '.pd-saved'];
  const modifiers = all.filter((r) => r.selectors[0].startsWith('.callout'));

  it('defines danger and success colours that read on every surface they are used on', () => {
    expect(root).toMatchObject({ '--danger': '#b42318', '--danger-bg': '#fdecea', '--success': '#1f7a47', '--success-bg': '#e8f5ee' });
    for (const surface of ['#ffffff', root['--cream'], root['--paper'], root['--danger-bg']]) {
      expect(contrast(root['--danger'], surface), `danger on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const surface of ['#ffffff', root['--paper'], root['--success-bg']]) {
      expect(contrast(root['--success'], surface), `success on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    // Callout text, and a link inside one, on every callout background.
    for (const surface of [root['--cream'], root['--paper'], root['--success-bg'], root['--danger-bg']]) {
      expect(contrast(root['--ink'], surface), `ink on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(root['--purple'], surface), `purple on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('has one base callout and three modifiers, with the older notice classes mapped onto them', () => {
    expect(modifiers.map((r) => r.selectors)).toEqual([
      MAPPED,
      ['.callout.info', '.site-notice:not(.is-warn)', '.cart-notice:not(.is-warn)', '.pd-unit', '.pd-saved'],
      ['.callout.success'],
      ['.callout.error', '.form-error.support-alert'],
    ]);
    expect(modifiers.map((r) => declarations(r.body))).toEqual([
      { padding: '.875rem 1rem', 'border-left': '4px solid var(--orange)', background: 'var(--cream)', color: 'var(--ink)', 'font-size': 'var(--text-base)', 'line-height': '1.6' },
      { 'border-left-color': 'var(--purple)', background: 'var(--paper)' },
      { 'border-left-color': 'var(--success)', background: 'var(--success-bg)' },
      { 'border-left-color': 'var(--danger)', background: 'var(--danger-bg)', color: 'var(--danger)' },
    ]);
  });

  it('leaves the mapped classes only their layout', () => {
    const visual = ['padding', 'padding-block', 'padding-inline', 'border', 'border-top', 'border-left', 'border-color', 'border-left-color', 'background', 'background-color', 'color', 'font-size', 'line-height'];
    const own = new Set(modifiers.map((r) => r.body));
    const isMapped = (selector) => {
      const last = lastCompound(selector);
      return MAPPED.some((c) => last === c || last.startsWith(`${c}.`) || last.startsWith(`${c}:`));
    };
    let seen = 0;
    for (const { selectors, body } of all) {
      if (own.has(body)) continue;
      for (const s of selectors.filter(isMapped)) {
        seen += 1;
        for (const property of visual) {
          // .support-alert restores the callout size over .form-error's smaller one.
          if (s === '.support-alert' && property === 'font-size') continue;
          expect(declarations(body), `${s} ${property}`).not.toHaveProperty(property);
        }
      }
    }
    expect(seen).toBeGreaterThan(8);
    expect(ruleFor('.support-alert')).toEqual({ margin: '0 0 22px', 'font-size': 'var(--text-base)' });
    expect(ruleFor('.pd-info .pd-unit')).toEqual({ margin: '0 0 14px', 'max-width': 'none', 'font-weight': '600' });
    expect(ruleFor('.pd-info .pd-saved')).toEqual({ margin: '0 0 14px', 'max-width': 'none', 'font-weight': '600' });
  });

  it('keeps the status panel and the pricing prompt boxes, in the status and callout colours', () => {
    expect(ruleFor('.status-panel')).toMatchObject({ 'border-left': '6px solid var(--orange)' });
    expect(ruleFor('.status-panel.status-approved')).toEqual({ 'border-left-color': 'var(--success)' });
    expect(ruleFor('.status-panel.status-suspended')).toEqual({ 'border-left-color': 'var(--danger)' });
    expect(ruleFor('.filter-signin')).toMatchObject({ 'border-left': '4px solid var(--orange)', background: 'var(--cream)' });
    expect(ruleFor('.filter-signin')).not.toHaveProperty('border');
    expect(ruleFor('button.filter-signin span')).toEqual({ color: 'var(--link-color)', 'font-weight': '600', 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    expect(ruleFor('.stat-card.ok b')).toEqual({ color: 'var(--success)' });
    expect(ruleFor('.stat-card.warn b')).toEqual({ color: 'var(--orange-dark)' });
  });

  it('shows errors in the danger colour with a drawn mark that screen readers skip', () => {
    expect(ruleFor('.form-error')).toMatchObject({ color: 'var(--danger)' });
    expect(ruleFor('.qr-problem')).toEqual({ color: 'var(--danger)' });
    expect(ruleFor('.drawer-line.is-unavailable .info small, .drawer-line .line-flag')).toEqual({ color: 'var(--danger)' });
    const mark = all.find((r) => r.selectors.join() === '.form-error:not(:empty)::before');
    // The plain value first, for browsers without alt text, then the one with an empty alt.
    expect([...mark.body.matchAll(/content:\s*([^;]+);/g)].map((m) => m[1].trim())).toEqual(["'!'", "'!' / ''"]);
    expect(declarations(mark.body)).toMatchObject({ display: 'inline-grid', width: '1.1em', height: '1.1em', border: '1.5px solid', 'border-radius': '50%', 'font-weight': '700' });
    // No error takes the accent orange any more.
    for (const { selectors, body } of all) {
      if (selectors.some((s) => /form-error|qr-problem|line-flag/.test(s)) && !selectors.includes('.form-error a')) {
        expect(body, selectors.join(', ')).not.toMatch(/--orange/);
      }
    }
  });
});

describe('one number marker for ordered steps (AW-296)', () => {
  const all = rules(css);

  it('draws .num and the apply and next-step counters alike, zero-padded', () => {
    const marker = all.find((r) => r.selectors.includes('.num'));
    expect(marker.selectors).toEqual(['.num', '.apply-steps li::before', '.next-steps li::before']);
    expect(declarations(marker.body)).toEqual({ font: '700 1.75rem/1 var(--display)', color: 'var(--orange-dark)' });
    expect(ruleFor('.apply-steps li::before').content).toBe('counter(apply, decimal-leading-zero)');
    expect(ruleFor('.next-steps li::before').content).toBe('counter(steps, decimal-leading-zero)');
    for (const selector of ['.apply-steps li', '.next-steps li']) expect(ruleFor(selector)['grid-template-columns'], selector).toBe('2.5rem minmax(0, 1fr)');
    for (const { selectors, body } of all) {
      if (body === marker.body || !selectors.some((s) => /steps li::before$/.test(s))) continue;
      for (const property of ['font', 'font-size', 'font-family', 'color']) expect(declarations(body), `${selectors.join(', ')} ${property}`).not.toHaveProperty(property);
    }
  });

  it('keeps .num for the step marker: no other rule restyles the class (the admin print sheet uses .print-num)', () => {
    const others = all.filter((r) => !r.selectors.includes('.apply-steps li::before') && r.selectors.some((x) => /\.num(?![\w-])/.test(x)));
    expect(others.map((r) => r.selectors.join(', '))).toEqual([]);
  });

  it('colours the menu indices in the same text orange', () => {
    for (const selector of ['.aw-department h3 > span:first-child', '.menu-index']) expect(ruleFor(selector).color, selector).toBe('var(--orange-dark)');
  });

  it('numbers only ordered steps: no number prefixes on the checklist or the delivery cards', () => {
    expect(code(read('src/pages/support/ApplyPage.jsx'))).not.toMatch(/padStart\(2/);
    expect(code(read('src/pages/support/DeliveryPage.jsx'))).not.toMatch(/\d\d · [A-Z]/);
  });
});

describe('no inline styles (AW-301)', () => {
  it('has no style attribute in any component', () => {
    expect(jsx.length).toBeGreaterThan(20);
    expect(jsx.filter(({ text }) => /\bstyle=\{/.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it('gives the root, the footer paragraph and the page heads classes instead', () => {
    expect(ruleFor('.app-shell')).toEqual({ 'min-height': '100vh' });
    expect(ruleFor('.footer-brand p')).toEqual({ 'margin-top': '1rem' });
    expect(ruleFor('.is-flush')).toEqual({ 'padding-bottom': '0' });
    expect(ruleFor('.is-centered')).toEqual({ 'text-align': 'center', 'padding-block': 'var(--empty-pad)' });
    expect(ruleFor('.is-centered > p:not([class])')).toEqual({ margin: '0 auto 1.25rem' });
    expect(ruleFor('.is-centered strong')).toEqual({ color: 'var(--purple)' });
    expect(ruleFor('.is-centered .dialog-actions')).toEqual({ 'justify-content': 'center' });
    expect(code(read('src/App.jsx'))).toMatch(/<div className="app-shell">/);
    expect(code(read('src/pages/ProductPage.jsx'))).toMatch(/className="page-head is-flush"/);
    // The empty cart; the thank-you is the receipt (AW-022), centred by its own class.
    expect(code(read('src/pages/QuotePage.jsx')).match(/className="page-head is-centered"/g)).toHaveLength(1);
    expect(code(read('src/pages/QuoteReceipt.jsx'))).toMatch(/<section className="page-head receipt-head">/);
    expect(ruleFor('.receipt-head')).toEqual({ 'text-align': 'center' });
  });

  it('lets the phone page-head padding win over the centred message', () => {
    const compact = mediaBlocks(css).find((b) => b.prelude === MOBILE_QUERY && /\.page-head\s*\{/.test(b.body));
    expect(declarations(rules(compact.body).find((r) => r.selectors.join() === '.page-head').body)).toHaveProperty('padding-top');
    // Same specificity (one class), and later in the file.
    expect(compact.start).toBeGreaterThan(css.indexOf('.is-centered {'));
    expect(compact.start).toBeGreaterThan(css.indexOf('.is-flush {'));
  });
});

// The Categories menu (AW-062): it ends inside the window, under the header
// height the header will publish (--header-h), its heading and footer stay in
// view while it scrolls, and the eight departments fill two rows.
describe('the Categories menu fits the window (AW-062)', () => {
  it('ends 1rem above the bottom of the window, with its close button and its footer link always in view', () => {
    expect(ruleFor('.aw-mega-menu')).toMatchObject({
      'max-height': 'max(9rem, calc(100dvh - var(--header-h, 16.125rem) - 1rem))', overflow: 'auto', 'scroll-padding-block': '6rem 5rem',
    });
    expect(css).not.toMatch(/--aw-menu-top/);
    expect(ruleFor('.aw-menu-heading')).toMatchObject({ position: 'sticky', top: '0', background: '#fff' });
    expect(ruleFor('.aw-menu-footer')).toMatchObject({ position: 'sticky', bottom: '0', background: 'var(--paper)' });
    // A short window keeps room for the departments between them.
    const short = mediaBlocks(css).find((b) => b.prelude === '(max-height: 37.5em)');
    expect(rules(short.body).map((r) => r.selectors.join(', '))).toEqual(['.aw-mega-menu', '.aw-menu-heading', '.aw-menu-heading .eyebrow', '.aw-menu-heading h2', '.aw-menu-footer']);
  });

  it('sets the departments in four equal columns, with no empty feature tile', () => {
    expect(ruleFor('.aw-menu-grid')['grid-template-columns']).toBe('repeat(4, minmax(0, 1fr))');
    expect(css).not.toMatch(/aw-menu-feature/);
    expect(code(read('src/components/Header.jsx'))).not.toMatch(/aw-menu-feature|subs\.slice/);
  });
});

describe('department page controls (AW-223, AW-225, AW-325)', () => {
  const all = rules(css);
  const blocks = mediaBlocks(css);
  const inBlock = (prelude) => blocks.filter((b) => b.prelude === prelude).flatMap((b) => rules(b.body));
  const outside = rules(outsideMedia);

  it('sets every breadcrumb in the trail’s capitals: no crumb resets the case, and none is a button (AW-325)', () => {
    expect(ruleFor('.crumbs')['text-transform']).toBe('uppercase');
    const crumbRules = all.filter((r) => r.selectors.some((s) => s.includes('.crumbs')));
    expect(crumbRules.length).toBeGreaterThan(4);
    for (const { selectors, body } of crumbRules) {
      const transform = declarations(body)['text-transform'];
      if (transform !== undefined) expect(['uppercase', 'inherit'], selectors.join(', ')).toContain(transform);
    }
    // The global reset that once turned "Home" title case hits buttons only, and
    // the trail renders links and spans.
    expect(code(read('src/components/Breadcrumbs.jsx'))).not.toMatch(/<button/);
  });

  it('mutes a product line the filters leave empty, but never the current one, and not as a selected state (AW-225)', () => {
    expect(outside.find((r) => r.selectors.join() === '.sub-pill.is-empty:not(.active)')).toBeTruthy();
    expect(ruleFor('.sub-pill.is-empty:not(.active)')).toEqual({ 'border-style': 'dashed', color: 'var(--muted)' });
    const forced = inBlock('(forced-colors: active)').flatMap((r) => r.selectors);
    expect(forced.filter((s) => s.includes('is-empty'))).toEqual([]);
  });

  it('puts Back to top in the corner, a 44px purple button above the sticky toolbar and below the toast and dialogs (AW-223)', () => {
    const button = ruleFor('.back-to-top');
    expect(button).toMatchObject({
      position: 'fixed', right: '16px', bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + var(--back-to-top-lift, 0px))',
      width: 'var(--tap)', height: 'var(--tap)', background: 'var(--purple)', color: '#fff',
    });
    const z = Number(button['z-index']);
    // The phone layout's sticky toolbar.
    const toolbar = inBlock(MOBILE_QUERY).find((r) => r.selectors.join() === '.category-toolbar');
    expect(declarations(toolbar.body).position).toBe('sticky');
    expect(z).toBeGreaterThan(Number(declarations(toolbar.body)['z-index']));
    expect(z).toBeLessThan(Number(ruleFor('.toast-root')['z-index']));
    expect(z).toBeLessThan(Number(ruleFor('.aw-layer')['z-index']));
    // Its hover is for a mouse only, and the focus ring stays outside it.
    expect(inBlock('(hover: hover)').some((r) => r.selectors.includes('.back-to-top:not(:disabled):hover'))).toBe(true);
    expect(outside.some((r) => r.selectors.includes('.back-to-top:focus-visible'))).toBe(true);
    // Not on paper.
    expect(inBlock('print').some((r) => r.selectors.includes('.back-to-top') && declarations(r.body).display === 'none')).toBe(true);
  });
});

describe('All products page (AW-068, AW-069, AW-229)', () => {
  const blocks = mediaBlocks(css);
  const inBlock = (prelude) => blocks.filter((b) => b.prelude === prelude).flatMap((b) => rules(b.body));
  const outside = rules(outsideMedia);
  const base = (selector) => declarations(outside.find((r) => r.selectors.join(', ') === selector)?.body ?? '');

  it('wraps every department’s product lines at every width, lined up with its heading (AW-069)', () => {
    expect(base('.dept-section .sub-pills')).toEqual({ 'flex-wrap': 'wrap', overflow: 'visible', padding: '0', margin: '14px 0 12px' });
    // The compact layout's sideways scroller is a single class, which the two
    // classes above outrank wherever it sits; no rule overrides them there.
    const scrollers = inBlock(MOBILE_QUERY).filter((r) => declarations(r.body)['flex-wrap'] === 'nowrap' && r.selectors.some((s) => s.includes('sub-pills')));
    expect(scrollers.map((r) => r.selectors)).toEqual([['.sub-pills']]);
    expect(blocks.flatMap((b) => rules(b.body)).some((r) => r.selectors.includes('.dept-section .sub-pills'))).toBe(false);
  });

  it('gives the jump links, department links and SKU list toggles 40px targets, and 44px on touch (AW-229)', () => {
    for (const selector of ['.dept-jump a', '.sku-details summary', '.dept-head .text-link, .dept-more .text-link']) {
      expect(base(selector)['min-height'], selector).toBe('var(--tap-sm)');
    }
    const touch = inBlock('(pointer: coarse)').find((r) => r.selectors.includes('.dept-more .text-link'));
    expect(touch.selectors).toEqual(['.dept-jump a', '.sku-details summary', '.dept-head .text-link', '.dept-more .text-link']);
    expect(declarations(touch.body)).toEqual({ 'min-height': 'var(--tap)' });
    // The SKU list's detail line is at the 12px floor.
    expect(base('.sku-list small')['font-size']).toBe('var(--text-xs)');
  });
});
