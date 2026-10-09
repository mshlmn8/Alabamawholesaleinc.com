// Pages and dialogs whose code loads when first opened (AW-179).
//
//   lazyPage(factory)  React.lazy for a page: `factory` is
//                      () => import('…').then((m) => ({ default: m.Page })).
//                      Once its code has arrived after a link or Back, the
//                      page's heading takes focus, as on any other page;
//   <PageLoading />    App's Suspense fallback while that code downloads: a
//                      page head with a 'Loading…' status line and no h1, so
//                      the router focuses <main> meanwhile;
//   <LazyDialog>       a dialog's own error boundary and Suspense: a small
//                      'Loading…' dialog while its code downloads, and a
//                      'This didn't open' dialog with Reload when it can't
//                      (or when it fails some other way, said apart).
//
// App's factories wait for the connection and reload a page whose code
// didn't download once (loadPage in src/lib/chunks.js, NEW-006); App's route
// ErrorBoundary says when it still didn't load after that. A dialog never
// reloads by itself.

import { Suspense, lazy, useEffect } from 'react';
import { clearChunkReload, isChunkLoadError } from '../lib/chunks.js';
import { focusPageHeading, useLocation } from '../lib/router.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { Icon } from './Icon.jsx';
import { ModalLayer } from './ModalLayer.jsx';

export function PageLoading() {
  return (
    <div className="page-head page-loading">
      <p role="status">Loading…</p>
    </div>
  );
}

// Rendered with the page, so its effect runs once the page's code is in and
// the page is on screen. The router focused <main> while the loading view
// (no h1) showed; the page's h1 takes over. A page opened directly keeps the
// browser's own focus, and focus the visitor moved meanwhile stays put.
function PageArrived() {
  const { action } = useLocation();
  const navigated = action !== 'load';
  useEffect(() => {
    // Its code loaded: a later file that fails may reload once again
    // (src/lib/chunks.js, NEW-006).
    clearChunkReload();
    if (!navigated) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.tagName === 'MAIN') focusPageHeading();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page first renders
  }, []);
  return null;
}

export function lazyPage(factory) {
  const Page = lazy(factory);
  function LazyPage(props) {
    return (
      <>
        <Page {...props} />
        <PageArrived />
      </>
    );
  }
  return LazyPage;
}

function DialogShell({ onClose, eyebrow, role = 'dialog', labelledBy, label, describedBy, initialFocus, children }) {
  return (
    <ModalLayer onClose={onClose}>
      {/* Backdrop click is a mouse shortcut; Escape (ModalLayer) and the Close button are the keyboard paths. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="overlay" onClick={onClose}>
        {/* Keeps clicks inside the dialog from reaching the backdrop. */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div className="dialog confirm-dialog" role={role} aria-modal="true" aria-labelledby={labelledBy} aria-label={label}
          aria-describedby={describedBy} onClick={(e) => e.stopPropagation()}>
          <div className="dialog-top">
            <p className="eyebrow">{eyebrow}</p>
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Close" data-autofocus={initialFocus === 'close' ? '' : undefined}><Icon name="close" /></button>
          </div>
          {children}
        </div>
      </div>
    </ModalLayer>
  );
}

export function DialogLoading({ onClose, eyebrow }) {
  return (
    <DialogShell onClose={onClose} eyebrow={eyebrow} label="Loading" initialFocus="close">
      <p className="desc" role="status">Loading…</p>
    </DialogShell>
  );
}

// Only a file that didn't download blames an update or the connection; any
// other error (a browser missing something the dialog needs, NEW-019) says
// only that it went wrong, since a reload alone may not fix it.
export const DIALOG_NOT_LOADED_TEXT = 'The site may have been updated, or the connection dropped. Reload to try again.';
export const DIALOG_FAILED_TEXT = 'Something went wrong opening this. Reload to try again.';

export function DialogFailed({ onClose, eyebrow, error = null }) {
  return (
    <DialogShell onClose={onClose} eyebrow={eyebrow} role="alertdialog" labelledBy="lazy-dialog-failed-title" describedBy="lazy-dialog-failed-text">
      <h2 id="lazy-dialog-failed-title">This didn’t open</h2>
      <p className="desc" id="lazy-dialog-failed-text">{isChunkLoadError(error) ? DIALOG_NOT_LOADED_TEXT : DIALOG_FAILED_TEXT}</p>
      <div className="dialog-actions">
        <button className="button" type="button" data-autofocus onClick={() => window.location.reload()}>Reload</button>
      </div>
    </DialogShell>
  );
}

// `children` is the lazy dialog; it brings its own ModalLayer once loaded.
export function LazyDialog({ onClose, eyebrow, children }) {
  return (
    <ErrorBoundary fallback={(error) => <DialogFailed onClose={onClose} eyebrow={eyebrow} error={error} />}>
      <Suspense fallback={<DialogLoading onClose={onClose} eyebrow={eyebrow} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
