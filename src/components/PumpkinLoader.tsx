import React from 'react';

interface PumpkinLoaderProps {
  isLoading: boolean;
}

const PumpkinLoader: React.FC<PumpkinLoaderProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-orange-100'>
      <div className='text-center'>
        {/* Pumpkin Emoji with Custom Bounce and Glow Animation */}
        <div className='text-8xl mb-6 pumpkin-bounce'>🎃</div>

        {/* Loading Text */}
        <h2 className='text-2xl font-bold text-orange-800 mb-4'>
          Pumpkin Spice Latte
        </h2>

        {/* Loading Dots with Custom Animation */}
        <div className='flex justify-center space-x-2'>
          <div className='w-3 h-3 bg-orange-500 rounded-full loading-dot'></div>
          <div className='w-3 h-3 bg-orange-500 rounded-full loading-dot'></div>
          <div className='w-3 h-3 bg-orange-500 rounded-full loading-dot'></div>
        </div>

        {/* Loading Message */}
        <p className='text-orange-600 mt-4 text-lg'>
          Brewing your perfect latte...
        </p>
      </div>
    </div>
  );
};

export default PumpkinLoader;
