/**
 * BottomNav Component
 *
 * Shared bottom navigation for mobile layout.
 * Uses TanStack Router Link for actual navigation.
 */

import { Link, useRouterState } from '@tanstack/react-router';
import { NavIcon } from './NavIcon';

const navItems = [
  { icon: 'feed' as const, label: 'Feed', to: '/feed', activePath: '/feed' },
  { icon: 'browse' as const, label: 'Browse', to: '/browse', activePath: '/browse' },
  { icon: 'updates' as const, label: 'Updates', to: '/feed', activePath: '/updates' }, // placeholder
  { icon: 'profile' as const, label: 'Profile', to: '/feed', activePath: '/profile' }, // placeholder
] as const;

export function BottomNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 h-[52px] bg-black/70 backdrop-blur-xl border-t border-white/4 flex items-center justify-around">
      {navItems.map((item) => {
        const active = currentPath === item.activePath;
        const color = active ? 'text-white/85' : 'text-white/30 hover:text-white/50';
        return (
          <Link
            key={item.icon}
            to={item.to}
            className={`flex flex-col items-center gap-[3px] transition-colors ${color}`}
          >
            <NavIcon icon={item.icon} />
            <span className="text-[9px] font-medium tracking-[0.03em] leading-none">
              {item.label}
              {active && <span className="block w-[3px] h-[3px] rounded-full bg-primary mx-auto mt-[3px]" />}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * SideNav Component
 *
 * Shared side navigation items for desktop layout.
 */
export function SideNavItems() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav className="px-4 mb-6">
      {navItems.map((item) => {
        const active = currentPath === item.activePath;
        const bg = active ? 'bg-white/8 text-white/90' : 'text-white/40 hover:bg-white/4 hover:text-white/60';
        return (
          <Link
            key={item.icon}
            to={item.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${bg}`}
          >
            <span className="w-5 h-5 shrink-0">
              <NavIcon icon={item.icon} />
            </span>
            <span className="text-[13px] font-medium tracking-[0.01em]">{item.label}</span>
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * SideCategoryItem — shared sidebar category button for desktop layout
 */
export function SideCategoryItem({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md text-[13px] font-medium transition-all ${
        active
          ? 'bg-white/8 text-white/85 border border-white/8'
          : 'text-white/40 hover:bg-white/4 hover:text-white/60 border border-transparent'
      }`}
    >
      {name}
    </button>
  );
}
