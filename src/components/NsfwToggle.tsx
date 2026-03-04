/**
 * NsfwToggle Component
 *
 * Small pill toggle for NSFW content visibility.
 * Matches credit-counter style: "18+" label + 6px dot indicator.
 */

import { useNsfwToggle } from '@/hooks/useNsfwToggle';

export function NsfwToggle() {
  const { nsfwEnabled, toggle } = useNsfwToggle();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={nsfwEnabled}
      aria-label="Toggle adult content visibility"
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/6 border border-white/6 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      <span
        className={`text-[10px] font-semibold leading-none transition-opacity ${
          nsfwEnabled ? 'text-white/80' : 'text-white/30'
        }`}
      >
        18+
      </span>
      <span
        className={`block w-1.5 h-1.5 rounded-full transition-colors ${
          nsfwEnabled ? 'bg-nsfw' : 'bg-white/25'
        }`}
      />
    </button>
  );
}
