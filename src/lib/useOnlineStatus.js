// Whether the browser is online, kept current by its online and offline
// events (AW-344). False only when the browser is sure it has no
// connection (src/lib/network.js isOffline); the server snapshot is online.

import { useSyncExternalStore } from 'react';
import { isOffline } from './network.js';

function subscribe(onChange) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = () => !isOffline();
const getServerSnapshot = () => true;

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
