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
    <div className="min-h-dvh bg-sand pb-[calc(74px+env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-5xl">{children}</div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(23,20,17,0.06)] backdrop-blur-md"
      >
        <div className="mx-auto grid h-[68px] max-w-lg grid-cols-4 md:max-w-3xl lg:max-w-5xl">
          {NAV_ITEMS.map(({ route, label, icon: Icon }) => {
            const active =
              currentRoute === route || (route === '/' && currentRoute === '/avisos');
            return (
              <button
                key={route}
                type="button"
                onClick={() => onNavigate(route)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  active
                    ? 'font-semibold text-cantera'
                    : 'font-medium text-stone hover:text-ink'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-[2.5px] w-10 rounded-b-full bg-gold"
                  />
                )}
                <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.75} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
