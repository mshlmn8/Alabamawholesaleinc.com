// The support pages' CSS contract, read from src/index.css as text like
// src/styles.test.js: the help and policy nav marks the current page by more
// than colour (AW-273), the policy text and intros keep a readable measure
// (AW-121), and the nav and content share one layout (AW-122).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOBILE_QUERY } from '../../lib/useMediaQuery.js';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// The text of each @media block, and the stylesheet without them.
const blocks = [];
let outside = '';
{
  const re = /@media\s*([^{]+?)\s*\{/g;
  let from = 0, m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    for (; i < css.length && depth; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    blocks.push({ prelude: m[1], body: css.slice(re.lastIndex, i - 1) });
    outside += css.slice(from, m.index);
    from = re.lastIndex = i;
  }
  outside += css.slice(from);
}
const declarations = (body) => Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
// The declarations of the rule whose selector list is exactly `selector`.
const rule = (source, selector) => {
  const found = [...source.matchAll(/([^{};]+)\{([^{}]*)\}/g)].find((m) => m[1].trim().replace(/\s+/g, ' ') === selector);
  return found ? declarations(found[2]) : undefined;
};
const compact = blocks.filter((b) => b.prelude === MOBILE_QUERY).map((b) => b.body).join('\n');
const CURRENT = '.policy-nav a[aria-current="page"]';

describe('help and policy nav (AW-122, AW-273)', () => {
  it('marks the current page with weight and a bar as well as colour', () => {
    const base = rule(outside, '.policy-nav a');
    const mark = rule(outside, CURRENT);
    expect(mark.color).toBe('var(--orange-dark)');
    expect(Number(mark['font-weight'])).toBeGreaterThan(Number(base['font-weight']));
    // DM Sans is bundled 400–700, so nothing heavier is synthesised.
    expect(Number(mark['font-weight'])).toBeLessThanOrEqual(700);
    expect(mark['box-shadow']).toMatch(/^inset 3px 0 0 var\(--orange\)$/);
    expect(mark['padding-left']).toBeTruthy();
  });

  it('underlines the current page instead in the compact chip row', () => {
    expect(rule(compact, CURRENT)).toEqual({ 'box-shadow': 'none', 'padding-left': '0', 'text-decoration': 'underline', 'text-underline-offset': 'var(--link-offset)' });
    expect(rule(compact, '.policy-nav')).toMatchObject({ position: 'static', 'flex-wrap': 'wrap' });
  });

  it('keeps the sticky nav below a sticky header once it publishes its height', () => {
    expect(rule(outside, '.policy-nav')).toMatchObject({ position: 'sticky', top: 'calc(var(--header-h, 0px) + 1.125rem)' });
  });

  it('lets the content column shrink and its grids fit the narrower column', () => {
    expect(rule(outside, '.support-layout-main')).toEqual({ 'min-width': '0' });
    expect(rule(outside, ':where(.support-layout) .info-card')).toMatchObject({ flex: '1 1 15rem' });
    expect(rule(outside, ':where(.support-layout) .support-columns, :where(.support-layout) .apply-layout'))
      .toEqual({ 'grid-template-columns': 'repeat(auto-fit, minmax(min(20rem, 100%), 1fr))' });
    // One column in the compact layout, as before.
    expect(rule(compact, '.info-grid')).toEqual({ display: 'grid', 'grid-template-columns': '1fr' });
  });
});

describe('readable measure (AW-121)', () => {
  const rem = (value) => Number(/^([\d.]+)rem$/.exec(value)?.[1]);

  it('sets the policy text at body size in a column of about 70 characters', () => {
    expect(rem(rule(outside, '.policy-body')['max-width'])).toBeGreaterThanOrEqual(32);
    expect(rem(rule(outside, '.policy-body')['max-width'])).toBeLessThanOrEqual(36);
    expect(rule(outside, '.policy-body p:not([class])')['font-size']).toBe('var(--text-lg)');
    expect(rule(outside, '.policy-body li')['font-size']).toBe('var(--text-lg)');
  });

  it('sets the support page intros the same way', () => {
    const intro = rule(outside, '.support-page .page-head > p:not([class])');
    expect(intro['font-size']).toBe('var(--text-lg)');
    expect(rem(intro['max-width'])).toBeLessThanOrEqual(36);
  });
});
