// Focus that follows cart lines (AW-011, AW-042) and filter chips (NEW-005).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINE_CONTROL, firstControlIn, focusInPlace, focusLineSoon, focusLost, keepFocusNear, neighbourKey } from './focus.js';

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

describe('firstControlIn, focusInPlace and focusLost (NEW-005)', () => {
  it('finds the first enabled, shown control', () => {
    html(`<div id="box"><p tabindex="-1">Note</p><button disabled>Off</button><div hidden><input id="hidden"></div>
      <fieldset><label><input type="radio" id="first"> All</label></fieldset><select id="sort"></select></div>`);
    expect(firstControlIn(document.getElementById('box')).id).toBe('first');
    expect(firstControlIn(null)).toBeNull();
    expect(firstControlIn(document.querySelector('p'))).toBeNull();
  });

  it('focuses without scrolling, making a plain element focusable first', () => {
    html('<p id="note" role="status">Showing 3 of 3 items</p><button id="b">x</button>');
    const note = document.getElementById('note');
    const focus = vi.spyOn(note, 'focus');
    expect(focusInPlace(note)).toBe(true);
    expect(note.getAttribute('tabindex')).toBe('-1');
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(focusInPlace(document.getElementById('b'))).toBe(true);
    expect(document.getElementById('b').hasAttribute('tabindex')).toBe(false);
    expect(focusInPlace(null)).toBe(false);
  });

  it('says focus is lost on <body> or when its element left the page', () => {
    html('<button id="b">x</button>');
    const button = document.getElementById('b');
    expect(focusLost()).toBe(true);
    button.focus();
    expect(focusLost()).toBe(false);
    button.remove();
    expect(focusLost()).toBe(true);
  });
});
