import { useCallback, useSyncExternalStore } from 'react';

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

// Tracks a CSS media query so components can render one control set per
// layout (e.g. the filter sidebar on desktop, a drawer on phones).
export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    if (!canMatch()) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  const getSnapshot = () => (canMatch() ? window.matchMedia(query).matches : false);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
