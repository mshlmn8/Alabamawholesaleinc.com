// DOM guards for translated pages (AW-039).
import { describe, expect, it } from 'vitest';
import { installDomGuards } from './domGuard.js';

installDomGuards();

// What Google Translate does to a text node: swap it for <font>.
function translate(parent, textNode) {
  const font = document.createElement('font');
  font.textContent = `[${textNode.nodeValue}]`;
  parent.replaceChild(font, textNode);
  return font;
}

describe('installDomGuards', () => {
  it('ignores removing a text node that was replaced', () => {
    const p = document.createElement('p');
    const text = document.createTextNode('items');
    p.append('3 ', text);
    translate(p, text);
    expect(() => p.removeChild(text)).not.toThrow();
    expect(p.textContent).toBe('3 [items]');
  });

  it('appends when the reference node was replaced', () => {
    const p = document.createElement('p');
    const text = document.createTextNode('total');
    p.append(text);
    translate(p, text);
    const b = document.createElement('b');
    expect(() => p.insertBefore(b, text)).not.toThrow();
    expect(p.lastChild).toBe(b);
  });

  it('leaves normal removeChild and insertBefore alone', () => {
    const p = document.createElement('p');
    const a = document.createElement('a');
    const b = document.createElement('b');
    p.append(a);
    p.insertBefore(b, a);
    expect([...p.childNodes]).toEqual([b, a]);
    p.removeChild(b);
    expect([...p.childNodes]).toEqual([a]);
  });

  it('is safe to install twice', () => {
    const before = Node.prototype.removeChild;
    installDomGuards();
    expect(Node.prototype.removeChild).toBe(before);
  });
});
