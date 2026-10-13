import { useCallback, useSyncExternalStore } from 'react';

// The compact layout: the header collapses to menu/logo/account/cart + search
// and category filters move into a drawer. It applies below 850px at the
// default text size (em, so larger text switches sooner, AW-162) and on short
// touch screens such as a large phone in landscape (AW-151). The compact
// @media blocks in src/index.css use this exact string (src/styles.test.js).
export const MOBILE_QUERY = '(max-width: 53.125em), (hover: none) and (pointer: coarse) and (max-height: 31.25em)';

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
