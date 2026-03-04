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
 * with placeholder routes (e.g. Profile → /feed) causing multiple elements
 * to have aria-current="page" on the same page.
 */

import { useRouterState, useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { NavIcon } from './NavIcon';

// Routes
const ROUTES = {
  FEED: '/feed',
  BROWSE: '/browse',
  PROFILE: '/feed', // Placeholder until profile route exists
  UPLOAD: '/feed', // Placeholder until upload route exists
} as const;

// Active paths for nav matching (different from actual routes due to placeholders)
const ACTIVE_PATHS = {
  FEED: '/feed',
  BROWSE: '/browse',
  PROFILE: '/profile',
  UPLOAD: '/creator/upload',
} as const;

type NavItem = {
  icon: 'feed' | 'browse' | 'profile' | 'upload';
  label: string;
  to: string;
  activePath: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: ROUTES.FEED, activePath: ACTIVE_PATHS.FEED },
  { icon: 'browse', label: 'Browse', to: ROUTES.BROWSE, activePath: ACTIVE_PATHS.BROWSE },
];

const PROFILE_NAV_ITEM: NavItem = {
  icon: 'profile',
  label: 'Profile',
  to: ROUTES.PROFILE,
  activePath: ACTIVE_PATHS.PROFILE,
};

const UPLOAD_NAV_ITEM: NavItem = {
  icon: 'upload',
  label: 'Upload',
  to: ROUTES.UPLOAD,
  activePath: ACTIVE_PATHS.UPLOAD,
};

/**
 * Determines if a nav item is active based on current path
 */
const isNavItemActive = (currentPath: string, activePath: string): boolean => {
  return currentPath === activePath || currentPath.startsWith(activePath + '/');
};

/**
 * Returns nav items array based on user role
 */
const getNavItems = (isCreator: boolean): NavItem[] => {
  if (isCreator) {
    return [...BASE_NAV_ITEMS, UPLOAD_NAV_ITEM, PROFILE_NAV_ITEM];
  }
  return [...BASE_NAV_ITEMS, PROFILE_NAV_ITEM];
};

/**
 * Active indicator dot component with reduced motion support
 */
const ActiveIndicator = ({ shouldReduce }: { shouldReduce: boolean }) => {
  const baseClasses = "absolute bottom-0 w-[3px] h-[3px] rounded-full bg-primary";

  if (shouldReduce) {
    return <span className={baseClasses} />;
  }

  return (
    <motion.span
      layoutId="nav-indicator"
      className={baseClasses}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
  );
};

/**
 * Individual navigation link component
 */
interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  shouldReduceMotion: boolean;
  onClick: (to: string) => void;
}

const NavLink = ({ item, isActive, shouldReduceMotion, onClick }: NavLinkProps) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick(item.to);
  };

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex flex-col items-center gap-[3px] pt-2 pb-1 transition-colors ${
        isActive ? 'text-white/85' : 'text-white/30'
      }`}
    >
      <NavIcon icon={item.icon} />
      <span className="text-[10px] font-medium tracking-[0.03em] leading-none font-[Inter,sans-serif]">
        {item.label}
      </span>
      {isActive && <ActiveIndicator shouldReduce={shouldReduceMotion} />}
    </a>
  );
};

/**
 * Mobile bottom navigation bar
 */
export function BottomNav({ isCreator = false }: { isCreator?: boolean }) {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;
  const navItems = getNavItems(isCreator);
  const shouldReduceMotion = useReducedMotion();

  const handleNavigate = (to: string) => {
    navigate({ to });
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="absolute bottom-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-xl border-t border-white/4 flex items-center justify-around"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(52px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.icon}
          item={item}
          isActive={isNavItemActive(currentPath, item.activePath)}
          shouldReduceMotion={shouldReduceMotion ?? false}
          onClick={handleNavigate}
        />
      ))}
    </nav>
  );
}

/**
 * Desktop side navigation link component
 */
interface SideNavLinkProps {
  item: NavItem;
  isActive: boolean;
  onClick: (to: string) => void;
}

const SideNavLink = ({ item, isActive, onClick }: SideNavLinkProps) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick(item.to);
  };

  const bgClasses = isActive
    ? 'bg-white/8 text-white/90'
    : 'text-white/40 hover:bg-white/4 hover:text-white/60';

  return (
    <a
      href={item.to}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${bgClasses}`}
    >
      <span className="w-5 h-5 shrink-0">
        <NavIcon icon={item.icon} />
      </span>
      <span className="text-[13px] font-medium tracking-[0.01em]">{item.label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </a>
  );
};

/**
 * Desktop side navigation items
 */
export function SideNavItems({ isCreator = false }: { isCreator?: boolean }) {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;
  const navItems = getNavItems(isCreator);

  const handleNavigate = (to: string) => {
    navigate({ to });
  };

  return (
    <nav className="px-4 mb-6" aria-label="Main navigation">
      {navItems.map((item) => (
        <SideNavLink
          key={item.icon}
          item={item}
          isActive={isNavItemActive(currentPath, item.activePath)}
          onClick={handleNavigate}
        />
      ))}
    </nav>
  );
}

/**
 * Sidebar category button for desktop layout
 */
export function SideCategoryItem({
  name,
  active,
  onClick
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  const activeClasses = 'bg-white/8 text-white/85 border border-white/8';
  const inactiveClasses = 'text-white/40 hover:bg-white/4 hover:text-white/60 border border-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
        active ? activeClasses : inactiveClasses
      }`}
    >
      {name}
    </button>
  );
}
