/**
 * Preferences Store (Zustand)
 *
 * Global state for user preferences persisted to localStorage.
 * Uses slices pattern for clean separation of concerns.
 *
 * Slices:
 * - ageGate: Age verification state
 * - nsfw: NSFW content visibility toggle
 * - likes: Episode like tracking (optimistic UI state)
 *
 * Usage: Always use atomic selectors to avoid unnecessary re-renders.
 *   const isConfirmed = usePreferencesStore((s) => s.ageGateConfirmed)
 *   const toggle = usePreferencesStore((s) => s.nsfwToggle)
 */

import { create, type StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Slice Types ──

interface AgeGateSlice {
  ageGateConfirmed: boolean;
  ageGateConfirm: () => void;
}

interface NsfwSlice {
  nsfwEnabled: boolean;
  nsfwToggle: () => void;
}

interface LikesSlice {
  likedEpisodes: Record<string, boolean>;
  setLiked: (episodeId: string, liked: boolean) => void;
  toggleLike: (episodeId: string) => void;
  isLiked: (episodeId: string) => boolean;
}

export type PreferencesStore = AgeGateSlice & NsfwSlice & LikesSlice;

// ── Slice Creators ──

const createAgeGateSlice: StateCreator<
  PreferencesStore,
  [['zustand/persist', unknown]],
  [],
  AgeGateSlice
> = (set) => ({
  ageGateConfirmed: false,
  ageGateConfirm: () => set({ ageGateConfirmed: true }),
});

const createNsfwSlice: StateCreator<
  PreferencesStore,
  [['zustand/persist', unknown]],
  [],
  NsfwSlice
> = (set, get) => ({
  nsfwEnabled: false,
  nsfwToggle: () => set({ nsfwEnabled: !get().nsfwEnabled }),
});

const createLikesSlice: StateCreator<
  PreferencesStore,
  [['zustand/persist', unknown]],
  [],
  LikesSlice
> = (set, get) => ({
  likedEpisodes: {},
  setLiked: (episodeId, liked) =>
    set((state) => ({
      likedEpisodes: { ...state.likedEpisodes, [episodeId]: liked },
    })),
  toggleLike: (episodeId) =>
    set((state) => ({
      likedEpisodes: {
        ...state.likedEpisodes,
        [episodeId]: !state.likedEpisodes[episodeId],
      },
    })),
  isLiked: (episodeId) => !!get().likedEpisodes[episodeId],
});

// ── Store ──

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (...a) => ({
      ...createAgeGateSlice(...a),
      ...createNsfwSlice(...a),
      ...createLikesSlice(...a),
    }),
    {
      name: 'webtoon-preferences',
      partialize: (state) => ({
        ageGateConfirmed: state.ageGateConfirmed,
        nsfwEnabled: state.nsfwEnabled,
        likedEpisodes: state.likedEpisodes,
      }),
    },
  ),
);

// ── Derived Selectors (stable references, no re-render on unrelated state changes) ──

/** NSFW query param derived from nsfwEnabled — 'all' or 'safe' */
export const selectNsfwParam = (state: PreferencesStore) =>
  state.nsfwEnabled ? 'all' : 'safe';
