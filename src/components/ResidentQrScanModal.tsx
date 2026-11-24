import { Car, Home, Mail, Phone, Printer, ShieldCheck, UserRound } from 'lucide-react';
import type { ScannedResidentData } from '../types/portal';
import { ROLE_LABELS } from '../utils/portalLogic';
import { QrCodeSvg } from './QrCodeSvg';

interface ResidentQrScanModalProps {
  data: ScannedResidentData;
  onClose: () => void;
}

/**
 * Floating resident verification window opened when a corbatín QR is scanned.
 * Intentionally contains ONLY two action buttons: "Imprimir" and "Cerrar".
 */
export function ResidentQrScanModal({ data, onClose }: ResidentQrScanModalProps) {
  const handlePrint = () => {
    document.body.dataset.printMode = 'scan-card';
    const cleanup = () => {
      delete document.body.dataset.printMode;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scan-resident-title"
      data-testid="qr-scan-floating-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-[3px]"
    >
      <div className="qr-scan-print-target my-auto flex w-full max-w-md flex-col gap-4 rounded-[24px] border border-gold/45 bg-white p-5 shadow-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-cantera uppercase">
              <ShieldCheck className="size-3.5" />
              Puerta Cantera Residencial
            </span>
            <h2
              id="qr-scan-resident-title"
              className="font-heading text-2xl leading-tight font-semibold text-ink"
            >
              {data.name}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                {data.residentKey}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  data.active ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'
                }`}
              >
                {data.active ? 'Acceso activo' : 'Acceso inactivo'}
              </span>
            </div>
          </div>

          <div className="shrink-0 rounded-xl border border-gold/30 bg-sand/60 p-1.5">
            <QrCodeSvg code={data.qrValue} size={74} className="block rounded-lg bg-white" />
          </div>
        </div>

        {/* Resident Details */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-sand/55 p-4">
          <span className="text-[11px] font-semibold tracking-[0.1em] text-stone uppercase">
            Datos del residente
          </span>

          <div className="grid grid-cols-1 gap-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <Home className="mt-0.5 size-4 shrink-0 text-cantera" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-stone">Dirección</span>
                <span className="font-semibold text-ink">{data.houseLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-cantera" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-stone">Teléfono</span>
                  <span className="font-semibold text-ink">{data.phone || 'No registrado'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 shrink-0 text-cantera" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-stone">Rol</span>
                  <span className="font-semibold text-ink">{ROLE_LABELS[data.role]}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-cantera" />
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-medium text-stone">Correo electrónico</span>
                <span className="truncate font-semibold text-ink">{data.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="flex flex-col gap-2 rounded-2xl border border-gold/30 bg-cantera-soft/45 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-cantera uppercase">
              <Car className="size-3.5" />
              Automóvil registrado · {data.vehicleLabel}
            </span>
            <span className="font-mono text-xs font-semibold text-stone">{data.code}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-0.5 text-xs">
            <div className="rounded-xl bg-white px-2.5 py-2">
              <span className="block text-[10px] font-semibold tracking-[0.06em] text-stone uppercase">
                Placa
              </span>
              <span className="mt-0.5 block font-mono text-sm font-bold text-ink">
                {data.plate || '—'}
              </span>
            </div>
            <div className="rounded-xl bg-white px-2.5 py-2">
              <span className="block text-[10px] font-semibold tracking-[0.06em] text-stone uppercase">
                Modelo
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-ink">
                {data.model || '—'}
              </span>
            </div>
            <div className="rounded-xl bg-white px-2.5 py-2">
              <span className="block text-[10px] font-semibold tracking-[0.06em] text-stone uppercase">
                Color
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-ink">
                {data.color || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Strictly ONLY two buttons: Imprimir & Cerrar */}
        <div className="qr-scan-no-print grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-sm font-semibold text-white transition-colors hover:bg-cantera-dark active:translate-y-px"
          >
            <Printer className="size-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2 active:translate-y-px"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
