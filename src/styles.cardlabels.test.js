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

// AW-346's labels no longer sit on the photo: since AW-055 the tag is a chip
// in the kicker line beside the product line, and the department label is
// gone from the card, so nothing can collide over the tile. Only the
// sell-unit badge stays on the photo, inside its edges.
describe('product card labels (AW-346, AW-055)', () => {
  const selectors = top.flatMap((b) => (b.head.startsWith('@media') ? blocks(b.body) : [b])).map((b) => b.head);

  it('prints no department label and no tag over the photo', () => {
    expect(selectors.filter((s) => s.includes('.block-label'))).toEqual([]);
    expect(selectors.filter((s) => /\.card-block [^,]*\.card-tag/.test(s))).toEqual([]);
  });

  it('keeps the tag a small inline chip, and the sell-unit badge inside the tile', () => {
    const tag = declarations(rules(top, '.card-tag')[0].body);
    expect(tag).toMatchObject({ display: 'inline-block', 'font-size': 'var(--text-xs)', 'line-height': '1' });
    expect(tag.position).toBeUndefined();
    const badge = declarations(rules(top, '.pack-badge')[0].body);
    expect(badge).toMatchObject({ position: 'absolute', 'max-width': 'calc(100% - 24px)' });
  });
});
