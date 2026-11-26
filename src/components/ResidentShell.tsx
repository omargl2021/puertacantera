import type { ReactNode } from 'react';
import {
  Flag,
  Home,
  Printer,
  Receipt,
  Settings2,
  UserCircle2,
  UserPlus,
} from 'lucide-react';
import type { AppRoute, PortalUser } from '../types/portal';
import { isAdminUser } from '../utils/portalLogic';
import { BrandMark } from './BrandMark';

interface ResidentShellProps {
  currentRoute: AppRoute;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onLogout?: () => void;
  children: ReactNode;
}

const MOBILE_NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: '/', label: 'Inicio', icon: Home },
  { route: '/pagos', label: 'Pagos', icon: Receipt },
  { route: '/visitas', label: 'Visitas', icon: UserPlus },
  { route: '/reportes', label: 'Reportes', icon: Flag },
];

const DESKTOP_NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: typeof Home }> = [
  { route: '/', label: 'Inicio', icon: Home },
  { route: '/visitas', label: 'Visitas', icon: UserPlus },
  { route: '/corbatines', label: 'Imprimir corbatín', icon: Printer },
  { route: '/cuenta', label: 'Mi cuenta', icon: UserCircle2 },
];

export function ResidentShell({
  currentRoute,
  user,
  onNavigate,
  children,
}: ResidentShellProps) {
  const isAdmin = isAdminUser(user);

  return (
    <div className="flex min-h-dvh w-full bg-sand">
      {/* Desktop persistent sidebar (lg+) — full-screen workspace layout */}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col justify-between overflow-y-auto border-r border-gold/20 bg-gradient-to-b from-[#1B1712] via-night to-[#14110E] px-4 py-7 lg:flex">
        <div className="flex flex-col gap-6">
          <div className="border-b border-gold/15 pb-5 pl-2">
            <BrandMark variant="light" width={156} />
          </div>

          <nav aria-label="Principal escritorio" className="flex flex-col gap-1.5">
            {DESKTOP_NAV_ITEMS.map(({ route, label, icon: Icon }) => {
              const active =
                currentRoute === route || (route === '/' && currentRoute === '/avisos');
              return (
                <button
                  key={route}
                  type="button"
                  onClick={() => onNavigate(route)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[15px] transition-colors ${
                    active
                      ? 'border border-gold/35 bg-gold/14 font-semibold text-gold-light'
                      : 'border border-transparent text-night-text hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="size-[19px] shrink-0 text-gold" strokeWidth={active ? 2.2 : 1.8} />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}

            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/admin/padron')}
                className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-3.5 text-left text-[15px] font-semibold text-gold-light transition-colors hover:border-gold/60 hover:bg-gold/20"
              >
                <Settings2 className="size-[19px] shrink-0 text-gold" />
                <span className="truncate">Administración</span>
              </button>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content fills 100% of remaining viewport width on smartphone, tablet, and desktop */}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-[calc(74px+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="w-full flex-1">{children}</div>
      </div>

      {/* Smartphone & Tablet Bottom Navigation (< lg) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(23,20,17,0.06)] backdrop-blur-md lg:hidden"
      >
        <div className="grid h-[68px] w-full grid-cols-4">
          {MOBILE_NAV_ITEMS.map(({ route, label, icon: Icon }) => {
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
