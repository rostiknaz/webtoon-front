/**
 * useIsDesktop Hook
 *
 * Media query hook for detecting desktop viewport (min-width: 768px).
 * Uses useSyncExternalStore for SSR compatibility.
 */

import { useSyncExternalStore } from 'react';

const MD_QUERY = '(min-width: 768px)';

const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(MD_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

const getSnapshot = () => window.matchMedia(MD_QUERY).matches;
const getServerSnapshot = () => false; // SSR defaults to mobile

/**
 * Returns true if viewport is desktop (≥768px), false otherwise.
 * SSR-safe: defaults to mobile during server rendering.
 */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
