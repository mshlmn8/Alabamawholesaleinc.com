// The labels on a product card's photo never collide (AW-346): read from
// src/index.css as text, like styles.test.js does. The browser check with
// the web fonts blocked measured zero overlap at 1024, 768 and 390.
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
const rules = (list, selector) => list.filter((b) => b.head === selector);
const media = (prelude) => top.filter((b) => b.head === `@media ${prelude}`);

describe('product card labels (AW-346)', () => {
  it('keeps the department label on one line inside the tile at every width', () => {
    const [label, ...more] = rules(top, '.card-block .block-label');
    expect(more).toEqual([]);
    expect(declarations(label.body)).toMatchObject({
      'max-width': 'calc(100% - 24px)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
    });
  });

  it('moves the tag to the bottom corner below 68.75em, with a sell-unit badge stacked above it, and phones keep their 10px offsets', () => {
    const narrow = media('(max-width: 68.75em)');
    expect(narrow).toHaveLength(1);
    const inner = blocks(narrow[0].body);
    expect(declarations(rules(inner, '.card-block .card-tag')[0].body)).toEqual({ top: 'auto', bottom: '12px', right: '12px' });
    expect(declarations(rules(inner, '.card-block .card-tag ~ .pack-badge')[0].body)).toEqual({ bottom: 'calc(28px + var(--text-xs))' });
    // The badge clears the tag: its bottom edge sits above the tag's top
    // (12px offset, .75rem text at line-height 1, 5px padding top and bottom).
    const tag = declarations(rules(top, '.card-tag')[0].body);
    expect(tag).toMatchObject({ 'font-size': 'var(--text-xs)', 'line-height': '1', padding: '5px 8px' });
    const phone = media('(max-width: 37.5em)').find((b) => b.body.includes('.card-block .card-tag'));
    expect(phone.at).toBeGreaterThan(narrow[0].at);
    expect(declarations(rules(blocks(phone.body), '.card-block .card-tag')[0].body)).toEqual({ top: 'auto', bottom: '10px', right: '10px' });
  });
});
