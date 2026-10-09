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
//                      'This didn't open' dialog with Reload when it can't.
//
// App's route ErrorBoundary says when a page's code didn't load
// (isChunkLoadError in src/lib/chunks.js). Nothing reloads by itself.

import { Suspense, lazy, useEffect } from 'react';
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

export function DialogFailed({ onClose, eyebrow }) {
  return (
    <DialogShell onClose={onClose} eyebrow={eyebrow} role="alertdialog" labelledBy="lazy-dialog-failed-title" describedBy="lazy-dialog-failed-text">
      <h2 id="lazy-dialog-failed-title">This didn’t open</h2>
      <p className="desc" id="lazy-dialog-failed-text">The site may have been updated, or the connection dropped. Reload to try again.</p>
      <div className="dialog-actions">
        <button className="button" type="button" data-autofocus onClick={() => window.location.reload()}>Reload</button>
      </div>
    </DialogShell>
  );
}

// `children` is the lazy dialog; it brings its own ModalLayer once loaded.
export function LazyDialog({ onClose, eyebrow, children }) {
  return (
    <ErrorBoundary fallback={<DialogFailed onClose={onClose} eyebrow={eyebrow} />}>
      <Suspense fallback={<DialogLoading onClose={onClose} eyebrow={eyebrow} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
