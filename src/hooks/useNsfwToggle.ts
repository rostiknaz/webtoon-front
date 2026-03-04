/**
 * NSFW Toggle Hook
 *
 * Thin wrapper around the Zustand preferences store.
 * Returns toggle state, toggle function, and feed query param.
 */

import { usePreferencesStore, selectNsfwParam } from '@/stores/usePreferencesStore';

export function useNsfwToggle() {
  const nsfwEnabled = usePreferencesStore((s) => s.nsfwEnabled);
  const toggle = usePreferencesStore((s) => s.nsfwToggle);
  const nsfwParam = usePreferencesStore(selectNsfwParam);

  return { nsfwEnabled, toggle, nsfwParam } as const;
}
