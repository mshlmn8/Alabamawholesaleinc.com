// Printing (AW-148). The print stylesheet (the last @media print block in
// src/index.css) does the layout; this opens what CSS can't: the "SKU list:
// all N … products" lists on /catalog are closed <details>, and paper can't
// open them.
// Before the browser prints, every closed SKU list opens and is marked;
// afterwards the marked ones close again, so the page looks as it did. A
// list the buyer opened stays open. Only .sku-details: other <details> (the
// admin's staff notes) are React's to open and close.

export const SKU_LISTS = 'details.sku-details';
export const PRINT_OPENED = 'data-print-opened';

export function openForPrint(root = document) {
  for (const details of root.querySelectorAll(`${SKU_LISTS}:not([open])`)) {
    details.setAttribute(PRINT_OPENED, '');
    details.open = true;
  }
}

export function closeAfterPrint(root = document) {
  for (const details of root.querySelectorAll(`${SKU_LISTS}[${PRINT_OPENED}]`)) {
    details.removeAttribute(PRINT_OPENED);
    details.open = false;
  }
}

let uninstall = null;

// Listens for the browser's beforeprint and afterprint (Ctrl/Cmd+P, the
// receipt's Print button, the admin print views). Once per page: main.jsx
// calls it next to installDomGuards. Returns a function that stops listening.
export function installPrintHelpers(win = typeof window === 'undefined' ? null : window) {
  if (uninstall) return uninstall;
  if (!win?.addEventListener) return () => {};
  const before = () => openForPrint(win.document);
  const after = () => closeAfterPrint(win.document);
  win.addEventListener('beforeprint', before);
  win.addEventListener('afterprint', after);
  uninstall = () => {
    win.removeEventListener('beforeprint', before);
    win.removeEventListener('afterprint', after);
    uninstall = null;
  };
  return uninstall;
}
