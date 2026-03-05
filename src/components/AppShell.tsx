/**
 * AppShell Component
 *
 * Unified layout wrapper providing consistent navigation on all pages.
 * - Mobile (< 768px): content + BottomNav at bottom
 * - Desktop (>= 768px): fixed 220px Sidebar + content
 */

import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { useIsDesktop } from '@/hooks/useIsDesktop';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isDesktop = useIsDesktop();

  return (
    <div className="fixed inset-0 bg-[hsl(240_8%_3%)] flex">
      {/* Desktop sidebar */}
      {isDesktop && <Sidebar />}

      {/* Main content area */}
      <div className="flex-1 h-full relative overflow-hidden">
        {children}
      </div>

      {/* Mobile bottom nav */}
      {!isDesktop && <BottomNav />}
    </div>
  );
}
