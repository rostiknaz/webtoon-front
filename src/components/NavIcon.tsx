/**
 * NavIcon Component
 *
 * Shared navigation icon component for bottom nav and sidebar.
 * Renders lucide icons or custom SVG based on icon name.
 */

import { Search, Bell, User } from 'lucide-react';

interface NavIconProps {
  icon: 'feed' | 'browse' | 'updates' | 'profile';
  className?: string;
}

export function NavIcon({ icon, className = 'w-5 h-5' }: NavIconProps) {
  if (icon === 'feed') {
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
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }

  if (icon === 'browse') return <Search className={className} strokeWidth={1.5} />;
  if (icon === 'updates') return <Bell className={className} strokeWidth={1.5} />;
  if (icon === 'profile') return <User className={className} strokeWidth={1.5} />;

  return null;
}
