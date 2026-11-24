import { ENTRY_PASS_TEMPLATE_URL } from '../data/seedData';
import type { House, PortalUser, ScannedResidentData, VehicleQrCode } from '../types/portal';
import {
  buildQrMatrix,
  buildVehicleScanUrl,
  createScannedResidentData,
  formatHouseLabel,
} from '../utils/portalLogic';
import { QrCodeSvg } from './QrCodeSvg';

export const CORBATIN_WIDTH_CM = 9;
export const CORBATIN_HEIGHT_CM = 19;

// Exact measured inner gold QR frame coordinates inside acceso_15ac1a26.png (641 x 1536 px)
const TEMPLATE_W = 641;
const TEMPLATE_H = 1536;
const QR_BOX_LEFT_PCT = 27.93;
const QR_BOX_TOP_PCT = 66.93;
const QR_BOX_WIDTH_PCT = 42.28;
const QR_BOX_HEIGHT_PCT = 17.64;

interface CorbatinCardProps {
  user: PortalUser;
  vehicle: VehicleQrCode;
  house: House | null;
  /** 'exact' renders literal 9cm x 19cm physical CSS size; 'fluid' fills parent width keeping 9:19 aspect ratio */
  sizing?: 'exact' | 'fluid';
  className?: string;
  onScanQr?: (data: ScannedResidentData) => void;
  testId?: string;
}

export function CorbatinCard({
  user,
  vehicle,
  house,
  sizing = 'fluid',
  className = '',
  onScanQr,
  testId,
}: CorbatinCardProps) {
  const scanUrl = buildVehicleScanUrl(user, vehicle, house);
  const scanData = createScannedResidentData(user, vehicle, house);

  return (
    <div
      data-testid={testId}
      className={`relative flex items-center justify-center overflow-hidden bg-[#DFD8D4] select-none ${
        sizing === 'fluid' ? 'aspect-[9/19] w-full' : ''
      } ${className}`}
      style={
        sizing === 'exact'
          ? { width: `${CORBATIN_WIDTH_CM}cm`, height: `${CORBATIN_HEIGHT_CM}cm` }
          : undefined
      }
    >
      {/* Aspect-locked template wrapper guarantees sub-pixel alignment inside the gold QR frame */}
      <div
        className="relative h-full max-w-full"
        style={{ aspectRatio: `${TEMPLATE_W} / ${TEMPLATE_H}` }}
      >
        <img
          src={ENTRY_PASS_TEMPLATE_URL}
          alt="Diseño oficial corbatín Puerta Cantera Residencial"
          className="h-full w-full object-contain select-none"
        />

        {/* Real scannable QR code positioned exactly inside the embossed gold square */}
        <button
          type="button"
          onClick={() => onScanQr?.(scanData)}
          title="Escanear / ver datos del residente"
          aria-label={`Escanear QR de ${user.name} (${vehicle.label})`}
          className="absolute overflow-hidden rounded-[6px] bg-white p-[3%] shadow-2xs transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-gold"
          style={{
            left: `${QR_BOX_LEFT_PCT}%`,
            top: `${QR_BOX_TOP_PCT}%`,
            width: `${QR_BOX_WIDTH_PCT}%`,
            height: `${QR_BOX_HEIGHT_PCT}%`,
          }}
        >
          <QrCodeSvg code={scanUrl} fillContainer className="block h-full w-full bg-white" />
        </button>

        {/* Clean compact identification strip centered strictly inside the gold marble frame */}
        <div
          className="pointer-events-none absolute left-1/2 flex w-[68%] -translate-x-1/2 flex-col items-center justify-center rounded-[5px] border border-gold/20 bg-[#FAF6EF]/90 px-1.5 py-[2px] text-center shadow-[0_1px_2px_rgba(23,20,17,0.06)]"
          style={{ top: '85.7%', maxHeight: '7.4%' }}
        >
          <span className="max-w-full truncate text-[8px] leading-[1.15] font-bold text-ink">
            {user.residentKey} · {user.name}
          </span>
          <span className="max-w-full truncate text-[7px] leading-[1.15] font-semibold text-ink-soft">
            {vehicle.plate ? `${vehicle.label} · ${vehicle.plate}` : vehicle.label}
            {house ? ` · ${formatHouseLabel(house)}` : ''}
          </span>
          <span className="font-mono text-[6.5px] leading-[1.15] font-semibold tracking-tight text-stone">
            {vehicle.code}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Exports a print-ready 300 DPI PNG at exact 9 cm width x 19 cm height (1063 x 2244 px).
 */
export async function exportCorbatinPng(
  user: PortalUser,
  vehicle: VehicleQrCode,
  house: House | null,
): Promise<string> {
  // 9 cm / 2.54 * 300 = 1063 px; 19 cm / 2.54 * 300 = 2244 px
  const canvasW = 1063;
  const canvasH = 2244;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.fillStyle = '#DFD8D4';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const templateImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la plantilla del corbatín.'));
    img.src = ENTRY_PASS_TEMPLATE_URL;
  });

  // Fit template preserving full gold hangtag proportions inside 9cm x 19cm
  const imgRatio = templateImg.naturalWidth / templateImg.naturalHeight;
  const drawH = canvasH;
  const drawW = Math.round(drawH * imgRatio);
  const offsetX = Math.round((canvasW - drawW) / 2);
  const offsetY = 0;
  ctx.drawImage(templateImg, offsetX, offsetY, drawW, drawH);

  // Draw real ISO 18004 scannable QR code directly inside the embossed gold square
  const scanUrl = buildVehicleScanUrl(user, vehicle, house);
  const matrix = buildQrMatrix(scanUrl);
  const qrX = offsetX + Math.round((QR_BOX_LEFT_PCT / 100) * drawW);
  const qrY = offsetY + Math.round((QR_BOX_TOP_PCT / 100) * drawH);
  const qrW = Math.round((QR_BOX_WIDTH_PCT / 100) * drawW);
  const qrH = Math.round((QR_BOX_HEIGHT_PCT / 100) * drawH);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrW, qrH, 16);
  ctx.fill();

  const pad = Math.round(qrW * 0.06);
  const cells = matrix.length;
  const cellSize = (qrW - pad * 2) / cells;
  ctx.fillStyle = '#171411';
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      if (matrix[r][c]) {
        ctx.fillRect(
          qrX + pad + c * cellSize,
          qrY + pad + r * cellSize,
          Math.ceil(cellSize),
          Math.ceil(cellSize),
        );
      }
    }
  }

  // Footer strip cleanly inset inside the gold marble border below the QR box
  const stripW = Math.round(drawW * 0.68);
  const stripH = 114;
  const stripX = offsetX + Math.round((drawW - stripW) / 2);
  const stripY = offsetY + Math.round(drawH * 0.858);

  ctx.fillStyle = 'rgba(250, 246, 239, 0.92)';
  ctx.beginPath();
  ctx.roundRect(stripX, stripY, stripW, stripH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 154, 69, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1B1815';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${user.residentKey} · ${user.name}`.slice(0, 28), canvasW / 2, stripY + 35);

  ctx.fillStyle = '#4A433B';
  ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
  const carLine = `${vehicle.plate ? `${vehicle.label} · ${vehicle.plate}` : vehicle.label}${house ? ` · #${house.number}${house.interiorNumber ? ` Int. ${house.interiorNumber}` : ''}` : ''}`;
  ctx.fillText(carLine.slice(0, 32), canvasW / 2, stripY + 68);

  ctx.fillStyle = '#6E655B';
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.fillText(vehicle.code, canvasW / 2, stripY + 98);

  return canvas.toDataURL('image/png');
}
