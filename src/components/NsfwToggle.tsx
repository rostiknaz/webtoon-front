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
      className={`cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 ${
        nsfwEnabled
          ? 'bg-[hsl(340_50%_45%/0.15)] border border-[hsl(340_50%_45%/0.3)] hover:bg-[hsl(340_50%_45%/0.22)]'
          : 'bg-white/6 border border-white/6 hover:bg-white/10'
      }`}
    >
      <span
        className={`block w-1.5 h-1.5 rounded-full transition-colors ${
          nsfwEnabled ? 'bg-[hsl(340_50%_55%)]' : 'bg-white/25'
        }`}
      />
      <span
        className={`text-[10px] font-semibold leading-none transition-colors ${
          nsfwEnabled ? 'text-[hsl(340_50%_55%)]' : 'text-white/30'
        }`}
      >
        18+
      </span>
    </button>
  );
}
