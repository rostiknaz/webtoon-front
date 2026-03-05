/**
 * BottomNav Component
 *
 * Mobile bottom navigation with Motion layoutId animated active indicator.
 * - Consumer: 3 tabs (Feed, Browse, Profile)
 * - Creator: 4 tabs (Feed, Browse, Upload, Profile)
 * UX spec: thin-stroke icons, 3px dot indicator, 85%/30% opacity states.
 *
 * Uses <a> + useNavigate instead of TanStack Router's <Link> because Link
 * auto-adds aria-current="page" when `to` matches the URL, which conflicts
 * with placeholder routes (e.g. Upload → /feed) causing multiple elements
 * to have aria-current="page" on the same page.
 */

import { memo, useCallback, useMemo } from 'react';
import { useRouterState, useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { NavIcon } from './NavIcon';

// ============================================================================
// Types
// ============================================================================

type NavIconType = 'feed' | 'browse' | 'profile' | 'upload';

interface NavItem {
  icon: NavIconType;
  label: string;
  to: string;
  activePath: string;
}

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  shouldReduceMotion: boolean;
  onNavigate: (to: string) => void;
}

interface SideNavLinkProps {
  item: NavItem;
  isActive: boolean;
  onNavigate: (to: string) => void;
}

interface NavigationProps {
  isCreator?: boolean;
}

interface SideCategoryItemProps {
  name: string;
  active: boolean;
  onClick: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CONSUMER_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/feed', activePath: '/feed' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

const CREATOR_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/feed', activePath: '/feed' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'upload', label: 'Upload', to: '/feed', activePath: '/creator/upload' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

const INDICATOR_CLASS = 'absolute bottom-0 w-[3px] h-[3px] rounded-full bg-primary';

const NAV_STYLE = {
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

const isNavItemActive = (currentPath: string, activePath: string): boolean =>
  currentPath === activePath || currentPath.startsWith(`${activePath}/`);

// ============================================================================
// Custom Hook - Extract Shared Logic
// ============================================================================

/**
 * Hook to determine creator mode from session or explicit prop
 */
function useCreatorMode(isCreator?: boolean): boolean {
  const { data: session } = useOptimizedSession();
  return useMemo(
    () => isCreator ?? session?.user?.role === 'creator',
    [isCreator, session?.user?.role]
  );
}

/**
 * Hook to create stable navigate handler
 */
function useNavigateHandler() {
  const navigate = useNavigate();
  return useCallback((to: string) => navigate({ to }), [navigate]);
}

// ============================================================================
// Components - Mobile Navigation
// ============================================================================

const NavLink = memo(function NavLink({
  item,
  isActive,
  shouldReduceMotion,
  onNavigate,
}: NavLinkProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onNavigate(item.to);
    },
    [onNavigate, item.to]
  );

  const activeClass = isActive ? 'text-white/85' : 'text-white/30';

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex flex-col items-center gap-[3px] pt-2 pb-1 transition-colors ${activeClass}`}
    >
      <NavIcon icon={item.icon} />
      <span className="text-[10px] font-medium tracking-[0.03em] leading-none font-[Inter,sans-serif]">
        {item.label}
      </span>
      {isActive && (
        shouldReduceMotion ? (
          <span className={INDICATOR_CLASS} />
        ) : (
          <motion.span
            layoutId="nav-indicator"
            className={INDICATOR_CLASS}
            transition={SPRING_TRANSITION}
          />
        )
      )}
    </a>
  );
});

export function BottomNav({ isCreator }: NavigationProps = {}) {
  const creatorMode = useCreatorMode(isCreator);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const shouldReduceMotion = useReducedMotion() ?? false;
  const handleNavigate = useNavigateHandler();

  const navItems = creatorMode ? CREATOR_NAV_ITEMS : CONSUMER_NAV_ITEMS;

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="absolute bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-xl border-t border-white/4 flex items-center justify-around"
      style={NAV_STYLE}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.icon}
          item={item}
          isActive={isNavItemActive(currentPath, item.activePath)}
          shouldReduceMotion={shouldReduceMotion}
          onNavigate={handleNavigate}
        />
      ))}
    </nav>
  );
}

// ============================================================================
// Components - Desktop Side Navigation
// ============================================================================

const SideNavLink = memo(function SideNavLink({
  item,
  isActive,
  onNavigate,
}: SideNavLinkProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onNavigate(item.to);
    },
    [onNavigate, item.to]
  );

  const activeClass = isActive
    ? 'bg-white/8 text-white/90'
    : 'text-white/40 hover:bg-white/4 hover:text-white/60';

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${activeClass}`}
    >
      <span className="w-5 h-5 shrink-0">
        <NavIcon icon={item.icon} />
      </span>
      <span className="text-[13px] font-medium tracking-[0.01em]">{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </a>
  );
});

export function SideNavItems({ isCreator }: NavigationProps = {}) {
  const creatorMode = useCreatorMode(isCreator);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const handleNavigate = useNavigateHandler();

  const navItems = creatorMode ? CREATOR_NAV_ITEMS : CONSUMER_NAV_ITEMS;

  return (
    <nav className="px-4 mb-6" aria-label="Main navigation">
      {navItems.map((item) => (
        <SideNavLink
          key={item.icon}
          item={item}
          isActive={isNavItemActive(currentPath, item.activePath)}
          onNavigate={handleNavigate}
        />
      ))}
    </nav>
  );
}

// ============================================================================
// Components - Category Button
// ============================================================================

export const SideCategoryItem = memo(function SideCategoryItem({
  name,
  active,
  onClick,
}: SideCategoryItemProps) {
  const activeClass = active
    ? 'bg-white/8 text-white/85 border border-white/8'
    : 'text-white/40 hover:bg-white/4 hover:text-white/60 border border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md text-[13px] font-medium transition-all ${activeClass}`}
    >
      {name}
    </button>
  );
});
