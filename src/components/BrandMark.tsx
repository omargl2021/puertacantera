import { OFFICIAL_LOGO_URL } from '../data/seedData';

interface BrandMarkProps {
  variant?: 'light' | 'dark';
  width?: number;
  className?: string;
}

export function BrandMark({ variant = 'light', width = 150, className = '' }: BrandMarkProps) {
  // On dark bg-night (#2B2724), invert + grayscale + screen blend turns the white image canvas
  // completely transparent while keeping the official Puerta Cantera Residencial typography &
  // geometric arch emblem crisp white/warm-sand.
  if (variant === 'light') {
    return (
      <img
        src={OFFICIAL_LOGO_URL}
        alt="Puerta Cantera Residencial"
        width={width}
        referrerPolicy="no-referrer"
        style={{
          width: `${width}px`,
          filter: 'invert(1) grayscale(1) sepia(0.1) contrast(1.15) brightness(1.18)',
          mixBlendMode: 'screen',
        }}
        className={`h-auto object-contain select-none ${className}`}
      />
    );
  }

  return (
    <img
      src={OFFICIAL_LOGO_URL}
      alt="Puerta Cantera Residencial"
      width={width}
      referrerPolicy="no-referrer"
      style={{
        width: `${width}px`,
        mixBlendMode: 'multiply',
      }}
      className={`h-auto object-contain select-none ${className}`}
    />
  );
}
