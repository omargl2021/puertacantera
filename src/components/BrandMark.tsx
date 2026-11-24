import { OFFICIAL_LOGO_URL } from '../data/seedData';

interface BrandMarkProps {
  variant?: 'light' | 'dark';
  width?: number;
  className?: string;
}

export function BrandMark({ variant = 'light', width = 150, className = '' }: BrandMarkProps) {
  // On dark obsidian surfaces, invert turns the white image background into pure black (0,0,0)
  // which disappears cleanly under mix-blend-mode: screen, while brightness + sepia + saturate +
  // hue-rotate transform the Puerta Cantera Residencial emblem and wordmark into gleaming metallic gold.
  if (variant === 'light') {
    return (
      <img
        src={OFFICIAL_LOGO_URL}
        alt="Puerta Cantera Residencial"
        width={width}
        referrerPolicy="no-referrer"
        style={{
          width: `${width}px`,
          filter: 'invert(1) grayscale(1) brightness(0.76) sepia(1) saturate(1.9) hue-rotate(2deg) brightness(1.06) contrast(1.04)',
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
        filter: 'grayscale(1) sepia(1) saturate(2.8) hue-rotate(10deg) brightness(0.76) contrast(1.1)',
        mixBlendMode: 'multiply',
      }}
      className={`h-auto object-contain select-none ${className}`}
    />
  );
}
