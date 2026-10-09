// Unsaved admin edits are not dropped without a word (AW-118). While `dirty`
// is true, leaving through a link, a section change, Back or Forward asks
// first (window.confirm, through the router's leave guard), and reloading or
// closing the tab gets the browser's own "Leave site?" prompt. Clean forms
// and unmounted ones hold neither.

import { useEffect } from 'react';
import { setNavigationGuard } from '../../lib/router.js';

export const LEAVE_MESSAGE = 'You have changes that aren’t saved. Leave without saving them?';

export function useLeaveGuard(dirty, message = LEAVE_MESSAGE) {
  useEffect(() => {
    if (!dirty) return undefined;
    const release = setNavigationGuard(() => window.confirm(message));
    const onBeforeUnload = (event) => {
      event.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      release();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty, message]);
}
