// Printing /catalog opens every closed SKU list and closes them again
// afterwards (AW-148); nothing else is touched.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PRINT_OPENED, closeAfterPrint, installPrintHelpers, openForPrint } from './print.js';

let stop = () => {};
beforeEach(() => {
  document.body.innerHTML = `
    <details class="sku-details" id="closed-1"><summary>All 68 Tobacco SKUs</summary><ul class="sku-list"><li>Kite</li></ul></details>
    <details class="sku-details" id="closed-2"><summary>All 51 Novelties SKUs</summary></details>
    <details class="sku-details" id="opened" open><summary>All 60 Merchandise SKUs</summary></details>
    <details class="order-staff" id="staff"><summary>Staff notes and history</summary></details>`;
});
afterEach(() => {
  stop();
  document.body.innerHTML = '';
});
const byId = (id) => document.getElementById(id);
const fire = (type) => window.dispatchEvent(new Event(type));

describe('print helpers', () => {
  it('opens the closed SKU lists before printing and marks them, leaving other details alone', () => {
    stop = installPrintHelpers(window);
    fire('beforeprint');
    expect(byId('closed-1').open).toBe(true);
    expect(byId('closed-2').open).toBe(true);
    expect(byId('closed-1').hasAttribute(PRINT_OPENED)).toBe(true);
    // Already open: not marked, so it stays open afterwards.
    expect(byId('opened').hasAttribute(PRINT_OPENED)).toBe(false);
    // The admin's staff notes are React's to open.
    expect(byId('staff').open).toBe(false);
    expect(byId('staff').hasAttribute(PRINT_OPENED)).toBe(false);
  });

  it('closes again only the lists it opened, after printing', () => {
    stop = installPrintHelpers(window);
    fire('beforeprint');
    fire('afterprint');
    expect(byId('closed-1').open).toBe(false);
    expect(byId('closed-2').open).toBe(false);
    expect(byId('opened').open).toBe(true);
    expect(document.querySelectorAll(`[${PRINT_OPENED}]`)).toHaveLength(0);
  });

  it('listens once however often it is installed, and stops when asked', () => {
    stop = installPrintHelpers(window);
    expect(installPrintHelpers(window)).toBe(stop);
    stop();
    fire('beforeprint');
    expect(byId('closed-1').open).toBe(false);
  });

  it('works on any root, and an afterprint with nothing opened changes nothing', () => {
    closeAfterPrint(document);
    expect(byId('opened').open).toBe(true);
    openForPrint(document.body);
    expect(byId('closed-2').open).toBe(true);
  });

  it('does nothing without a window', () => {
    expect(() => installPrintHelpers(null)()).not.toThrow();
  });
});
