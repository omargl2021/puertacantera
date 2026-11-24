import { useState } from 'react';
import { Bell, Flag, Pin, QrCode, Settings2, UserPlus } from 'lucide-react';
import type { AppRoute, NoticeCategory, PortalDatabase, PortalUser } from '../types/portal';
import {
  computeHouseBalance,
  formatHouseLabel,
  formatMxnWhole,
  formatShortDateEs,
  getCurrentFeeSchedule,
  NOTICE_CATEGORY_LABELS,
} from '../utils/portalLogic';
import { BrandMark } from './BrandMark';

interface ResidentHomeProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
}

const NOTICE_FILTERS: Array<{ value: 'all' | NoticeCategory; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'administracion', label: 'Administración' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'eventos', label: 'Eventos' },
];

export function ResidentHome({ db, user, onNavigate }: ResidentHomeProps) {
  const [category, setCategory] = useState<'all' | NoticeCategory>('all');
  const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
  const fee = getCurrentFeeSchedule(db.feeHistory);
  const balance = house ? computeHouseBalance(house, db.feeHistory, db.payments) : null;
  const canAccessAdmin = user.role === 'admin' || user.role === 'treasurer';

  const filteredNotices = [...db.notices]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    .filter((n) => (category === 'all' ? true : n.category === category));

  return (
    <div>
      <header className="bg-night px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[72px]">
        <div className="flex items-center justify-between gap-2">
          <BrandMark variant="light" width={118} />

          <div className="flex items-center gap-2">
            {canAccessAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/admin/tesoreria')}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-night-line px-3.5 text-sm font-semibold text-night-text transition-colors hover:bg-white/5"
              >
                <Settings2 className="size-4" />
                Administración
              </button>
            )}

            <button
              type="button"
              aria-label="Mi cuenta y notificaciones"
              onClick={() => onNavigate('/cuenta')}
              className="flex size-11 items-center justify-center rounded-full border border-night-line text-night-text transition-colors hover:bg-white/5"
            >
              <Bell className="size-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <span className="text-[15px] text-night-muted">Hola,</span>
          <h1 className="font-heading text-[34px] leading-[1.05] font-semibold text-white">
            {user.name}
          </h1>
        </div>
      </header>

      {/* Floating account status card */}
      <section className="relative mx-4 -mt-[52px] rounded-[18px] bg-white p-[18px] shadow-[0_8px_24px_rgba(35,32,29,0.10)]">
        {!house || !balance ? (
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Tu usuario no está ligado a una casa, así que no tienes estado de cuenta.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.08em] text-stone uppercase">
                  {formatHouseLabel(house)}
                </p>
                <p className="mt-1 font-heading text-2xl font-semibold text-ink tabular-nums">
                  {balance.status === 'debt' ? formatMxnWhole(balance.debtMxn) : '$0'}
                </p>
                <p className="text-xs text-stone">
                  Cuota mensual {formatMxnWhole(fee.monthlyMxn)} · Día límite: {fee.dueDay}
                </p>
              </div>

              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                  balance.status === 'ok'
                    ? 'bg-ok-bg text-ok'
                    : 'bg-warn-bg text-warn'
                }`}
              >
                {balance.status === 'ok' ? 'Al corriente' : 'Con adeudo'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
              <span className="text-stone">
                {balance.pendingCount > 0
                  ? `${balance.pendingCount} pago por validar`
                  : `Pagado hasta: ${balance.paidUntilLabel}`}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/pagos')}
                className="font-semibold text-cantera hover:underline"
              >
                Registrar pago →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3-column Quick Actions */}
      <section className="grid grid-cols-3 gap-2.5 px-4 pt-[22px]">
        <button
          type="button"
          onClick={() => onNavigate('/visitas')}
          className="flex flex-col items-center gap-2 rounded-[16px] border border-line bg-white px-2 py-3.5 text-center transition-colors hover:bg-sand-2/50"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-cantera-soft text-cantera">
            <UserPlus className="size-5" />
          </span>
          <span className="text-[13px] font-semibold text-ink">Nueva visita</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/reportes')}
          className="flex flex-col items-center gap-2 rounded-[16px] border border-line bg-white px-2 py-3.5 text-center transition-colors hover:bg-sand-2/50"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-cantera-soft text-cantera">
            <Flag className="size-5" />
          </span>
          <span className="text-[13px] font-semibold text-ink">Reportar</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('/visitas')}
          className="flex flex-col items-center gap-2 rounded-[16px] border border-line bg-white px-2 py-3.5 text-center transition-colors hover:bg-sand-2/50"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-cantera-soft text-cantera">
            <QrCode className="size-5" />
          </span>
          <span className="text-[13px] font-semibold text-ink">Mis pases</span>
        </button>
      </section>

      {/* Avisos section */}
      <section className="flex flex-col gap-3 px-4 pt-[26px] pb-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-2xl font-semibold text-ink">Avisos</h2>
          <button
            type="button"
            onClick={() => onNavigate('/avisos')}
            className="text-sm font-semibold text-cantera hover:underline"
          >
            Ver todos
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Filtrar avisos por categoría"
          className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
        >
          {NOTICE_FILTERS.map((f) => {
            const active = category === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(f.value)}
                className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-night bg-night text-white'
                    : 'border-chip-line bg-white text-ink hover:bg-sand-2'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {filteredNotices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-8 text-center">
            <p className="text-sm font-medium text-stone">No hay avisos en esta categoría.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredNotices.slice(0, 5).map((notice) => (
              <article
                key={notice.id}
                className="flex flex-col gap-1.5 rounded-[16px] border border-line bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-sand-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                    {NOTICE_CATEGORY_LABELS[notice.category]}
                  </span>
                  {notice.urgent && (
                    <span className="inline-flex items-center rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad">
                      Urgente
                    </span>
                  )}
                  {notice.pinned && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-cantera">
                      <Pin className="size-3" />
                      Fijado
                    </span>
                  )}
                  <span className="ml-auto text-xs text-stone">
                    {formatShortDateEs(notice.createdAt, false)}
                  </span>
                </div>
                <h3 className="font-semibold text-ink">{notice.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{notice.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
