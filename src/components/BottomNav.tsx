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

import { memo, useCallback } from 'react';
import { useRouterState, useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { useOptimizedSession } from '@/hooks/useOptimizedSession';
import { NavIcon } from './NavIcon';
import { getNavItemsForRole, isNavItemActive, type NavItem } from './nav-config';

// Stable transition object — avoids allocation per render
const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 400, damping: 30 };

const INDICATOR_CLASS = 'absolute bottom-0 w-[3px] h-[3px] rounded-full bg-primary';

// Stable inline style object for safe area
const NAV_STYLE = {
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  height: 'calc(52px + env(safe-area-inset-bottom, 0px))',
} as const;

/**
 * Memoized nav link — only re-renders when isActive or shouldReduceMotion changes
 */
const NavLink = memo(function NavLink({
  item,
  isActive,
  shouldReduceMotion,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  shouldReduceMotion: boolean;
  onNavigate: (to: string) => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigate(item.to);
  }, [onNavigate, item.to]);

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`cursor-pointer relative flex flex-col items-center gap-[3px] pt-2 pb-1 transition-colors ${
        isActive ? 'text-white/85' : 'text-white/30'
      }`}
    >
      <NavIcon icon={item.icon} />
      <span className="text-[10px] font-medium tracking-[0.03em] leading-none font-[Inter,sans-serif]">
        {item.label}
      </span>
      {isActive && (
        shouldReduceMotion
          ? <span className={INDICATOR_CLASS} />
          : <motion.span layoutId="nav-indicator" className={INDICATOR_CLASS} transition={SPRING_TRANSITION} />
      )}
    </a>
  );
});

/**
 * Mobile bottom navigation bar
 */
export function BottomNav() {
  const { data: session } = useOptimizedSession();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const navItems = getNavItemsForRole(session?.user?.role);

  const handleNavigate = useCallback((to: string) => {
    navigate({ to });
  }, [navigate]);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="absolute bottom-0 left-0 right-0 z-[60] bg-black/70 backdrop-blur-xl border-t border-white/4 flex items-center justify-around"
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

/**
 * Memoized side nav link
 */
const SideNavLink = memo(function SideNavLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (to: string) => void;
}) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigate(item.to);
  }, [onNavigate, item.to]);

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        isActive ? 'bg-white/8 text-white/90 border-r-2 border-r-primary' : 'text-white/40 hover:bg-white/4 hover:text-white/60'
      }`}
    >
      <span className="w-5 h-5 shrink-0">
        <NavIcon icon={item.icon} />
      </span>
      <span className="text-[13px] font-medium tracking-[0.01em]">{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </a>
  );
});

/**
 * Desktop side navigation items
 */
export function SideNavItems() {
  const { data: session } = useOptimizedSession();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const navItems = getNavItemsForRole(session?.user?.role);

  const handleNavigate = useCallback((to: string) => {
    navigate({ to });
  }, [navigate]);

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

/**
 * Sidebar category button for desktop layout
 */
export const SideCategoryItem = memo(function SideCategoryItem({
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
      className={`cursor-pointer text-left px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
        active
          ? 'bg-white/8 text-white/85 border border-white/8'
          : 'text-white/40 hover:bg-white/4 hover:text-white/60 border border-transparent'
      }`}
    >
      {name}
    </button>
  );
});
