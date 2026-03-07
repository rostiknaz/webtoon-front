/**
 * Shared Navigation Configuration
 *
 * Nav item definitions and active state logic used by BottomNav and Sidebar.
 */

export type NavIconType = 'feed' | 'browse' | 'profile' | 'upload' | 'dashboard' | 'series';

export interface NavItem {
  icon: NavIconType;
  label: string;
  to: string;
  activePath: string;
}

export const CONSUMER_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/', activePath: '/' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

export const CREATOR_NAV_ITEMS: NavItem[] = [
  { icon: 'feed', label: 'Feed', to: '/', activePath: '/' },
  { icon: 'browse', label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'dashboard', label: 'Dashboard', to: '/dashboard', activePath: '/dashboard' },
  { icon: 'upload', label: 'Upload', to: '/creator/uploads', activePath: '/creator/upload' },
  { icon: 'series', label: 'Series', to: '/creator/series', activePath: '/creator/series' },
  { icon: 'profile', label: 'Profile', to: '/profile', activePath: '/profile' },
];

/** Check if a nav item is active given the current path */
export const isNavItemActive = (currentPath: string, activePath: string): boolean => {
  if (activePath === '/') return currentPath === '/';
  return currentPath === activePath || currentPath.startsWith(activePath + '/');
};
