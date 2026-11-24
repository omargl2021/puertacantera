import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  ImagePlus,
  Pin,
  Plus,
  QrCode,
  Receipt,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AppRoute,
  NoticeCategory,
  PaymentRecord,
  PortalDatabase,
  PortalUser,
  ReportCategory,
  VisitAccessType,
} from '../types/portal';
import {
  computeHouseBalance,
  DEFAULT_TODAY_ISO,
  formatFileSizeEs,
  formatHouseLabel,
  formatMxnWhole,
  formatShortDateEs,
  getCurrentFeeSchedule,
  NOTICE_CATEGORY_LABELS,
  PAYMENT_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  validateReceiptImageFile,
  type CreateReportInput,
  type CreateVisitPassInput,
  type SubmitPaymentInput,
} from '../utils/portalLogic';
import { QrCodeSvg } from './QrCodeSvg';

interface ResidentPageHeaderProps {
  title: string;
  onBack: () => void;
}

function ResidentPageHeader({ title, onBack }: ResidentPageHeaderProps) {
  return (
    <header className="flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),2.25rem)] pb-3 md:px-6 lg:px-8">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Volver"
          onClick={onBack}
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink hover:bg-white/60 lg:hidden"
        >
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="flex-1 font-heading text-[28px] leading-tight font-semibold text-ink sm:text-[32px]">
          {title}
        </h1>
      </div>
    </header>
  );
}

function NoHouseAssignedCard() {
  return (
    <div className="px-4 md:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-8 text-center">
        <p className="font-semibold text-ink">Sin casa asignada</p>
        <p className="text-sm text-stone">
          Pide a la administración que ligue tu usuario a tu casa.
        </p>
      </div>
    </div>
  );
}

/* ==================== PAGOS ==================== */

interface ResidentPaymentsProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onSubmitPayment: (input: SubmitPaymentInput) => string | null;
}

