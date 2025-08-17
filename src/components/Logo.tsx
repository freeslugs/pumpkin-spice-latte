import React from 'react';
import { Coffee } from 'lucide-react';

interface LogoProps {
  size?: number | string; // total diameter
  iconSize?: number | string; // inner icon size
  className?: string;
}

const toPixels = (value: number | string): string =>
  typeof value === 'number' ? `${value}px` : value;

const Logo: React.FC<LogoProps> = ({
  size = 40,
  iconSize,
  className = '',
}) => {
  const diameter = toPixels(size);
  const innerSize = toPixels(iconSize ?? (typeof size === 'number' ? size / 2 : 20));

  return (
    <div
      className={`inline-grid place-items-center bg-orange-500 rounded-full shadow-lg overflow-hidden shrink-0 ${className}`}
      style={{ width: diameter, height: diameter, aspectRatio: '1 / 1', borderRadius: '9999px' }}
   >
      <Coffee className='text-white' style={{ width: innerSize, height: innerSize }} />
    </div>
  );
};

export default Logo;


