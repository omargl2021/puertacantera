import { useState, type FormEvent } from 'react';
import { Check, Download, Search, SlidersHorizontal, X } from 'lucide-react';
import type { PaymentStatus, PortalDatabase } from '../types/portal';
import {
  buildBalancesCsv,
  buildPaymentsCsv,
  computeHouseBalance,
  DEFAULT_TODAY_ISO,
  formatHouseLabel,
  formatMxnWhole,
  formatPeriodKickerEs,
  formatShortDateEs,
  getCurrentFeeSchedule,
  PAYMENT_STATUS_LABELS,
  type UpdateFeeScheduleInput,
} from '../utils/portalLogic';

function triggerCsvDownload(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ==================== 1. PAGOS POR VALIDAR ==================== */

interface AdminPaymentsViewProps {
  db: PortalDatabase;
  onReviewPayment: (
    paymentId: string,
    decision: 'approved' | 'adjusted' | 'rejected',
    approvedAmountMxn: number,
    reviewNote: string,
  ) => string | null;
}

export function AdminPaymentsView({ db, onReviewPayment }: AdminPaymentsViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('pending');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(db.payments[0]?.id ?? null);
  const [adjustedAmount, setAdjustedAmount] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const houseMap = new Map(db.houses.map((h) => [h.id, h]));

  const pendingCount = db.payments.filter((p) => p.status === 'pending').length;
  const approvedCount = db.payments.filter((p) => p.status === 'approved').length;
  const adjustedCount = db.payments.filter((p) => p.status === 'adjusted').length;
  const validatedTotal = db.payments
    .filter((p) => p.status === 'approved' || p.status === 'adjusted')
    .reduce((sum, p) => sum + (p.approvedAmountMxn ?? p.amountMxn), 0);

  const q = query.trim().toLowerCase();
  const filtered = db.payments.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!q) return true;
    const hLabel = formatHouseLabel(houseMap.get(p.houseId)).toLowerCase();
    return (
      hLabel.includes(q) ||
      p.userName.toLowerCase().includes(q) ||
      p.folio.toLowerCase().includes(q) ||
      p.reference.toLowerCase().includes(q)
    );
  });

  const activeSelected =
    filtered.find((p) => p.id === selectedId) ?? (filtered.length > 0 ? filtered[0] : null);

  const handleDecision = (decision: 'approved' | 'adjusted' | 'rejected') => {
    if (!activeSelected) return;
    const parsedAdjusted =
      decision === 'adjusted' ? Number(adjustedAmount) : activeSelected.amountMxn;
    const err = onReviewPayment(activeSelected.id, decision, parsedAdjusted, reviewNote);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setAdjustedAmount('');
    setReviewNote('');
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Tesorería · {formatPeriodKickerEs(DEFAULT_TODAY_ISO)}
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
            Pagos por validar
          </h1>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar casa, vecino o folio"
            className="h-11 w-full rounded-[10px] border border-input bg-white pr-3 pl-10 text-sm font-medium outline-none placeholder:text-stone/70 focus-visible:border-cantera"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Por revisar
          </span>
          <span className="font-heading text-3xl font-semibold text-warn tabular-nums">
            {pendingCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Aprobados
          </span>
          <span className="font-heading text-3xl font-semibold text-ok tabular-nums">
            {approvedCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Ajustados
          </span>
          <span className="font-heading text-3xl font-semibold text-info tabular-nums">
            {adjustedCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Monto validado
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {formatMxnWhole(validatedTotal)}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: 'pending', label: 'Por revisar' },
            { value: 'approved', label: 'Aprobados' },
            { value: 'adjusted', label: 'Ajustados' },
            { value: 'rejected', label: 'Rechazados' },
            { value: 'all', label: 'Todos' },
          ] as const
        ).map((chip) => {
          const active = statusFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusFilter(chip.value)}
              className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-night bg-night text-white'
                  : 'border-chip-line bg-white text-ink hover:bg-sand-2'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,400px)_1fr]">
        {/* Left List */}
        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-12 text-center">
              <p className="font-semibold text-ink">
                {statusFilter === 'pending'
                  ? 'No hay pagos por revisar'
                  : 'No hay pagos en este filtro'}
              </p>
              <p className="mt-1 text-sm text-stone">
                Cuando un vecino suba un comprobante aparecerá aquí.
              </p>
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = activeSelected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setAdjustedAmount(String(p.approvedAmountMxn ?? p.amountMxn));
                    setReviewNote(p.reviewNote ?? '');
                    setError(null);
                  }}
                  className={`flex flex-col gap-1 rounded-[16px] border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-cantera bg-white shadow-xs'
                      : 'border-line bg-white hover:bg-sand-2/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {formatHouseLabel(houseMap.get(p.houseId))}
                    </span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatMxnWhole(p.approvedAmountMxn ?? p.amountMxn)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-stone">
                    <span>
                      {p.folio} · {p.userName} · {p.periodLabel}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                        p.status === 'approved'
                          ? 'bg-ok-bg text-ok'
                          : p.status === 'pending'
                            ? 'bg-warn-bg text-warn'
                            : p.status === 'adjusted'
                              ? 'bg-info-bg text-info'
                              : 'bg-bad-bg text-bad'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail */}
        <div>
          {!activeSelected ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-12 text-center">
              <p className="font-semibold text-ink">Selecciona un pago</p>
              <p className="mt-1 text-sm text-stone">
                Aquí podrás revisar el comprobante, aprobarlo, ajustar el monto o rechazarlo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 rounded-[18px] border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="font-mono text-xs font-semibold text-stone">
                    {activeSelected.folio}
                  </span>
                  <h2 className="mt-0.5 font-heading text-2xl font-semibold text-ink">
                    {formatHouseLabel(houseMap.get(activeSelected.houseId))}
                  </h2>
                  <p className="text-sm text-stone">
                    {activeSelected.userName} · {formatShortDateEs(activeSelected.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-heading text-3xl font-semibold text-ink tabular-nums">
                    {formatMxnWhole(activeSelected.approvedAmountMxn ?? activeSelected.amountMxn)}
                  </p>
                  <span className="text-xs text-stone">
                    {activeSelected.monthsCovered}{' '}
                    {activeSelected.monthsCovered === 1 ? 'mes' : 'meses'} ·{' '}
                    {activeSelected.periodLabel}
                  </span>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-sand px-3.5 py-2.5">
                  <dt className="text-xs font-semibold text-stone uppercase">Método</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{activeSelected.method}</dd>
                </div>
                <div className="rounded-xl bg-sand px-3.5 py-2.5">
                  <dt className="text-xs font-semibold text-stone uppercase">Referencia</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-ink">
                    {activeSelected.reference}
                  </dd>
                </div>
                {activeSelected.notes && (
                  <div className="rounded-xl bg-sand px-3.5 py-2.5 sm:col-span-2">
                    <dt className="text-xs font-semibold text-stone uppercase">Nota del vecino</dt>
                    <dd className="mt-0.5 text-ink-soft">{activeSelected.notes}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="rev-amt" className="text-sm font-semibold text-ink">
                      Monto a validar (MXN)
                    </label>
                    <input
                      id="rev-amt"
                      type="number"
                      min={1}
                      value={adjustedAmount || String(activeSelected.amountMxn)}
                      onChange={(e) => setAdjustedAmount(e.target.value)}
                      className="h-11 rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="rev-note" className="text-sm font-semibold text-ink">
                      Observación de tesorería
                    </label>
                    <input
                      id="rev-note"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Conciliado en banco o motivo"
                      className="h-11 rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDecision('approved')}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-ok px-4 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <Check className="size-4" />
                    Aprobar pago
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('adjusted')}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink hover:bg-sand-2"
                  >
                    <SlidersHorizontal className="size-4" />
                    Ajustar monto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('rejected')}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-bad-bg px-4 text-sm font-semibold text-bad hover:opacity-90"
                  >
                    <X className="size-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ==================== 2. ESTADO POR CASA ==================== */

interface AdminHousesStatusViewProps {
  db: PortalDatabase;
  onExportToast: (message: string) => void;
}

export function AdminHousesStatusView({ db, onExportToast }: AdminHousesStatusViewProps) {
  const fee = getCurrentFeeSchedule(db.feeHistory);
  const activeHouses = db.houses.filter((h) => h.active);
  const balances = activeHouses.map((h) => computeHouseBalance(h, db.feeHistory, db.payments));

  const okCount = balances.filter((b) => b.status === 'ok').length;
  const debtCount = balances.filter((b) => b.status === 'debt').length;
  const totalDebt = balances.reduce((sum, b) => sum + b.debtMxn, 0);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Tesorería
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">
            Estado por casa
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              triggerCsvDownload('estado-de-cuenta-puerta-cantera.csv', buildBalancesCsv(db));
              onExportToast('CSV de estado de cuenta descargado.');
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-chip-line bg-white px-3.5 text-sm font-semibold text-ink hover:bg-sand-2"
          >
            <Download className="size-4" />
            Estado de cuenta (CSV)
          </button>
          <button
            type="button"
            onClick={() => {
              triggerCsvDownload('pagos-puerta-cantera.csv', buildPaymentsCsv(db));
              onExportToast('CSV de pagos descargado.');
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-chip-line bg-white px-3.5 text-sm font-semibold text-ink hover:bg-sand-2"
          >
            <Download className="size-4" />
            Pagos (CSV)
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">Casas</span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {activeHouses.length}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Al corriente
          </span>
          <span className="font-heading text-3xl font-semibold text-ok tabular-nums">
            {okCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Con adeudo
          </span>
          <span className="font-heading text-3xl font-semibold text-warn tabular-nums">
            {debtCount}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Adeudo total
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {formatMxnWhole(totalDebt)}
          </span>
        </div>
      </section>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
        <table className="w-full min-w-[600px] text-left text-[15px]">
          <thead className="border-b border-line bg-sand-2 text-[13px] font-semibold tracking-[0.06em] text-stone uppercase">
            <tr>
              <th className="px-4 py-3">Casa</th>
              <th className="px-4 py-3">Familia</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Pagado hasta</th>
              <th className="px-4 py-3 text-right">Meses</th>
              <th className="px-4 py-3 text-right">Adeudo</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((row) => (
              <tr key={row.house.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                  {formatHouseLabel(row.house)}
                </td>
                <td className="px-4 py-2.5">{row.house.familyName || '—'}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      row.status === 'ok' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                    }`}
                  >
                    {row.status === 'ok' ? 'Al corriente' : 'Con adeudo'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-stone">{row.paidUntilLabel}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.monthsOwed}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {formatMxnWhole(row.debtMxn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-stone">
        La cuota mensual vigente es de {formatMxnWhole(fee.monthlyMxn)} y vence el día {fee.dueDay}{' '}
        de cada mes. Los pagos aprobados o ajustados acreditan meses en automático.
      </p>
    </>
  );
}

