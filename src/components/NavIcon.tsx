/**
 * NavIcon Component
 *
 * Shared navigation icon component for bottom nav and sidebar.
 * All icons: thin-stroke (1.5px), no fill, currentColor.
 */

import { Search, User, Upload, LayoutDashboard, Film } from 'lucide-react';
import type { NavIconType } from './nav-config';

interface NavIconProps {
  icon: NavIconType;
  className?: string;
}

function FeedIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

const ICON_MAP: Record<NavIconType, React.ComponentType<{ className: string; strokeWidth?: number }>> = {
  feed: FeedIcon,
  browse: Search,
  profile: User,
  upload: Upload,
  dashboard: LayoutDashboard,
  series: Film,
};

export function NavIcon({ icon, className = 'w-5 h-5' }: NavIconProps) {
  const Icon = ICON_MAP[icon];
  return <Icon className={className} strokeWidth={1.5} />;
}
