/**
 * CategoryChips — horizontal scrollable category pill selector
 *
 * Single-select mode for feed filtering. Tapping active chip clears filter.
 * Glass background variant for feed overlay, keyboard accessible.
 */

import { useRef, useCallback } from 'react';
import type { CategoryItem } from '../types';

interface CategoryChipsProps {
  categories: CategoryItem[];
  activeCategory: string | undefined;
  onCategoryChange: (categoryId: string | undefined) => void;
}

export function CategoryChips({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleChipClick = useCallback(
    (categoryId: string | undefined) => {
      // Tap active chip → clear filter; tap inactive → activate
      if (categoryId === activeCategory) {
        onCategoryChange(undefined);
      } else {
        onCategoryChange(categoryId);
      }
    },
    [activeCategory, onCategoryChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        (target.nextElementSibling as HTMLElement)?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        (target.previousElementSibling as HTMLElement)?.focus();
      }
    },
    [],
  );

  const isAllActive = activeCategory === undefined;

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto scrollbar-none flex-nowrap px-3 py-2"
      role="toolbar"
      aria-label="Category filter"
    >
      {/* "All" chip — always first */}
      <button
        type="button"
        aria-pressed={isAllActive}
        onClick={() => handleChipClick(undefined)}
        onKeyDown={handleKeyDown}
        className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
          isAllActive
            ? 'bg-white/20 text-white border border-white/30 backdrop-blur-sm'
            : 'bg-transparent text-white/50 hover:text-white/80'
        }`}
      >
        All
      </button>

      {categories.map((category) => {
        const isActive = activeCategory === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleChipClick(category.id)}
            onKeyDown={handleKeyDown}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-white/20 text-white border border-white/30 backdrop-blur-sm'
                : 'bg-transparent text-white/50 hover:text-white/80'
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
