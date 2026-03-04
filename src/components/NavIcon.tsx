/**
 * NavIcon Component
 *
 * Shared navigation icon component for bottom nav and sidebar.
 * All icons: thin-stroke (1.5px), no fill, currentColor.
 */

import { Search, User, Upload } from 'lucide-react';

interface NavIconProps {
  icon: 'feed' | 'browse' | 'profile' | 'upload';
  className?: string;
}

export function NavIcon({ icon, className = 'w-5 h-5' }: NavIconProps) {
  if (icon === 'feed') {
    // Grid/play icon — represents feed content
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

  if (icon === 'browse') return <Search className={className} strokeWidth={1.5} />;
  if (icon === 'profile') return <User className={className} strokeWidth={1.5} />;
  if (icon === 'upload') return <Upload className={className} strokeWidth={1.5} />;

  return null;
}
