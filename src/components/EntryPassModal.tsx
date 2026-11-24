import { useState } from 'react';
import { Car, Copy, Download, Printer, QrCode, User, X } from 'lucide-react';
import { ENTRY_PASS_TEMPLATE_URL } from '../data/seedData';
import type { House, PortalUser } from '../types/portal';
import { buildQrMatrix, formatHouseLabel } from '../utils/portalLogic';
import { QrCodeSvg } from './QrCodeSvg';

interface EntryPassModalProps {
  user: PortalUser;
  house: House | null;
  onClose: () => void;
  onNotify: (message: string) => void;
}

interface PassOption {
  id: string;
  label: string;
  subtitle: string;
  code: string;
  kind: 'resident' | 'vehicle';
}

export function EntryPassModal({ user, house, onClose, onNotify }: EntryPassModalProps) {
  const options: PassOption[] = [
    {
      id: 'resident',
      label: 'Residente',
      subtitle: user.name,
      code: user.qrCode,
      kind: 'resident',
    },
    ...user.vehicleQrCodes.map((v) => ({
      id: `car-${v.index}`,
      label: v.label,
      subtitle: `${user.name} · ${v.label}`,
      code: v.code,
      kind: 'vehicle' as const,
    })),
  ];

  const [selectedId, setSelectedId] = useState<string>(options[0].id);
  const [downloading, setDownloading] = useState(false);

  const activeOption = options.find((o) => o.id === selectedId) ?? options[0];
  const houseLabel = house ? formatHouseLabel(house) : 'Sin casa asignada';

  const handleDownloadPng = async (option: PassOption) => {
    setDownloading(true);
    try {
      // Exact 7 cm width x 10 cm height at 300 DPI:
      // 7cm / 2.54 * 300 = 827px, 10cm / 2.54 * 300 = 1181px
      const canvasW = 827;
      const canvasH = 1181;
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasW, canvasH);

      const templateImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar la plantilla del pase.'));
        img.src = ENTRY_PASS_TEMPLATE_URL;
      });

      // Match CSS object-cover object-center on 7:10 container
      const imgRatio = templateImg.naturalWidth / templateImg.naturalHeight;
      const targetRatio = canvasW / canvasH;
      let drawW = canvasW;
      let drawH = canvasH;
      let offsetX = 0;
      let offsetY = 0;
      if (imgRatio > targetRatio) {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
        offsetX = (canvasW - drawW) / 2;
      } else {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
        offsetY = (canvasH - drawH) / 2;
      }
      ctx.drawImage(templateImg, offsetX, offsetY, drawW, drawH);

      // Draw crisp QR code in the open patterned middle zone (between "la SA lle" and "RESIDENTE")
      const matrix = buildQrMatrix(option.code);
      const qrBoxSize = Math.round(canvasH * 0.186); // ~220px (~1.86cm)
      const qrBoxX = Math.round((canvasW - qrBoxSize) / 2);
      const qrBoxY = Math.round(canvasH * 0.594);
      const pad = 14;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
      ctx.fill();
      ctx.strokeStyle = '#DBD3C7';
      ctx.lineWidth = 2;
      ctx.stroke();

      const cells = matrix.length;
      const cellSize = (qrBoxSize - pad * 2) / cells;
      ctx.fillStyle = '#1B1917';
      for (let r = 0; r < cells; r += 1) {
        for (let c = 0; c < cells; c += 1) {
          if (matrix[r][c]) {
            ctx.fillRect(
              qrBoxX + pad + c * cellSize,
              qrBoxY + pad + r * cellSize,
              Math.ceil(cellSize),
              Math.ceil(cellSize),
            );
          }
        }
      }

      // Subtle footer label below RESIDENTE
      const pillW = Math.round(canvasW * 0.52);
      const pillH = 74;
      const pillX = Math.round((canvasW - pillW) / 2);
      const pillY = Math.round(canvasH * 0.875);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 12);
      ctx.fill();

      ctx.fillStyle = '#23201D';
      ctx.textAlign = 'center';
      ctx.font = '700 22px "IBM Plex Mono", monospace';
      ctx.fillText(option.code, canvasW / 2, pillY + 31);

      ctx.fillStyle = '#48423C';
      ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
      const subText = `${option.label} · ${house ? `#${house.number}${house.interiorNumber ? ` Int. ${house.interiorNumber}` : ''}` : user.name}`;
      ctx.fillText(subText.slice(0, 34), canvasW / 2, pillY + 58);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const slug = `${user.name}-${option.label}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      link.href = dataUrl;
      link.download = `pase-entrada-7x10cm-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onNotify(`Pase de entrada (${option.label}) descargado en formato 7 × 10 cm (300 DPI).`);
    } catch {
      onNotify('No se pudo generar el PNG del pase. Intenta nuevamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    onNotify('Preparando impresión en medida exacta 7 cm ancho × 10 cm alto.');
    window.print();
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
              Pase de entrada · 10 cm alto × 7 cm ancho
            </span>
            <h2 className="mt-0.5 font-heading text-2xl font-semibold text-ink">{user.name}</h2>
            <p className="text-sm text-stone">
              {houseLabel} · {user.carCount}{' '}
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

        {/* Selector pills for Resident QR + each Automobile QR */}
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
                    ? 'border-night bg-night text-white'
                    : 'border-chip-line bg-white text-ink hover:bg-sand-2'
                }`}
              >
                {opt.kind === 'resident' ? (
                  <User className="size-3.5" />
                ) : (
                  <Car className="size-3.5" />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr] md:items-start">
          {/* Exact 7cm x 10cm Hangtag Preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="entry-pass-print-target relative overflow-hidden rounded-[12px] border border-line bg-white shadow-md"
              style={{ width: '7cm', height: '10cm' }}
              data-testid="entry-pass-card"
            >
              <img
                src={ENTRY_PASS_TEMPLATE_URL}
                alt="Plantilla de pase de entrada Puerta Cantera"
                className="h-full w-full object-cover object-center select-none"
              />

              {/* QR Code centered between "la SA lle" and "RESIDENTE" */}
              <div
                className="absolute left-1/2 -translate-x-1/2 rounded-[6px] border border-chip-line bg-white p-[4px] shadow-xs"
                style={{ top: '59.4%' }}
              >
                <QrCodeSvg code={activeOption.code} size={64} />
              </div>

              {/* Compact identification label below RESIDENTE */}
              <div
                className="absolute left-1/2 flex w-[54%] -translate-x-1/2 flex-col items-center rounded-[5px] bg-white/92 px-1.5 py-0.5 text-center"
                style={{ top: '87.4%' }}
              >
                <span className="font-mono text-[9px] leading-tight font-bold tracking-tight text-ink">
                  {activeOption.code}
                </span>
                <span className="max-w-full truncate text-[8px] leading-tight font-semibold text-ink-soft">
                  {activeOption.label}
                  {house
                    ? ` · #${house.number}${house.interiorNumber ? ` Int. ${house.interiorNumber}` : ''}`
                    : ''}
                </span>
              </div>
            </div>
            <span className="font-mono text-xs font-medium text-stone">
              Medida real: 7.0 cm × 10.0 cm
            </span>
          </div>

          {/* Right column: QR breakdown & download/print controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-stone uppercase">
                <QrCode className="size-4 text-cantera" />
                Códigos QR generados ({options.length})
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
                        onClick={() => setSelectedId(opt.id)}
                        className="shrink-0 rounded-lg bg-white p-1 shadow-2xs"
                        aria-label={`Ver pase de ${opt.label}`}
                      >
                        <QrCodeSvg code={opt.code} size={40} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedId(opt.id)}
                        className="flex min-w-0 flex-1 flex-col text-left"
                      >
                        <span className="text-sm font-semibold text-ink">{opt.label}</span>
                        <span className="truncate font-mono text-xs text-stone">{opt.code}</span>
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
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cantera px-4 text-base font-semibold text-white transition-all hover:bg-cantera-dark active:translate-y-px disabled:opacity-60"
              >
                <Download className="size-4" />
                {downloading
                  ? 'Generando PNG...'
                  : `Descargar PNG 7 × 10 cm (${activeOption.label})`}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-chip-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-sand-2"
              >
                <Printer className="size-4" />
                Imprimir pase (7 × 10 cm)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
