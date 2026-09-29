// Account notices at the top of the page: an email link that did not work
// (AW-015), a session that ended on its own (AW-048), an account service that
// cannot be reached, and the result of signing out (AW-336). Each can be
// dismissed; App decides which apply and when they go away.
//
// A new notice is read out through the shared live region, a moment after
// the page-change announcement so neither cuts the other off. The catalog's
// notices (src/lib/catalogNotices.js, AW-204) use the same list.
//
// When a notice goes away while focus is in it (dismissed, or its "Try
// again" worked), focus moves to <main> instead of falling back to <body>.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { announce } from '../lib/announce.js';
import { Icon } from './Icon.jsx';

// notices: [{ id, title?, text, tone?: 'warn', actions?: [{ id, label, onClick, disabled? }], onDismiss? }]
export function SiteNotices({ notices }) {
  const announced = useRef(new Set());
  const focused = useRef(null);
  useLayoutEffect(() => {
    const el = focused.current;
    if (!el || el.isConnected) return;
    focused.current = null;
    const active = document.activeElement;
    if (!active || active === document.body) document.getElementById('main')?.focus({ preventScroll: true });
  }, [notices]);
  useEffect(() => {
    const ids = new Set(notices.map((n) => n.id));
    // A notice that went away is read out again if it comes back.
    for (const id of [...announced.current]) if (!ids.has(id)) announced.current.delete(id);
    const fresh = notices.filter((n) => !announced.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => announced.current.add(n.id));
    const text = fresh.map((n) => [n.title, n.text].filter(Boolean).join('. ')).join(' ');
    window.setTimeout(() => announce(text), 400);
  }, [notices]);

  if (!notices.length) return null;
  const dismiss = (notice) => {
    notice.onDismiss();
    // The × button goes away with the notice; keep focus on the page.
    document.getElementById('main')?.focus({ preventScroll: true });
  };
  return (
    <div className="site-notices" onFocus={(e) => { focused.current = e.target; }}>
      {notices.map((notice) => (
        <div key={notice.id} className={`site-notice${notice.tone === 'warn' ? ' is-warn' : ''}`} data-notice={notice.id}>
          <div className="site-notice-body">
            {notice.title && <p className="site-notice-title">{notice.title}</p>}
            <p>{notice.text}</p>
            {notice.actions?.length > 0 && (
              <div className="site-notice-actions">
                {notice.actions.map((action) => (
                  <button key={action.id} className="text-link" type="button" onClick={action.onClick} disabled={action.disabled}>{action.label}</button>
                ))}
              </div>
            )}
          </div>
          {notice.onDismiss && (
            <button className="icon-btn site-notice-close" type="button" aria-label="Dismiss this notice" onClick={() => dismiss(notice)}><Icon name="close" /></button>
          )}
        </div>
      ))}
    </div>
  );
}
