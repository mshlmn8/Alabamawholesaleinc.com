// The header's count of orders placed since this admin last opened Admin ->
// Orders (AW-111): App calls it with the signed-in approved admin's id (null
// for everyone else, which does nothing), and passes the count to the
// header's Admin link and, on admin pages, to the title ('(2) Orders · Admin
// · …'). It counts again every minute while the tab is visible, when the tab
// becomes visible, and at once when Orders stores a visit or sees a new
// order. Without the admin_order_views table (the live database before the
// October 2026 update) it stays 0: no badge, the title unchanged.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { countUnseen, onOrdersActivity } from './ordersSeen.js';

export const UNSEEN_POLL_MS = 60000;

export function useAdminUnseen(adminId, client = supabase) {
  const [state, setState] = useState({ id: null, count: 0 });
  useEffect(() => {
    if (!adminId || !client) return undefined;
    let cancelled = false;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      countUnseen(client, adminId).then((count) => {
        if (!cancelled && count != null) setState({ id: adminId, count });
      });
    };
    refresh();
    const timer = setInterval(refresh, UNSEEN_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const stop = onOrdersActivity(refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [adminId, client]);
  return adminId && state.id === adminId ? state.count : 0;
}
