/**
 * Sidebar Component
 *
 * Desktop always-visible sidebar navigation (~220px).
 * Contains: brand, nav items, categories, NSFW toggle.
 * Uses motion layoutId for sliding selection indicator.
 */

import { memo, useCallback } from 'react';
import { useRouterState, useNavigate, useSearch } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { useCategories } from '@/hooks/useCategories';
import { NsfwToggle } from './NsfwToggle';
import { NavIcon } from './NavIcon';

type NavItem = {
  icon: 'feed' | 'browse' | 'profile' | 'upload';
  label: string;
  to: string;
  activePath: string;
};

const CONSUMER_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/', activePath: '/' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

const CREATOR_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/', activePath: '/' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'upload', label: 'Upload', to: '/creator/uploads', activePath: '/creator/upload' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

const isNavItemActive = (currentPath: string, activePath: string): boolean => {
  if (activePath === '/') return currentPath === '/';
  return currentPath === activePath || currentPath.startsWith(activePath + '/');
};

const SPRING_TRANSITION = { type: 'spring' as const, duration: 0.35, bounce: 0.15 };

const SidebarNavLink = memo(function SidebarNavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (to: string) => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onNavigate(item.to);
    },
    [onNavigate, item.to],
  );

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`cursor-pointer relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isActive
          ? 'text-white/90'
          : 'text-white/40 hover:text-white/60'
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-nav-indicator"
          className="absolute inset-0 rounded-lg bg-white/8 border-r-2 border-r-primary"
          transition={SPRING_TRANSITION}
        />
      )}
      <span className="relative z-10 w-5 h-5 shrink-0">
        <NavIcon icon={item.icon} />
      </span>
      <span className="relative z-10 text-[13px] font-medium tracking-[0.01em]">{item.label}</span>
      {isActive && <span className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </a>
  );
});

const SidebarCategoryItem = memo(function SidebarCategoryItem({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer relative text-left px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
        active ? 'text-white/85' : 'text-white/35 hover:text-white/55'
      }`}
    >
      {active && (
        <motion.span
          layoutId="sidebar-category-indicator"
          className="absolute inset-0 rounded-md bg-white/8"
          transition={SPRING_TRANSITION}
        />
      )}
      <span className="relative z-10">{name}</span>
    </button>
  );
});

export function Sidebar() {
  const { data: session } = useOptimizedSession();
  const creatorMode = session?.user?.role === 'creator';
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const navItems = creatorMode ? CREATOR_NAV_ITEMS : CONSUMER_NAV_ITEMS;

  // Categories from API
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories ?? [];

  // Get current category from URL search params (works for both / and /browse)
  let currentCategory: string | undefined;
  try {
    const search = useSearch({ strict: false }) as { category?: string };
    currentCategory = search?.category;
  } catch {
    currentCategory = undefined;
  }

  const handleNavigate = useCallback(
    (to: string) => {
      navigate({ to });
    },
    [navigate],
  );

  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      // Navigate to browse with category filter, or clear it
      navigate({
        to: '/browse',
        search: (prev: Record<string, unknown>) => ({ ...prev, category: categoryId }),
        replace: currentPath === '/browse',
      });
    },
    [navigate, currentPath],
  );

  return (
    <div className="w-[220px] h-full bg-[hsl(240_10%_6%)] border-r border-white/6 flex flex-col overflow-y-auto shrink-0">
      {/* Brand */}
      <div className="px-6 pt-8 pb-6">
        <span className="text-[20px] font-bold text-white/90 tracking-[-0.02em]">
          aniclip
        </span>
      </div>

      {/* Nav items */}
      <nav className="px-3 mb-4" aria-label="Main navigation">
        {navItems.map((item) => (
          <SidebarNavLink
            key={item.icon}
            item={item}
            isActive={isNavItemActive(currentPath, item.activePath)}
            onNavigate={handleNavigate}
          />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-6 h-px bg-white/6 mb-4" />

      {/* Categories */}
      <div className="px-6 mb-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-3">Categories</h4>
        <div className="flex flex-col gap-0.5">
          <SidebarCategoryItem
            name="All"
            active={currentCategory === undefined}
            onClick={() => handleCategoryChange(undefined)}
          />
          {categories.map((cat) => (
            <SidebarCategoryItem
              key={cat.id}
              name={cat.name}
              active={currentCategory === cat.id}
              onClick={() => handleCategoryChange(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-white/6 mb-4" />

      {/* NSFW toggle */}
      <div className="px-6 mb-6 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Content</span>
        <NsfwToggle />
      </div>
    </div>
  );
}
