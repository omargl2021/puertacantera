import { useState, type ReactNode } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import type { AppRoute } from '../types/portal';
import { BrandMark } from './BrandMark';

interface AdminShellProps {
  currentRoute: AppRoute;
  pendingPaymentsCount: number;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}

interface NavSection {
  title: string;
  items: Array<{ route: AppRoute; label: string; badge?: number }>;
}

export function AdminShell({
  currentRoute,
  pendingPaymentsCount,
  onNavigate,
  children,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: NavSection[] = [
    {
      title: 'Tesorería',
      items: [
        { route: '/admin/tesoreria', label: 'Pagos por validar', badge: pendingPaymentsCount },
        { route: '/admin/tesoreria/casas', label: 'Estado por casa' },
        { route: '/admin/tesoreria/cuotas', label: 'Cuotas' },
      ],
    },
    {
      title: 'Comunidad',
      items: [
        { route: '/admin/avisos', label: 'Avisos' },
        { route: '/admin/reportes', label: 'Reportes' },
        { route: '/admin/visitas', label: 'Bitácora de visitas' },
        { route: '/admin/padron', label: 'Vecinos y casas' },
        { route: '/admin/corbatines', label: 'Imprimir corbatín' },
      ],
    },
    {
      title: 'Control',
      items: [{ route: '/admin/bitacora', label: 'Bitácora de cambios' }],
    },
  ];

  const handleLinkClick = (route: AppRoute) => {
    setMobileOpen(false);
    onNavigate(route);
  };

  const renderNav = () => (
    <nav aria-label="Administración" className="flex flex-col gap-1">
      {sections.map((section, idx) => (
        <div key={section.title} className="flex flex-col gap-1">
          <span
            className={`px-3 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-night-label uppercase ${
              idx > 0 ? 'pt-5' : ''
            }`}
          >
            {section.title}
          </span>
          {section.items.map((item) => {
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handleLinkClick(item.route)}
                className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[15px] transition-colors ${
                  active
                    ? 'border border-gold/30 bg-gold/12 font-semibold text-gold-light'
                    : 'border border-transparent text-night-text hover:bg-white/[0.05]'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-xs font-bold text-night tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <button
        type="button"
        onClick={() => handleLinkClick('/')}
        className="mt-6 flex min-h-11 w-full items-center gap-2 rounded-xl border border-night-line px-3 text-left text-[14px] font-medium text-night-muted transition-colors hover:border-gold/35 hover:bg-white/[0.04] hover:text-gold-light"
      >
        <ArrowLeft className="size-4 text-gold" />
        Volver a la app
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-sand">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-7 overflow-y-auto border-r border-gold/15 bg-gradient-to-b from-[#1B1712] via-night to-[#14110E] px-4 py-7 lg:flex">
        <div className="border-b border-gold/15 pb-5 pl-2">
          <BrandMark variant="light" width={152} />
        </div>
        {renderNav()}
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gold/20 bg-night px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 lg:hidden">
          <BrandMark variant="light" width={108} />
          <button
            type="button"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex size-11 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold transition-colors hover:bg-gold/20"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full w-[268px] max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-gold/20 bg-night px-4 py-6">
              <div className="flex items-center justify-between border-b border-gold/15 pb-4 pl-2">
                <BrandMark variant="light" width={132} />
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={() => setMobileOpen(false)}
                  className="flex size-10 items-center justify-center rounded-full text-gold-light hover:bg-white/10"
                >
                  <X className="size-5" />
                </button>
              </div>
              {renderNav()}
            </div>
          </div>
        )}

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
