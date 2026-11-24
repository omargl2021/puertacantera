import { useState } from 'react';
import { Car, Copy, Download, Printer, QrCode, X } from 'lucide-react';
import type { House, PortalUser, ScannedResidentData, VehicleQrCode } from '../types/portal';
import {
  buildVehicleScanUrl,
  createScannedResidentData,
  formatHouseLabel,
  formatVehicleSummary,
} from '../utils/portalLogic';
import {
  CORBATIN_HEIGHT_CM,
  CORBATIN_WIDTH_CM,
  CorbatinCard,
  exportCorbatinPng,
} from './CorbatinCard';
import { QrCodeSvg } from './QrCodeSvg';

interface EntryPassModalProps {
  user: PortalUser;
  house: House | null;
  onClose: () => void;
  onNotify: (message: string) => void;
  onScanQr?: (data: ScannedResidentData) => void;
}

interface PassOption {
  id: string;
  label: string;
  specs: string;
  code: string;
  vehicle: VehicleQrCode;
  qrValue: string;
  scanData: ScannedResidentData;
}

export function EntryPassModal({
  user,
  house,
  onClose,
  onNotify,
  onScanQr,
}: EntryPassModalProps) {
  const options: PassOption[] = user.vehicleQrCodes.map((v) => ({
    id: `car-${v.index}`,
    label: v.plate ? `${v.label} · ${v.plate}` : v.label,
    specs: formatVehicleSummary(v),
    code: v.code,
    vehicle: v,
    qrValue: buildVehicleScanUrl(user, v, house),
    scanData: createScannedResidentData(user, v, house),
  }));

  const [selectedId, setSelectedId] = useState<string>(options[0]?.id ?? '');
  const [downloading, setDownloading] = useState(false);

  const activeOption = options.find((o) => o.id === selectedId) ?? options[0] ?? null;
  const houseLabel = house ? formatHouseLabel(house) : 'Sin casa asignada';

  const handleDownloadPng = async (option: PassOption) => {
    setDownloading(true);
    try {
      const dataUrl = await exportCorbatinPng(user, option.vehicle, house);
      const link = document.createElement('a');
      const slug = `${user.residentKey}-${user.name}-${option.label}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      link.href = dataUrl;
      link.download = `corbatin-9x19cm-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onNotify(
        `Corbatín (${option.label}) descargado en formato ${CORBATIN_HEIGHT_CM} × ${CORBATIN_WIDTH_CM} cm (300 DPI).`,
      );
    } catch {
      onNotify('No se pudo generar el PNG del corbatín. Intenta nuevamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    onNotify(
      `Preparando impresión en medida exacta ${CORBATIN_HEIGHT_CM} cm alto × ${CORBATIN_WIDTH_CM} cm ancho.`,
    );
    document.body.dataset.printMode = 'corbatin-single';
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Pase de entrada de ${user.name}`}
    >
      <div className="my-auto flex w-full max-w-3xl flex-col gap-5 rounded-[22px] border border-line bg-sand p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold tracking-[0.08em] text-stone uppercase">
              Corbatín de acceso vehicular · {CORBATIN_HEIGHT_CM} cm alto × {CORBATIN_WIDTH_CM} cm ancho
            </span>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-night px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                {user.residentKey}
              </span>
              <h2 className="font-heading text-2xl font-semibold text-ink">
                Titular: {user.name}
              </h2>
            </div>
            <p className="text-sm text-stone">
              {houseLabel}
              {user.phone ? ` · Tel. ${user.phone}` : ''} · {user.carCount}{' '}
              {user.carCount === 1 ? 'auto registrado' : 'autos registrados'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar pase de entrada"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-white text-stone shadow-xs hover:bg-sand-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {!activeOption ? (
          <div className="rounded-2xl border border-dashed border-chip-line bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-stone">
              Este residente no tiene automóviles registrados para generar un corbatín QR.
            </p>
          </div>
        ) : (
          <>
            {/* Selector buttons for each Automobile QR */}
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const active = opt.id === activeOption.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedId(opt.id)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-night bg-night text-gold-light'
                        : 'border-chip-line bg-white text-ink hover:bg-sand-2'
                    }`}
                  >
                    <Car className="size-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-[210px_1fr] md:items-start">
              {/* New Gold-Trimmed Marble Corbatín Preview (9 cm x 19 cm proportions) */}
              <div className="flex flex-col items-center gap-2">
                <div className="entry-pass-print-target w-full max-w-[205px] overflow-hidden rounded-[12px] border border-line bg-[#DFD8D4] shadow-md">
                  <CorbatinCard
                    user={user}
                    vehicle={activeOption.vehicle}
                    house={house}
                    sizing="fluid"
                    onScanQr={onScanQr}
                    testId="entry-pass-card"
                  />
                </div>
                <span className="font-mono text-xs font-medium text-stone">
                  Medida real: {CORBATIN_WIDTH_CM}.0 cm × {CORBATIN_HEIGHT_CM}.0 cm
                </span>
              </div>

              {/* Right column: QR breakdown & download/print controls */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-stone uppercase">
                      <QrCode className="size-4 text-cantera" />
                      Códigos QR por automóvil ({options.length})
                    </span>
                    {onScanQr && (
                      <button
                        type="button"
                        onClick={() => onScanQr(activeOption.scanData)}
                        className="text-xs font-semibold text-cantera hover:underline"
                      >
                        Escanear QR →
                      </button>
                    )}
                  </div>

                  <div className="flex max-h-[240px] flex-col gap-2 overflow-y-auto pr-1">
                    {options.map((opt) => {
                      const selected = opt.id === activeOption.id;
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                            selected ? 'border-cantera bg-cantera-soft/45' : 'border-line bg-sand/50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(opt.id);
                              onScanQr?.(opt.scanData);
                            }}
                            className="shrink-0 rounded-lg bg-white p-1 shadow-2xs"
                            aria-label={`Escanear QR de ${opt.label}`}
                          >
                            <QrCodeSvg code={opt.qrValue} size={40} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedId(opt.id)}
                            className="flex min-w-0 flex-1 flex-col text-left"
                          >
                            <span className="text-sm font-semibold text-ink">{opt.label}</span>
                            <span className="truncate text-xs text-ink-soft">
                              Titular: {user.name}
                              {opt.specs ? ` · ${opt.specs}` : ''}
                            </span>
                            <span className="truncate font-mono text-[11px] text-stone">
                              {opt.code}
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Copiar código ${opt.code}`}
                            onClick={() => {
                              navigator.clipboard?.writeText(opt.code).catch(() => {});
                              onNotify(`Código ${opt.code} copiado.`);
                            }}
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-chip-line bg-white text-stone hover:bg-sand-2 hover:text-ink"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => handleDownloadPng(activeOption)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-sm font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px disabled:opacity-60 sm:text-base"
                  >
                    <Download className="size-4" />
                    {downloading
                      ? 'Generando PNG...'
                      : `Descargar PNG 9 × 19 cm (${activeOption.label})`}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
                  >
                    <Printer className="size-4" />
                    Imprimir corbatín ({CORBATIN_HEIGHT_CM} × {CORBATIN_WIDTH_CM} cm)
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
