import type { ReactNode } from 'react';
import { Flag, Home, Receipt, UserPlus } from 'lucide-react';
import type { AppRoute } from '../types/portal';

interface ResidentShellProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: '/', label: 'Inicio', icon: Home },
  { route: '/pagos', label: 'Pagos', icon: Receipt },
  { route: '/visitas', label: 'Visitas', icon: UserPlus },
  { route: '/reportes', label: 'Reportes', icon: Flag },
];

export function ResidentShell({ currentRoute, onNavigate, children }: ResidentShellProps) {
  return (
    <div className="min-h-dvh bg-sand pb-[calc(68px+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-lg">{children}</div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-4">
          {NAV_ITEMS.map(({ route, label, icon: Icon }) => {
            const active =
              currentRoute === route || (route === '/' && currentRoute === '/avisos');
            return (
              <button
                key={route}
                type="button"
                onClick={() => onNavigate(route)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  active ? 'font-semibold text-cantera' : 'font-medium text-stone hover:text-ink'
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