/* ==================== 3. CUOTAS ==================== */

interface AdminFeesViewProps {
  db: PortalDatabase;
  onUpdateFees: (input: UpdateFeeScheduleInput) => string | null;
}

export function AdminFeesView({ db, onUpdateFees }: AdminFeesViewProps) {
  const current = getCurrentFeeSchedule(db.feeHistory);
  const [monthly, setMonthly] = useState(String(current.monthlyMxn));
  const [semiannual, setSemiannual] = useState(String(current.semiannualMxn));
  const [annual, setAnnual] = useState(String(current.annualMxn));
  const [dueDay, setDueDay] = useState(String(current.dueDay));
  const [billingStart, setBillingStart] = useState(current.billingStartMonth);
  const [effectiveFrom, setEffectiveFrom] = useState(DEFAULT_TODAY_ISO);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onUpdateFees({
      monthlyMxn: Number(monthly),
      semiannualMxn: Number(semiannual),
      annualMxn: Number(annual),
      dueDay: Number(dueDay),
      billingStartMonth: billingStart,
      effectiveFrom,
    });
    setError(err);
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold tracking-[0.1em] text-stone uppercase">
            Tesorería
          </span>
          <h1 className="font-heading text-[34px] leading-none font-semibold text-ink">Cuotas</h1>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Mensual
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {formatMxnWhole(current.monthlyMxn)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Semestral
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {formatMxnWhole(current.semiannualMxn)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">Anual</span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {formatMxnWhole(current.annualMxn)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] border border-line bg-white p-4">
          <span className="text-xs font-semibold tracking-[0.06em] text-stone uppercase">
            Día límite
          </span>
          <span className="font-heading text-3xl font-semibold text-ink tabular-nums">
            {current.dueDay}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-5">
        <h2 className="font-heading text-2xl font-semibold text-ink">Cambiar cuotas</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-monthly" className="text-sm font-semibold text-ink">
              Mensual (MXN)
            </label>
            <input
              id="fee-monthly"
              type="number"
              min={1}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-semi" className="text-sm font-semibold text-ink">
              Semestral (MXN)
            </label>
            <input
              id="fee-semi"
              type="number"
              min={1}
              value={semiannual}
              onChange={(e) => setSemiannual(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-annual" className="text-sm font-semibold text-ink">
              Anual (MXN)
            </label>
            <input
              id="fee-annual"
              type="number"
              min={1}
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-day" className="text-sm font-semibold text-ink">
              Día límite de pago
            </label>
            <input
              id="fee-day"
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-start" className="text-sm font-semibold text-ink">
              Inicio de cobro
            </label>
            <input
              id="fee-start"
              type="month"
              value={billingStart}
              onChange={(e) => setBillingStart(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fee-eff" className="text-sm font-semibold text-ink">
              Vigente desde
            </label>
            <input
              id="fee-eff"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad sm:col-span-2 lg:col-span-3"
            >
              {error}
            </p>
          )}

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-cantera px-5 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              Guardar cuotas
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl font-semibold text-ink">Historial</h2>
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="w-full min-w-[600px] text-left text-[15px]">
            <thead className="border-b border-line bg-sand-2 text-[13px] font-semibold tracking-[0.06em] text-stone uppercase">
              <tr>
                <th className="px-4 py-3">Vigente desde</th>
                <th className="px-4 py-3 text-right">Mensual</th>
                <th className="px-4 py-3 text-right">Semestral</th>
                <th className="px-4 py-3 text-right">Anual</th>
                <th className="px-4 py-3 text-right">Día límite</th>
                <th className="px-4 py-3">Registrada</th>
              </tr>
            </thead>
            <tbody>
              {db.feeHistory.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                    {formatShortDateEs(item.effectiveFrom)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatMxnWhole(item.monthlyMxn)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatMxnWhole(item.semiannualMxn)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatMxnWhole(item.annualMxn)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{item.dueDay}</td>
                  <td className="px-4 py-2.5 text-stone">
                    {formatShortDateEs(item.createdAt)} · {item.createdBy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
