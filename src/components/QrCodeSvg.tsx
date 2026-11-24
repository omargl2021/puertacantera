import { useMemo } from 'react';
import { buildQrMatrix } from '../utils/portalLogic';

interface QrCodeSvgProps {
  code: string;
  size?: number;
  fillContainer?: boolean;
  className?: string;
}

export function QrCodeSvg({
  code,
  size = 148,
  fillContainer = false,
  className,
}: QrCodeSvgProps) {
  const matrix = useMemo(() => buildQrMatrix(code), [code]);
  const cells = matrix.length;
  const padding = 2;
  const viewSize = cells + padding * 2;

  return (
    <svg
      width={fillContainer ? '100%' : size}
      height={fillContainer ? '100%' : size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Código QR ${code}`}
      className={
        className ??
        (fillContainer
          ? 'block h-full w-full bg-white'
          : 'shrink-0 rounded-xl border border-line bg-white p-1')
      }
    >
      <rect x="0" y="0" width={viewSize} height={viewSize} fill="#FFFFFF" />
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect
              key={`${r}-${c}`}
              x={c + padding}
              y={r + padding}
              width="1"
              height="1"
              fill="#171411"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
