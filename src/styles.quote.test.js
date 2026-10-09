// Checkout's spacing and phone layout (AW-241) and its Notes box (AW-078),
// read from src/index.css as text like styles.test.js does.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const declarations = (body) => Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
// Top-level rules and @media blocks, in source order.
function blocks(source) {
  const out = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(source))) {
    const head = m[1].trim();
    let depth = 1, i = re.lastIndex;
    for (; i < source.length && depth; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    out.push({ head, body: source.slice(re.lastIndex, i - 1), at: m.index });
    re.lastIndex = i;
  }
  return out;
}
const top = blocks(css);
const rule = (list, selector) => list.find((b) => b.head === selector);
const media = (prelude) => top.filter((b) => b.head === `@media ${prelude}`);

describe('checkout spacing (AW-241)', () => {
  it('puts a block of space between the intro and the lines and form, and sets the form title solid', () => {
    expect(declarations(rule(top, '.checkout-grid').body)['margin-top']).toBe('var(--block-gap)');
    expect(declarations(rule(top, '.checkout-form-title').body)['line-height']).toBe('1');
  });

  it('keeps State and ZIP on one row on phones, after the one-column form rule, and stacks them again when narrower', () => {
    const phone = media('(max-width: 37.5em)').find((b) => b.body.includes('.checkout-form-grid'));
    expect(phone, 'the phone block').toBeTruthy();
    const inner = blocks(phone.body);
    const oneColumn = inner.findIndex((b) => b.head === '.form-grid, .contact-grid');
    const pair = inner.findIndex((b) => b.head === '.checkout-form-grid');
    const full = inner.findIndex((b) => b.head === '.checkout-form-grid > :not(.half)');
    expect(oneColumn).toBeGreaterThanOrEqual(0);
    expect(pair).toBeGreaterThan(oneColumn);
    expect(declarations(inner[pair].body)['grid-template-columns']).toBe('minmax(0,1fr) minmax(0,1fr)');
    expect(declarations(inner[full].body)['grid-column']).toBe('1 / -1');
    const narrow = media('(max-width: 22.5em)').find((b) => b.body.includes('.checkout-form-grid'));
    expect(narrow, 'the narrow block').toBeTruthy();
    expect(narrow.at).toBeGreaterThan(phone.at);
    expect(declarations(rule(blocks(narrow.body), '.checkout-form-grid').body)['grid-template-columns']).toBe('minmax(0, 1fr)');
  });
});

describe('the Notes box (AW-078)', () => {
  it('is as wide as the form, and gets its height and padding from a zero-specificity rule after the shared field rule', () => {
    expect(declarations(rule(top, '.form-grid input, .form-grid select, .form-grid textarea').body).width).toBe('100%');
    const base = top.findIndex((b) => b.head.startsWith(':where(:is(.form-grid :is(input, select, textarea)') && b.head.endsWith(':not([type=checkbox]):not([type=radio]))'));
    const notes = top.findIndex((b) => b.head === ':where(.checkout-form-grid textarea)');
    expect(base).toBeGreaterThanOrEqual(0);
    expect(notes).toBeGreaterThan(base);
    expect(declarations(top[notes].body)).toMatchObject({ 'padding-block': '.625rem', 'min-height': '6rem' });
  });
});
