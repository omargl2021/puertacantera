import { useMemo } from 'react';
import { buildQrMatrix } from '../utils/portalLogic';

interface QrCodeSvgProps {
  code: string;
  size?: number;
}

export function QrCodeSvg({ code, size = 148 }: QrCodeSvgProps) {
  const matrix = useMemo(() => buildQrMatrix(code), [code]);
  const cells = matrix.length;
  const padding = 2;
  const viewSize = cells + padding * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="img"
      aria-label={`Código QR del pase ${code}`}
      className="rounded-xl bg-white p-1 border border-hairline shrink-0"
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
              rx="0.12"
              fill="#231F1C"
            />
          ) : null
        )
      )}
    </svg>
  );
}
