// Focus that follows cart lines (AW-011, AW-042).
import { afterEach, describe, expect, it } from 'vitest';
import { LINE_CONTROL, focusLineSoon, keepFocusNear, neighbourKey } from './focus.js';

afterEach(() => { document.body.innerHTML = ''; });

const html = (markup) => {
  document.body.innerHTML = markup;
};
const nextFrames = (n = 8) => new Promise((resolve) => {
  const step = (left) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
  step(n);
});

describe('neighbourKey', () => {
  it('picks the next line, else the one before, else none', () => {
    expect(neighbourKey(['14', '1::red', '45'], '14')).toBe('1::red');
    expect(neighbourKey(['14', '1::red', '45'], '1::red')).toBe('45');
    expect(neighbourKey(['14', '1::red', '45'], '45')).toBe('1::red');
    expect(neighbourKey(['14'], '14')).toBeNull();
    expect(neighbourKey(['14'], '99')).toBeNull();
    expect(neighbourKey([], '14')).toBeNull();
  });
});

describe('focusLineSoon with LINE_CONTROL', () => {
  it('focuses a line’s quantity box, or its × when it has none', async () => {
    html(`<ul>
      <li data-line-key="14"><input aria-label="qty"><button class="icon-btn drawer-remove">x</button></li>
      <li data-line-key="999"><button class="text-link">Choose</button><button class="icon-btn drawer-remove">x</button></li>
    </ul>`);
    const list = document.querySelector('ul');
    focusLineSoon(list, '14', { selector: LINE_CONTROL });
    await nextFrames();
    expect(document.activeElement).toBe(document.querySelector('input'));
    focusLineSoon(list, '999', { selector: LINE_CONTROL });
    await nextFrames();
    expect(document.activeElement).toBe(document.querySelector('[data-line-key="999"] .drawer-remove'));
  });

  it('runs a fallback function when the line never appears', async () => {
    html('<ul></ul><h1 tabindex="-1">Your cart is empty</h1>');
    let ran = 0;
    focusLineSoon(document.querySelector('ul'), '14', { selector: LINE_CONTROL, tries: 2, fallback: () => { ran += 1; document.querySelector('h1').focus(); } });
    await nextFrames();
    expect(ran).toBe(1);
    expect(document.activeElement.tagName).toBe('H1');
  });
});

describe('keepFocusNear', () => {
  it('focuses the dialog’s heading, made focusable, or <main> outside a dialog', () => {
    html('<main id="main"><button id="page">x</button></main><aside role="dialog"><h2 id="cart-title">Your order</h2><button id="inside">x</button></aside>');
    keepFocusNear(document.getElementById('inside'));
    expect(document.activeElement.id).toBe('cart-title');
    expect(document.activeElement.getAttribute('tabindex')).toBe('-1');
    keepFocusNear(document.getElementById('page'));
    expect(document.activeElement.id).toBe('main');
  });
});