export function ResidentPayments({
  db,
  user,
  onNavigate,
  onSubmitPayment,
}: ResidentPaymentsProps) {
  const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
  const fee = getCurrentFeeSchedule(db.feeHistory);
  const [plan, setPlan] = useState<'monthly' | 'semiannual' | 'annual'>('monthly');
  const [periodLabel, setPeriodLabel] = useState('Noviembre 2026');
  const [method, setMethod] = useState<PaymentRecord['method']>('Transferencia SPEI');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [receiptFileSize, setReceiptFileSize] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [zoomedReceiptUrl, setZoomedReceiptUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const planConfig = {
    monthly: { label: 'Mensual', months: 1, amount: fee.monthlyMxn, defaultPeriod: 'Noviembre 2026' },
    semiannual: {
      label: 'Semestral',
      months: 6,
      amount: fee.semiannualMxn,
      defaultPeriod: 'Nov 2026 – Abr 2027',
    },
    annual: { label: 'Anual', months: 12, amount: fee.annualMxn, defaultPeriod: 'Nov 2026 – Oct 2027' },
  };

  if (!house) {
    return (
      <div>
        <ResidentPageHeader title="Pagos" onBack={() => onNavigate('/')} />
        <NoHouseAssignedCard />
      </div>
    );
  }

  const balance = computeHouseBalance(house, db.feeHistory, db.payments);
  const myPayments = db.payments.filter((p) => p.houseId === house.id);

  const handlePlanChange = (nextPlan: 'monthly' | 'semiannual' | 'annual') => {
    setPlan(nextPlan);
    setPeriodLabel(planConfig[nextPlan].defaultPeriod);
  };

  const clearReceipt = () => {
    setReceiptImageUrl('');
    setReceiptFileName('');
    setReceiptFileSize(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateReceiptImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (validationError) {
      clearReceipt();
      setError(validationError);
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        setError('No se pudo leer la imagen seleccionada.');
        return;
      }

      // Keep stored receipt lightweight for browser persistence while preserving clarity
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        if (img.naturalWidth <= maxDim && img.naturalHeight <= maxDim && file.size <= 900 * 1024) {
          setReceiptImageUrl(rawDataUrl);
          setReceiptFileName(file.name);
          setReceiptFileSize(file.size);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setReceiptImageUrl(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          setReceiptImageUrl(rawDataUrl);
        }
        setReceiptFileName(file.name);
        setReceiptFileSize(file.size);
      };
      img.onerror = () => {
        setReceiptImageUrl(rawDataUrl);
        setReceiptFileName(file.name);
        setReceiptFileSize(file.size);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setError('No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cfg = planConfig[plan];
    const err = onSubmitPayment({
      periodLabel,
      monthsCovered: cfg.months,
      amountMxn: cfg.amount,
      method,
      receiptImageUrl,
      receiptFileName,
      receiptFileSizeBytes: receiptFileSize,
      notes,
    });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    clearReceipt();
    setNotes('');
  };

  return (
    <div>
      <ResidentPageHeader title="Pagos" onBack={() => onNavigate('/')} />

      <div className="flex flex-col gap-4 px-4 pb-8 md:px-6 lg:px-8">
        <section className="flex flex-col gap-2 rounded-[18px] border border-line bg-white p-[18px]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.08em] text-stone uppercase">
                {formatHouseLabel(house)}
              </p>
              <p className="mt-0.5 font-heading text-2xl font-semibold text-ink tabular-nums">
                {balance.status === 'debt'
                  ? `Adeudo ${formatMxnWhole(balance.debtMxn)}`
                  : 'Sin adeudo'}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                balance.status === 'ok' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
              }`}
            >
              {balance.status === 'ok' ? 'Al corriente' : `${balance.monthsOwed} mes`}
            </span>
          </div>
          <p className="text-xs text-stone">
            Pagado hasta: <strong>{balance.paidUntilLabel}</strong> · Día límite de pago: {fee.dueDay}
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-[18px]">
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-cantera" />
            <h2 className="font-heading text-xl font-semibold text-ink">Subir comprobante</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['monthly', 'semiannual', 'annual'] as const).map((key) => {
              const item = planConfig[key];
              const active = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePlanChange(key)}
                  className={`flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors ${
                    active
                      ? 'border-cantera bg-cantera-soft text-cantera'
                      : 'border-line bg-white text-ink hover:bg-sand-2'
                  }`}
                >
                  <span className="text-xs font-semibold">{item.label}</span>
                  <span className="mt-0.5 text-sm font-semibold tabular-nums">
                    {formatMxnWhole(item.amount)}
                  </span>
                </button>
              );
            })}
          </div>

          <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pay-period" className="text-sm font-semibold text-ink">
                Periodo
              </label>
              <input
                id="pay-period"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pay-method" className="text-sm font-semibold text-ink">
                Método de pago
              </label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              >
                <option value="Transferencia SPEI">Transferencia SPEI</option>
                <option value="Depósito bancario">Depósito bancario</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pay-receipt" className="text-sm font-semibold text-ink">
                Comprobante de pago
              </label>

              <input
                ref={fileInputRef}
                id="pay-receipt"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*"
                onChange={handleReceiptChange}
                className="sr-only"
              />

              {!receiptImageUrl ? (
                <label
                  htmlFor="pay-receipt"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-chip-line bg-sand/50 px-4 py-6 text-center transition-colors hover:border-cantera hover:bg-cantera-soft/30"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-cantera-soft text-cantera">
                    <ImagePlus className="size-5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">
                      Seleccionar imagen del comprobante
                    </span>
                    <span className="text-xs text-stone">
                      JPG, PNG, WebP o HEIC · 1 imagen (máx. 5 MB)
                    </span>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-[14px] border border-line bg-sand/60 p-3">
                  <button
                    type="button"
                    onClick={() => setZoomedReceiptUrl(receiptImageUrl)}
                    className="size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-white"
                    aria-label="Ver comprobante en grande"
                  >
                    <img
                      src={receiptImageUrl}
                      alt="Vista previa del comprobante de pago"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">
                      {receiptFileName}
                    </span>
                    <span className="text-xs text-stone">
                      {formatFileSizeEs(receiptFileSize)} · Imagen lista
                    </span>
                    <div className="mt-1 flex items-center gap-3">
                      <label
                        htmlFor="pay-receipt"
                        className="cursor-pointer text-xs font-semibold text-cantera hover:underline"
                      >
                        Cambiar imagen
                      </label>
                      <button
                        type="button"
                        onClick={clearReceipt}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-bad hover:underline"
                      >
                        <Trash2 className="size-3" />
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pay-notes" className="text-sm font-semibold text-ink">
                Nota <span className="font-normal text-stone">(opcional)</span>
              </label>
              <input
                id="pay-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Banco emisor o comentarios"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
            >
              Enviar comprobante ({formatMxnWhole(planConfig[plan].amount)})
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading text-xl font-semibold text-ink">Historial de pagos</h2>
          {myPayments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-6 text-center text-sm text-stone">
              Aún no has enviado comprobantes de pago.
            </div>
          ) : (
            myPayments.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-[14px] border border-line bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {p.periodLabel} · {formatMxnWhole(p.approvedAmountMxn ?? p.amountMxn)}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                <p className="text-xs text-stone">
                  {p.folio} · {p.method} · {formatShortDateEs(p.createdAt)}
                </p>
                {p.receiptImageUrl && (
                  <button
                    type="button"
                    onClick={() => setZoomedReceiptUrl(p.receiptImageUrl ?? null)}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-sand/50 p-2 text-left transition-colors hover:bg-sand-2/70"
                  >
                    <img
                      src={p.receiptImageUrl}
                      alt={`Comprobante ${p.folio}`}
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs font-semibold text-ink">
                        {p.receiptFileName || 'Comprobante de pago'}
                      </span>
                      <span className="text-[11px] text-cantera">Ver imagen completa</span>
                    </div>
                  </button>
                )}
                {p.reviewNote && (
                  <p className="rounded-lg bg-sand px-2.5 py-1.5 text-xs text-ink-soft">
                    Tesorería: {p.reviewNote}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      {zoomedReceiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante de pago"
          onClick={() => setZoomedReceiptUrl(null)}
        >
          <div
            className="relative max-h-[88vh] max-w-lg overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Cerrar vista previa"
              onClick={() => setZoomedReceiptUrl(null)}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-night/80 text-white hover:bg-night"
            >
              <X className="size-4" />
            </button>
            <img
              src={zoomedReceiptUrl}
              alt="Comprobante de pago completo"
              className="max-h-[82vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== VISITAS ==================== */

interface ResidentVisitsProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onCreatePass: (input: CreateVisitPassInput) => string | null;
  onCancelPass: (passId: string) => void;
  onCheckInPass: (passId: string) => void;
  onCopyCode: (code: string) => void;
}

export function ResidentVisits({
  db,
  user,
  onNavigate,
  onCreatePass,
  onCancelPass,
  onCheckInPass,
  onCopyCode,
}: ResidentVisitsProps) {
  const house = user.houseId ? db.houses.find((h) => h.id === user.houseId) ?? null : null;
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [companions, setCompanions] = useState(0);
  const [accessType, setAccessType] = useState<VisitAccessType>('single');
  const [validFrom, setValidFrom] = useState(DEFAULT_TODAY_ISO);
  const [validUntil, setValidUntil] = useState(DEFAULT_TODAY_ISO);
  const [error, setError] = useState<string | null>(null);

  if (!house) {
    return (
      <div>
        <ResidentPageHeader title="Nueva visita" onBack={() => onNavigate('/')} />
        <NoHouseAssignedCard />
      </div>
    );
  }

  const myPasses = db.passes.filter((p) => p.houseId === house.id);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onCreatePass({
      visitorName,
      phone,
      plate,
      vehicleModel,
      vehicleColor,
      companions,
      accessType,
      validFrom,
      validUntil,
    });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setVisitorName('');
    setPhone('');
    setPlate('');
    setVehicleModel('');
    setVehicleColor('');
    setCompanions(0);
  };

  return (
    <div>
      <ResidentPageHeader title="Nueva visita" onBack={() => onNavigate('/')} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:px-6 lg:px-8">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[18px]"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="v-name" className="text-sm font-semibold text-ink">
              Nombre del visitante
            </label>
            <input
              id="v-name"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Ej. Laura Méndez"
              className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-access" className="text-sm font-semibold text-ink">
                Tipo de acceso
              </label>
              <select
                id="v-access"
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as VisitAccessType)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              >
                <option value="single">Una entrada</option>
                <option value="multi">Múltiples entradas</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-comp" className="text-sm font-semibold text-ink">
                Acompañantes
              </label>
              <input
                id="v-comp"
                type="number"
                min={0}
                max={20}
                value={companions}
                onChange={(e) => setCompanions(Number(e.target.value) || 0)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-from" className="text-sm font-semibold text-ink">
                Válido desde
              </label>
              <input
                id="v-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-until" className="text-sm font-semibold text-ink">
                Hasta
              </label>
              <input
                id="v-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-plate" className="text-sm font-semibold text-ink">
                Placas <span className="font-normal text-stone">(opc.)</span>
              </label>
              <input
                id="v-plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="MCH-410-B"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium uppercase outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-phone" className="text-sm font-semibold text-ink">
                Teléfono <span className="font-normal text-stone">(opc.)</span>
              </label>
              <input
                id="v-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="443 000 0000"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-model" className="text-sm font-semibold text-ink">
                Vehículo <span className="font-normal text-stone">(opc.)</span>
              </label>
              <input
                id="v-model"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Mazda CX-5"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="v-color" className="text-sm font-semibold text-ink">
                Color <span className="font-normal text-stone">(opc.)</span>
              </label>
              <input
                id="v-color"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                placeholder="Gris"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none placeholder:text-stone/60 focus-visible:border-cantera"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px"
          >
            <QrCode className="size-4" />
            Generar pase QR
          </button>
        </form>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Mis pases</h2>
          {myPasses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-6 text-center text-sm text-stone">
              No tienes pases generados todavía.
            </div>
          ) : (
            myPasses.map((pass) => (
              <article
                key={pass.id}
                className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{pass.visitorName}</h3>
                    <p className="text-xs text-stone">
                      {pass.accessType === 'single' ? 'Una entrada' : 'Múltiples entradas'} ·{' '}
                      {formatShortDateEs(pass.validFrom, false)} al{' '}
                      {formatShortDateEs(pass.validUntil, false)}
                    </p>
                    {(pass.plate || pass.vehicleModel) && (
                      <p className="mt-0.5 text-xs text-stone">
                        {[pass.vehicleModel, pass.vehicleColor, pass.plate].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                      pass.status === 'active'
                        ? 'bg-ok-bg text-ok'
                        : pass.status === 'used'
                          ? 'bg-info-bg text-info'
                          : 'bg-sand-2 text-stone'
                    }`}
                  >
                    {pass.status === 'active'
                      ? 'Activo'
                      : pass.status === 'used'
                        ? 'Usado'
                        : 'Cancelado'}
                  </span>
                </div>

                {pass.status === 'active' && (
                  <div className="flex items-center gap-4 rounded-xl bg-sand p-3">
                    <QrCodeSvg code={pass.code} size={96} />
                    <div className="flex flex-1 flex-col gap-2">
                      <div>
                        <span className="text-[11px] font-semibold tracking-wider text-stone uppercase">
                          Código de caseta
                        </span>
                        <p className="font-mono text-lg font-semibold text-ink">{pass.code}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onCopyCode(pass.code)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-chip-line bg-white px-2.5 text-xs font-semibold text-ink hover:bg-sand-2"
                        >
                          <Copy className="size-3.5" />
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => onCheckInPass(pass.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-ok-bg px-2.5 text-xs font-semibold text-ok hover:opacity-90"
                        >
                          <ShieldCheck className="size-3.5" />
                          Registrar entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelPass(pass.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-bad-bg px-2.5 text-xs font-semibold text-bad hover:opacity-90"
                        >
                          <XCircle className="size-3.5" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

/* ==================== REPORTES ==================== */

interface ResidentReportsProps {
  db: PortalDatabase;
  user: PortalUser;
  onNavigate: (route: AppRoute) => void;
  onCreateReport: (input: CreateReportInput) => string | null;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  'Alumbrado',
  'Agua',
  'Seguridad',
  'Áreas verdes',
  'Portón',
  'Otro',
];

export function ResidentReports({
  db,
  user,
  onNavigate,
  onCreateReport,
}: ResidentReportsProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('Agua');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const visibleReports =
    user.role === 'admin'
      ? db.reports
      : user.houseId
        ? db.reports.filter((r) => r.houseId === user.houseId)
        : [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const err = onCreateReport({ title, category, location, description });
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setTitle('');
    setLocation('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <div>
      <header className="flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),2.25rem)] pb-3 md:px-6 lg:px-8">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Volver"
            onClick={() => onNavigate('/')}
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink hover:bg-white/60 lg:hidden"
          >
            <ChevronLeft className="size-6" />
          </button>
          <h1 className="flex-1 font-heading text-[28px] leading-tight font-semibold text-ink sm:text-[32px]">
            Reportes
          </h1>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cantera px-3.5 text-sm font-semibold text-white hover:bg-cantera-dark"
          >
            <Plus className="size-4" />
            Nuevo
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-8 md:px-6 lg:px-8">
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-white p-[18px]"
          >
            <h2 className="font-heading text-xl font-semibold text-ink">Levantar reporte</h2>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="r-title" className="text-sm font-semibold text-ink">
                Título
              </label>
              <input
                id="r-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Fuga en llave de jardín"
                className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="r-cat" className="text-sm font-semibold text-ink">
                  Categoría
                </label>
                <select
                  id="r-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
                >
                  {REPORT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="r-loc" className="text-sm font-semibold text-ink">
                  Ubicación
                </label>
                <input
                  id="r-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Calle o casa"
                  className="h-12 w-full rounded-[10px] border border-input bg-white px-3 text-base font-medium outline-none focus-visible:border-cantera"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="r-desc" className="text-sm font-semibold text-ink">
                Descripción
              </label>
              <textarea
                id="r-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el problema con detalle"
                className="w-full rounded-[10px] border border-input bg-white p-3 text-base font-medium outline-none focus-visible:border-cantera"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2 text-sm font-medium text-bad">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-cantera px-4 text-base font-semibold text-white hover:bg-cantera-dark"
            >
              Enviar reporte
            </button>
          </form>
        )}

        {visibleReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-8 text-center">
            <p className="font-semibold text-ink">Sin reportes</p>
            <p className="text-sm text-stone">Aquí verás el seguimiento de tus reportes.</p>
          </div>
        ) : (
          visibleReports.map((report) => {
            const step = report.status === 'resolved' ? 3 : report.status === 'in_progress' ? 2 : 1;
            return (
              <article
                key={report.id}
                className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-[18px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-stone">
                      {report.folio} · {report.category} · {formatShortDateEs(report.createdAt, false)}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold text-ink">{report.title}</h2>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      report.status === 'resolved'
                        ? 'bg-ok-bg text-ok'
                        : report.status === 'in_progress'
                          ? 'bg-info-bg text-info'
                          : 'bg-warn-bg text-warn'
                    }`}
                  >
                    {REPORT_STATUS_LABELS[report.status]}
                  </span>
                </div>

                <p className="text-[15px] text-ink-soft">{report.description}</p>

                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full ${
                          idx <= step ? 'bg-cantera' : 'bg-sand-2'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-stone">
                    <span>Recibido</span>
                    <span>En proceso</span>
                    <span>Resuelto</span>
                  </div>
                </div>

                {report.comments.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    {report.comments.map((c) => (
                      <div key={c.id} className="rounded-xl bg-sand px-3 py-2 text-sm">
                        <p className="text-xs font-semibold text-stone">
                          {c.authorName} · {formatShortDateEs(c.createdAt, false)}
                        </p>
                        <p className="mt-0.5 text-ink">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ==================== AVISOS (RESIDENT FULL LIST) ==================== */

interface ResidentNoticesProps {
  db: PortalDatabase;
  onNavigate: (route: AppRoute) => void;
}

export function ResidentNotices({ db, onNavigate }: ResidentNoticesProps) {
  const [category, setCategory] = useState<'all' | NoticeCategory>('all');
  const notices = [...db.notices]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    .filter((n) => (category === 'all' ? true : n.category === category));

  return (
    <div>
      <ResidentPageHeader title="Avisos" onBack={() => onNavigate('/')} />

      <div className="flex flex-col gap-4 px-4 pb-8 md:px-6 lg:px-8">
        <div role="radiogroup" className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {(['all', 'administracion', 'mantenimiento', 'seguridad', 'eventos'] as const).map(
            (val) => {
              const active = category === val;
              return (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(val)}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-night bg-night text-white'
                      : 'border-chip-line bg-white text-ink hover:bg-sand-2'
                  }`}
                >
                  {val === 'all' ? 'Todos' : NOTICE_CATEGORY_LABELS[val]}
                </button>
              );
            },
          )}
        </div>

        {notices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-chip-line bg-white/60 px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-stone/60" />
            <p className="font-semibold text-ink">Sin avisos</p>
            <p className="text-sm text-stone">No hay avisos publicados en esta categoría.</p>
          </div>
        ) : (
          notices.map((n) => (
            <article
              key={n.id}
              className="flex flex-col gap-1.5 rounded-[16px] border border-line bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-sand-2 px-2 py-0.5 text-xs font-semibold text-ink-soft">
                  {NOTICE_CATEGORY_LABELS[n.category]}
                </span>
                {n.urgent && (
                  <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad">
                    Urgente
                  </span>
                )}
                {n.pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-cantera">
                    <Pin className="size-3" />
                    Fijado
                  </span>
                )}
                <span className="ml-auto text-xs text-stone">{formatShortDateEs(n.createdAt)}</span>
              </div>
              <h2 className="font-semibold text-ink">{n.title}</h2>
              <p className="text-sm leading-relaxed text-ink-soft">{n.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
